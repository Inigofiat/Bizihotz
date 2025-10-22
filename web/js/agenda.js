"use strict";

const API_BASE_URL = (() => {
  const gatewayBase = "http://localhost:5000/gestion";
  const serviceBase = "http://localhost:4002";

  if (window.location.protocol == "file:") {
    return serviceBase;
  }

  const host = window.location.hostname || "localhost";
  if (host === "localhost" || host === "127.0.0.1") {
    return serviceBase;
  }
  return `${window.location.protocol}//${window.location.host}/gestion`;
})();

const API_FALLBACK_URL =
  window.location.protocol === "file:" || window.location.hostname === "localhost"
    ? "http://localhost:5000/gestion"
    : null;

const API_URL = `${API_BASE_URL}/api`;
const API_FALLBACK = API_FALLBACK_URL ? `${API_FALLBACK_URL}/api` : null;
const LOGIN_PAGE = "login.html";

let usuarioActual = null;

const SLOT_DURATION_MINUTES = 45;
const HORARIO_BLOQUES = [
  { inicio: { horas: 9, minutos: 0 }, fin: { horas: 14, minutos: 0 } },
  { inicio: { horas: 15, minutos: 0 }, fin: { horas: 20, minutos: 0 } }
];

const DOW_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const agendaState = {
  selectedDate: new Date(),
  monthAnchor: null,
  professionalId: null,
  citas: [],
  citasPorDia: new Map(),
  searchTerm: "",
  loading: false,
  panelOpen: false,
  pacientes: [],
  slotSeleccionado: null,
  pacienteResultados: [],
  pacienteResultadoIndex: -1,
  profesionales: new Map(),
  lastError: null
};

const agendaElements = {
  professionalSelect: null,
  todayBtn: null,
  prevBtn: null,
  nextBtn: null,
  monthLabel: null,
  searchInput: null,
  dow: null,
  days: null,
  prettyDate: null,
  appointments: null,
  totalBadge: null,
  closePanelBtn: null,
  pacientePicker: null,
  pacienteSearch: null,
  pacienteResults: null,
  pacienteIdInput: null,
  tipoInput: null,
  notasInput: null,
  dateInput: null,
  horaInput: null,
  feedback: null,
  cancelBtn: null,
  closeBtn: null
};

const capitalizar = (texto = "") => {
  if (!texto) return "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const normalizarIdentificador = (valor = "") =>
  valor
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const normalizarTextoPaciente = (texto = "") => normalizarIdentificador(texto);

const actualizarUsuarioLocal = (parciales = {}) => {
  if (!usuarioActual) {
    return;
  }
  usuarioActual = { ...usuarioActual, ...parciales };
  localStorage.setItem("bizihotzUsuario", JSON.stringify(usuarioActual));
};

const formatearNombrePaciente = (paciente = {}) =>
  `${paciente.nombrePaciente || ""} ${paciente.apellidos || ""}`.replace(/\s+/g, " ").trim();

const obtenerNombreProfesional = (usuario = {}) => {
  if (!usuario) {
    return "";
  }
  const partes = [];
  if (usuario.nombre) {
    partes.push(usuario.nombre);
  }
  if (usuario.apellidos) {
    partes.push(usuario.apellidos);
  }
  const nombreCompuesto = partes.join(" ").trim();
  if (nombreCompuesto) {
    return nombreCompuesto;
  }
  return usuario.nombreUsuario || usuario.email || "Profesional";
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("bizihotzUsuario");
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn("No se pudo interpretar el usuario guardado:", error);
    return null;
  }
};

const generarSlotsParaBloque = (bloque) => {
  const slots = [];
  const inicioMinutos = bloque.inicio.horas * 60 + bloque.inicio.minutos;
  const finMinutos = bloque.fin.horas * 60 + bloque.fin.minutos;
  for (let minutos = inicioMinutos; minutos < finMinutos; minutos += SLOT_DURATION_MINUTES) {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    const horaTexto = `${horas.toString().padStart(2, "0")}:${resto
      .toString()
      .padStart(2, "0")}`;
    slots.push({ hora: horaTexto, minutos });
  }
  return slots;
};

const SLOT_GROUPS = HORARIO_BLOQUES.map((bloque, indice) => ({
  label: indice === 0 ? "Mañana" : "Tarde",
  slots: generarSlotsParaBloque(bloque)
}));

const TOTAL_SLOTS_POR_DIA = SLOT_GROUPS.reduce((total, grupo) => total + grupo.slots.length, 0);

const SLOT_TIMES_SET = new Set(
  SLOT_GROUPS.flatMap((grupo) => grupo.slots.map((slot) => slot.hora))
);

const normalizeDate = (valor) => {
  const fecha = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
  fecha.setHours(0, 0, 0, 0);
  return fecha;
};

const formatDateKey = (fecha) => {
  const year = fecha.getFullYear();
  const month = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const day = fecha.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isSameDay = (a, b) => {
  if (!a || !b) {
    return false;
  }
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const formatPrettyDate = (fecha) => {
  if (!(fecha instanceof Date)) {
    return "";
  }
  const opciones = { weekday: "long", day: "numeric", month: "long" };
  const texto = new Intl.DateTimeFormat("es-ES", opciones).format(fecha);
  return capitalizar(texto);
};

const determineLoadLevel = (totalCitas) => {
  if (!totalCitas) {
    return "none";
  }
  if (!TOTAL_SLOTS_POR_DIA) {
    return totalCitas > 4 ? "high" : totalCitas > 2 ? "med" : "low";
  }
  const ratio = totalCitas / TOTAL_SLOTS_POR_DIA;
  if (ratio >= 0.75) {
    return "high";
  }
  if (ratio >= 0.4) {
    return "med";
  }
  return "low";
};

const fetchJson = async (path, options = {}) => {
  const endpoints = [`${API_URL}${path}`];
  if (API_FALLBACK && API_FALLBACK !== API_URL) {
    endpoints.push(`${API_FALLBACK}${path}`);
  }

  let lastError = null;
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    const isLast = index === endpoints.length - 1;
    try {
      // preparar headers incluyendo token si existe
      const headers = Object.assign({}, options.headers || {});
      try {
        const stored = getStoredUser();
        const token = (stored && (stored.token || stored.accessToken || stored.authToken)) || (usuarioActual && (usuarioActual.token || usuarioActual.accessToken || usuarioActual.authToken));
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch (e) {
        // ignore
      }

      const response = await fetch(endpoint, { ...options, headers });
      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const body = await response.text();
          try {
            const json = JSON.parse(body);
            if (json && json.message) errMsg = `${json.message}`;
            else if (body) errMsg = body;
          } catch (e) {
            if (body) errMsg = body;
          }
        } catch (e) {
          // no body
        }
        const error = new Error(errMsg);
        error.status = response.status;
        throw error;
      }

      const text = await response.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch (e) {
        return text;
      }
    } catch (error) {
      lastError = error;
      if (isLast) {
        throw error;
      }
    }
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error("No se pudo obtener respuesta del servidor");
};

const cacheAgendaElements = () => {
  agendaElements.professionalSelect = document.getElementById("professionalSelect");
  agendaElements.todayBtn = document.getElementById("todayBtn");
  agendaElements.prevBtn = document.getElementById("prevBtn");
  agendaElements.nextBtn = document.getElementById("nextBtn");
  agendaElements.monthLabel = document.getElementById("monthLabel");
  agendaElements.searchInput = document.getElementById("searchInput");
  agendaElements.dow = document.getElementById("dow");
  agendaElements.days = document.getElementById("days");
  agendaElements.prettyDate = document.getElementById("prettyDate");
  agendaElements.appointments = document.getElementById("appointments");
  agendaElements.totalBadge = document.getElementById("totalBadge");
  agendaElements.sidePanel = document.querySelector(".side");
  agendaElements.closePanelBtn = document.getElementById("closePanel");
  agendaElements.panelBackdrop = document.getElementById("panelBackdrop");
  // edit modal elements
  agendaElements.editModal = document.getElementById("editAppointmentModal");
  agendaElements.editForm = document.getElementById("editAppointmentForm");
  agendaElements.editCitaId = document.getElementById("editCitaId");
  agendaElements.editEstado = document.getElementById("editEstado");
  agendaElements.editNotas = document.getElementById("editNotas");
  agendaElements.editFeedback = document.getElementById("editAppointmentFeedback");
  agendaElements.closeEditBtn = document.getElementById("closeEditAppointment");
  agendaElements.cancelEditBtn = document.getElementById("cancelEditAppointment");
};

const renderDow = () => {
  const container = agendaElements.dow;
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  DOW_LABELS.forEach((label, index) => {
    const cell = document.createElement("div");
    cell.className = "dow";
    if (index >= 5) {
      cell.classList.add("weekend");
    }
    cell.textContent = label;
    fragment.appendChild(cell);
  });
  container.appendChild(fragment);
};

const setLoading = (isLoading) => {
  agendaState.loading = isLoading;
  if (agendaElements.days) {
    agendaElements.days.setAttribute("aria-busy", isLoading ? "true" : "false");
    agendaElements.days.classList.toggle("is-loading", isLoading);
  }
};

const resolverProfesionalDesdeCita = (cita = {}) => {
  const referencia = cita.idUsuario;
  let idProfesional = null;
  let nombreProfesional = cita.profesional || "";

  if (typeof referencia === "string") {
    idProfesional = referencia;
  } else if (referencia && typeof referencia === "object") {
    idProfesional = referencia.idUsuario || referencia._id || referencia.id || null;
    if (!nombreProfesional) {
      nombreProfesional = obtenerNombreProfesional(referencia);
    }
  }

  if (!nombreProfesional && usuarioActual && idProfesional === usuarioActual.idUsuario) {
    nombreProfesional = obtenerNombreProfesional(usuarioActual);
  }

  return {
    id: idProfesional,
    nombre: nombreProfesional || "Profesional"
  };
};

const resolverPacienteDesdeCita = (cita = {}) => {
  if (cita.paciente) {
    return cita.paciente;
  }
  const ref = cita.idPaciente;
  if (!ref) {
    return "";
  }
  if (typeof ref === "string") {
    return cita.paciente || "";
  }
  return formatearNombrePaciente(ref);
};

const normalizarCita = (cita) => {
  if (!cita) {
    return null;
  }
  const fecha = cita.fechaCita ? new Date(cita.fechaCita) : null;
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    return null;
  }
  const fechaClave = formatDateKey(fecha);
  const profesional = resolverProfesionalDesdeCita(cita);
  const pacienteNombre = resolverPacienteDesdeCita(cita);

  const estado = cita.estado
    ? cita.estado
    : typeof cita.atendida === "boolean"
    ? cita.atendida
      ? "Atendida"
      : "Pendiente"
    : "Pendiente";

  return {
    id: cita.idCita || cita._id || null,
    fecha,
    fechaClave,
    hora: cita.hora || "",
    motivo: cita.motivo || cita.tipoConsulta || "",
    notas: cita.notas || "",
    paciente: pacienteNombre || "Paciente sin nombre",
    profesionalId: profesional.id,
    profesionalNombre: profesional.nombre,
    estado,
    raw: cita
  };
};

const agruparCitasPorDia = (citasNormalizadas) => {
  const mapa = new Map();
  citasNormalizadas.forEach((cita) => {
    if (!cita || !cita.fechaClave) {
      return;
    }
    if (!mapa.has(cita.fechaClave)) {
      mapa.set(cita.fechaClave, []);
    }
    mapa.get(cita.fechaClave).push(cita);
  });
  mapa.forEach((lista) => {
    lista.sort((a, b) => {
      if (a.hora === b.hora) {
        return 0;
      }
      return a.hora < b.hora ? -1 : 1;
    });
  });
  return mapa;
};

const updateMonthLabel = () => {
  if (!agendaElements.monthLabel || !agendaState.monthAnchor) {
    return;
  }
  const texto = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric"
  }).format(agendaState.monthAnchor);
  agendaElements.monthLabel.textContent = capitalizar(texto);
};

const actualizarTotalBadge = (total) => {
  if (!agendaElements.totalBadge) {
    return;
  }
  const texto = `${total} cita${total === 1 ? "" : "s"}`;
  agendaElements.totalBadge.textContent = texto;
};

const buildAppointmentNode = (cita, slot) => {
  const item = document.createElement("div");
  item.className = "apt";
  item.title = "Editar cita";
  item.setAttribute("aria-label", "Editar cita");

  const time = document.createElement("div");
  time.className = "time";
  time.textContent = cita.hora || slot?.hora || "--:--";
  item.appendChild(time);

  const content = document.createElement("div");
  content.className = "content";

  const header = document.createElement("div");
  header.className = "apt-header";

  const title = document.createElement("h3");
  title.textContent = cita.paciente || "Paciente sin nombre";
  header.appendChild(title);

  if (cita.estado) {
    const estadoTexto = cita.estado;
    const estadoLower = estadoTexto.toLowerCase();
    const status = document.createElement("span");
    status.className = "status";
    if (estadoLower.includes("atend")) {
      status.classList.add("ok");
    } else if (estadoLower.includes("pend")) {
      status.classList.add("warn");
    } else {
      status.classList.add("bad");
    }
    status.textContent = estadoTexto;
    header.appendChild(status);
  }

  content.appendChild(header);

  // Mostrar el motivo de la cita si existe; si no, caer en notas, si no, texto por defecto
  const descripcionText = cita.motivo && String(cita.motivo).trim()
    ? String(cita.motivo).trim()
    : cita.notas && String(cita.notas).trim()
    ? String(cita.notas).trim()
    : "Sin descripción";

  if (descripcionText) {
    const descripcion = document.createElement("p");
    descripcion.className = "meta";
    descripcion.textContent = descripcionText;
    content.appendChild(descripcion);
  }

  item.appendChild(content);
  // abrir modal de edición al hacer click en la tarjeta (evitar clicks en botones internos)
  item.addEventListener("click", (ev) => {
    // si el click es sobre un elemento interactivo (button, a, select, input), ignorar
    const tag = ev.target.tagName && ev.target.tagName.toLowerCase();
    if (["button", "a", "input", "select", "textarea"].includes(tag)) return;
    openEditModal(cita);
  });

  return item;
};

const openEditModal = (cita) => {
  if (!agendaElements.editModal) return;
  agendaElements.editCitaId.value = cita.id || cita._id || "";
  agendaElements.editEstado.value = cita.estado || "Pendiente";
  agendaElements.editNotas.value = cita.notas || "";
  agendaElements.editFeedback.textContent = "";
  agendaElements.editModal.hidden = false;
  document.body.classList.add("modal-open");
};

const closeEditModal = () => {
  if (!agendaElements.editModal) return;
  agendaElements.editModal.hidden = true;
  document.body.classList.remove("modal-open");
};

// submit handler para guardar cambios de la cita
const handleEditFormSubmit = async (ev) => {
  ev.preventDefault();
  const id = agendaElements.editCitaId.value;
  const nuevoEstado = agendaElements.editEstado.value;
  const nuevasNotas = agendaElements.editNotas.value;
  if (!id) {
    agendaElements.editFeedback.textContent = "ID de cita inválida.";
    return;
  }
  agendaElements.editFeedback.textContent = "Guardando...";

  try {
    // Hacer fetch directo incluyendo Authorization si existe token
    const endpoint = `${API_URL}/citas/${encodeURIComponent(id)}`;
    const headers = { "Content-Type": "application/json" };
    try {
      const stored = getStoredUser();
      const token = (stored && (stored.token || stored.accessToken || stored.authToken)) || (usuarioActual && (usuarioActual.token || usuarioActual.accessToken || usuarioActual.authToken));
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      // ignore
    }

    const resp = await fetch(endpoint, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ estado: nuevoEstado, notas: nuevasNotas })
    });
    if (!resp.ok) {
      let bodyText = null;
      try { bodyText = await resp.text(); } catch (e) { /* ignore */ }
      const msg = bodyText || `HTTP ${resp.status}`;
      throw new Error(msg);
    }

    // actualizar estado local y re-render
    const idx = agendaState.citas.findIndex((c) => c.id === id || c._id === id);
    if (idx >= 0) {
      agendaState.citas[idx].estado = nuevoEstado;
      agendaState.citas[idx].notas = nuevasNotas;
      // volver a agrupar y renderizar
      agendaState.citasPorDia = agruparCitasPorDia(agendaState.citas);
      renderSelectedDay({ openPanel: true });
    }

    agendaElements.editFeedback.textContent = "Guardado correctamente.";
    setTimeout(closeEditModal, 600);
  } catch (err) {
    console.error("Error al guardar cita:", err);
    agendaElements.editFeedback.textContent = "Error al guardar. Intenta de nuevo.";
  }
};

const buildFreeSlotNode = (slot) => {
  const item = document.createElement("div");
  item.className = "apt free";
  item.title = "Añadir cita";
  item.setAttribute("aria-label", "Añadir cita");

  const time = document.createElement("div");
  time.className = "time";
  time.textContent = slot.hora;
  item.appendChild(time);

  const content = document.createElement("div");
  content.className = "content";

  const header = document.createElement("div");
  header.className = "apt-header";

  const title = document.createElement("h3");
  title.textContent = "Espacio libre";
  header.appendChild(title);

  const status = document.createElement("span");
  status.className = "status free";
  status.textContent = "Libre";
  header.appendChild(status);

  content.appendChild(header);

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = "Disponible para nueva cita.";
  content.appendChild(meta);

  item.appendChild(content);
  return item;
};

const renderAppointmentsList = (citas, terminoNormalizado) => {
  const container = agendaElements.appointments;
  if (!container) {
    return;
  }
  container.innerHTML = "";

  if (agendaState.lastError) {
    const message = document.createElement("div");
    message.className = "slot-empty";
    message.textContent = "No se pudieron cargar las citas. Inténtalo más tarde.";
    container.appendChild(message);
    return;
  }

  if (!Array.isArray(citas) || citas.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "slot-empty";
    emptyMessage.textContent =
      terminoNormalizado && terminoNormalizado.length
        ? "No hay citas que coincidan con la búsqueda."
        : container.dataset.empty || "No hay citas para este día.";
    container.appendChild(emptyMessage);
    return;
  }

  const citasPorHora = new Map();
  citas.forEach((cita) => {
    const hora = cita.hora || "";
    if (!citasPorHora.has(hora)) {
      citasPorHora.set(hora, []);
    }
    citasPorHora.get(hora).push(cita);
  });

  const wrapper = document.createElement("div");
  wrapper.className = "slot-columns";

  SLOT_GROUPS.forEach((grupo) => {
    const columna = document.createElement("div");
    columna.className = "slot-column";

    const titulo = document.createElement("h3");
    titulo.className = "slot-section-title";
    titulo.textContent = grupo.label;
    columna.appendChild(titulo);

    let elementosEnColumna = 0;

    grupo.slots.forEach((slot) => {
      const lista = citasPorHora.get(slot.hora) || [];
      if (lista.length === 0) {
        if (terminoNormalizado) {
          return;
        }
        const libre = buildFreeSlotNode(slot);
        columna.appendChild(libre);
        elementosEnColumna += 1;
        return;
      }
      lista.forEach((cita) => {
        const nodo = buildAppointmentNode(cita, slot);
        columna.appendChild(nodo);
        elementosEnColumna += 1;
      });
    });

    if (elementosEnColumna === 0) {
      const vacio = document.createElement("div");
      vacio.className = "slot-empty";
      vacio.textContent = terminoNormalizado
        ? "Sin coincidencias en este bloque."
        : "Sin citas programadas.";
      columna.appendChild(vacio);
    }

    wrapper.appendChild(columna);
  });

  const horasRestantes = Array.from(citasPorHora.keys()).filter(
    (hora) => !SLOT_TIMES_SET.has(hora)
  );

  if (horasRestantes.length) {
    const columnaExtra = document.createElement("div");
    columnaExtra.className = "slot-column";

    const tituloExtra = document.createElement("h3");
    tituloExtra.className = "slot-section-title";
    tituloExtra.textContent = "Otras citas";
    columnaExtra.appendChild(tituloExtra);

    horasRestantes
      .sort()
      .forEach((hora) => {
        const lista = citasPorHora.get(hora) || [];
        lista.forEach((cita) => {
          const nodo = buildAppointmentNode(cita, { hora });
          columnaExtra.appendChild(nodo);
        });
      });

    wrapper.appendChild(columnaExtra);
  }

  container.appendChild(wrapper);
};

const openSidePanel = () => {
  if (!agendaElements.sidePanel) {
    return;
  }
  agendaState.panelOpen = true;
  agendaElements.sidePanel.classList.add("is-open");
  agendaElements.sidePanel.setAttribute("aria-hidden", "false");
  if (agendaElements.panelBackdrop) {
    agendaElements.panelBackdrop.hidden = false;
    agendaElements.panelBackdrop.classList.add("is-active");
  }
};

const closeSidePanel = () => {
  if (!agendaElements.sidePanel) {
    return;
  }
  agendaState.panelOpen = false;
  agendaElements.sidePanel.classList.remove("is-open");
  agendaElements.sidePanel.setAttribute("aria-hidden", "true");
  if (agendaElements.panelBackdrop) {
    agendaElements.panelBackdrop.classList.remove("is-active");
    agendaElements.panelBackdrop.hidden = true;
  }
};

const resolvePanelOpenOption = (options) => {
  if (typeof options === "boolean") {
    return options;
  }
  if (options && typeof options === "object" && "openPanel" in options) {
    return Boolean(options.openPanel);
  }
  return agendaState.panelOpen;
};

const renderSelectedDay = (options) => {
  const shouldOpenPanel = resolvePanelOpenOption(options);
  const fechaSeleccionada = agendaState.selectedDate;
  if (agendaElements.prettyDate) {
    agendaElements.prettyDate.textContent = formatPrettyDate(fechaSeleccionada);
  }

  const clave = formatDateKey(fechaSeleccionada);
  const citasDia = agendaState.citasPorDia.get(clave) || [];

  const termino = agendaState.searchTerm ? normalizarTextoPaciente(agendaState.searchTerm) : "";
  const citasFiltradas = termino
    ? citasDia.filter((cita) => {
        const campos = [cita.paciente, cita.motivo, cita.notas, cita.profesionalNombre];
        return campos.some((campo) => normalizarTextoPaciente(campo).includes(termino));
      })
    : citasDia.slice();

  actualizarTotalBadge(citasFiltradas.length);
  renderAppointmentsList(citasFiltradas, termino);

  if (shouldOpenPanel) {
    openSidePanel();
  } else {
    closeSidePanel();
  }
};

const renderCalendarDays = () => {
  const container = agendaElements.days;
  if (!container || !agendaState.monthAnchor) {
    return;
  }

  container.innerHTML = "";

  const firstOfMonth = new Date(
    agendaState.monthAnchor.getFullYear(),
    agendaState.monthAnchor.getMonth(),
    1
  );
  const firstWeekDay = (firstOfMonth.getDay() + 6) % 7; // convertir domingo=6, lunes=0
  const startGrid = new Date(firstOfMonth);
  startGrid.setDate(firstOfMonth.getDate() - firstWeekDay);

  const today = normalizeDate(new Date());

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 42; index += 1) {
    const fecha = new Date(startGrid);
    fecha.setDate(startGrid.getDate() + index);
    const fechaNormalizada = normalizeDate(fecha);
    const esMesActual = fecha.getMonth() === agendaState.monthAnchor.getMonth();
    const clave = formatDateKey(fechaNormalizada);
    const isWeekend = fecha.getDay() === 0 || fecha.getDay() === 6;
    // Para el calendario mostrarmos sólo citas de días laborables dentro del mes
    const citasDia = isWeekend ? [] : agendaState.citasPorDia.get(clave) || [];
    const carga = isWeekend ? "none" : determineLoadLevel(citasDia.length);

    const cell = document.createElement("div");
    cell.className = "day";
    if (!esMesActual) {
      cell.classList.add("placeholder");
    }
    if (isWeekend) {
      cell.classList.add("weekend");
    }
    if (isSameDay(fechaNormalizada, today)) {
      cell.classList.add("today");
    }
    if (isSameDay(fechaNormalizada, agendaState.selectedDate)) {
      cell.classList.add("selected");
    }

    const numero = document.createElement("span");
    numero.className = "num";
    numero.textContent = fecha.getDate();
    cell.appendChild(numero);

    // Sólo mostrar badge si el día pertenece al mes y no es fin de semana
    if (esMesActual && !isWeekend && carga !== "none") {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.dataset.level = carga;
      badge.textContent = String(citasDia.length);
      cell.appendChild(badge);
    }

    const summary = document.createElement("div");
    // Añadir summary sólo si el día pertenece al mes. Para fines de semana del mes
    // mostramos 'Fin de semana' pero no el fondo blanco del día (se estiliza en CSS)
    if (esMesActual) {
      summary.className = "summary";
      summary.dataset.state = citasDia.length ? "filled" : "empty";
      if (isWeekend) {
        summary.textContent = "Fin de semana";
        summary.classList.add("weekend");
      } else {
        summary.textContent = citasDia.length
          ? `${citasDia.length} cita${citasDia.length === 1 ? "" : "s"}`
          : "Sin citas";
      }
      cell.appendChild(summary);
    }

    // Sólo permitir abrir panel si es día del mes y no es fin de semana
    if (esMesActual && !isWeekend) {
      cell.addEventListener("click", () => {
        if (!isSameDay(agendaState.selectedDate, fechaNormalizada)) {
          agendaState.selectedDate = fechaNormalizada;
          renderCalendarDays();
        }
        renderSelectedDay({ openPanel: true });
      });
    } else {
      // Días que no pertenecen al mes o fines de semana no son interactivos
      cell.style.pointerEvents = "none";
    }

    fragment.appendChild(cell);
  }

  container.appendChild(fragment);
};

const renderCalendar = () => {
  updateMonthLabel();
  renderCalendarDays();
};

const poblarProfesionalesSelect = () => {
  const select = agendaElements.professionalSelect;
  if (!select) {
    return;
  }

  const profesionales = new Map(agendaState.profesionales);

  if (usuarioActual?.idUsuario && !profesionales.has(usuarioActual.idUsuario)) {
    profesionales.set(usuarioActual.idUsuario, {
      id: usuarioActual.idUsuario,
      nombre: obtenerNombreProfesional(usuarioActual)
    });
  }

  const datosOrdenados = Array.from(profesionales.values()).sort((a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" })
  );

  const valorPrevio = agendaState.professionalId || usuarioActual?.idUsuario || "";
  select.innerHTML = "";

  if (datosOrdenados.length > 1) {
    const opcionTodos = document.createElement("option");
    opcionTodos.value = "";
    opcionTodos.textContent = "Todos los profesionales";
    select.appendChild(opcionTodos);
  }

  if (datosOrdenados.length === 0) {
    const opcion = document.createElement("option");
    opcion.value = usuarioActual?.idUsuario || "";
    opcion.textContent = obtenerNombreProfesional(usuarioActual) || "Profesional";
    opcion.selected = true;
    select.appendChild(opcion);
    agendaState.professionalId = opcion.value || null;
    return;
  }

  datosOrdenados.forEach((profesional) => {
    const option = document.createElement("option");
    option.value = profesional.id || "";
    option.textContent = profesional.nombre || "Profesional";
    if (option.value && option.value === valorPrevio) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  if (select.value === "" && valorPrevio) {
    select.value = valorPrevio;
  }

  agendaState.professionalId = select.value || null;
};

const procesarCitas = (citas) => {
  const normalizadas = Array.isArray(citas)
    ? citas
        .map((cita) => normalizarCita(cita))
        .filter((cita) => cita && cita.fecha && cita.fechaClave)
    : [];

  agendaState.citas = normalizadas;
  agendaState.citasPorDia = agruparCitasPorDia(normalizadas);
  agendaState.profesionales.clear();

  normalizadas.forEach((cita) => {
    if (cita.profesionalId) {
      agendaState.profesionales.set(cita.profesionalId, {
        id: cita.profesionalId,
        nombre: cita.profesionalNombre || "Profesional"
      });
    }
  });

  poblarProfesionalesSelect();
};

const cargarCitasMensuales = async (options) => {
  if (!agendaState.monthAnchor) {
    agendaState.monthAnchor = new Date(
      agendaState.selectedDate.getFullYear(),
      agendaState.selectedDate.getMonth(),
      1
    );
  }

  const shouldOpenPanel = resolvePanelOpenOption(options);
  setLoading(true);
  agendaState.lastError = null;

  const inicioMes = new Date(
    agendaState.monthAnchor.getFullYear(),
    agendaState.monthAnchor.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
  const finMes = new Date(
    agendaState.monthAnchor.getFullYear(),
    agendaState.monthAnchor.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const params = new URLSearchParams({
    fechaDesde: inicioMes.toISOString(),
    fechaHasta: finMes.toISOString()
  });

  if (agendaState.professionalId) {
    params.set("idUsuario", agendaState.professionalId);
  }

  try {
    const citas = await fetchJson(`/citas?${params.toString()}`);
    procesarCitas(Array.isArray(citas) ? citas : []);
    renderCalendar();
    renderSelectedDay(shouldOpenPanel);
  } catch (error) {
    console.error("No se pudieron cargar las citas:", error);
    agendaState.lastError = error;
    agendaState.citas = [];
    agendaState.citasPorDia = new Map();
    renderCalendar();
    renderSelectedDay(shouldOpenPanel);
  } finally {
    setLoading(false);
  }
};

const moverMes = (delta) => {
  const base = agendaState.monthAnchor || normalizeDate(new Date());
  const nuevaAncla = new Date(base.getFullYear(), base.getMonth() + delta, 1);
  agendaState.monthAnchor = nuevaAncla;

  const diasEnMes = new Date(nuevaAncla.getFullYear(), nuevaAncla.getMonth() + 1, 0).getDate();
  const diaSeleccionado = Math.min(agendaState.selectedDate.getDate(), diasEnMes);
  agendaState.selectedDate = new Date(
    nuevaAncla.getFullYear(),
    nuevaAncla.getMonth(),
    diaSeleccionado
  );

  cargarCitasMensuales(agendaState.panelOpen);
};

const handleSearchInput = (event) => {
  agendaState.searchTerm = event.target.value || "";
  renderSelectedDay({ openPanel: true });
};

const attachEventListeners = () => {
  if (agendaElements.todayBtn) {
    agendaElements.todayBtn.addEventListener("click", () => {
      const hoy = normalizeDate(new Date());
      agendaState.selectedDate = hoy;
      agendaState.monthAnchor = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      cargarCitasMensuales(agendaState.panelOpen);
    });
  }

  if (agendaElements.prevBtn) {
    agendaElements.prevBtn.addEventListener("click", () => moverMes(-1));
  }

  if (agendaElements.nextBtn) {
    agendaElements.nextBtn.addEventListener("click", () => moverMes(1));
  }

  if (agendaElements.professionalSelect) {
    agendaElements.professionalSelect.addEventListener("change", (event) => {
      const value = event.target.value;
      agendaState.professionalId = value || null;
      if (agendaState.professionalId) {
        actualizarUsuarioLocal({ idUsuario: agendaState.professionalId });
      }
      cargarCitasMensuales(agendaState.panelOpen);
    });
  }

  if (agendaElements.searchInput) {
    agendaElements.searchInput.addEventListener("input", handleSearchInput);
  }

  if (agendaElements.closePanelBtn) {
    agendaElements.closePanelBtn.addEventListener("click", () => {
      closeSidePanel();
    });
  }

  if (agendaElements.panelBackdrop) {
    agendaElements.panelBackdrop.addEventListener("click", () => {
      closeSidePanel();
    });
  }

  // edit modal listeners
  if (agendaElements.closeEditBtn) {
    agendaElements.closeEditBtn.addEventListener("click", () => closeEditModal());
  }
  if (agendaElements.cancelEditBtn) {
    agendaElements.cancelEditBtn.addEventListener("click", () => closeEditModal());
  }
  if (agendaElements.editForm) {
    agendaElements.editForm.addEventListener("submit", handleEditFormSubmit);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && agendaState.panelOpen) {
      closeSidePanel();
    }
  });
};

const initAgenda = () => {
  cacheAgendaElements();
  renderDow();

  const user = getStoredUser();
  if (!user) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  usuarioActual = user;
  agendaState.professionalId = user.idUsuario || null;
  agendaState.selectedDate = normalizeDate(new Date());
  agendaState.monthAnchor = new Date(
    agendaState.selectedDate.getFullYear(),
    agendaState.selectedDate.getMonth(),
    1
  );

  attachEventListeners();
  poblarProfesionalesSelect();
  renderCalendar();
  cargarCitasMensuales(false);
};

document.addEventListener("DOMContentLoaded", () => {
  initAgenda();
});