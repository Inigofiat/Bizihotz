"use strict";



const API_BASE_URL = (() => {
  const host = (window.location.hostname || "").toLowerCase();
  if (window.location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "") {
    return "http://localhost:5000/gestion";
  }
  return `${window.location.protocol}//${window.location.host}/gestion`;
})();

const API_FALLBACK_URL = null;

const API_URL = `${API_BASE_URL}/api`;
const API_FALLBACK = null;
const LOGIN_PAGE = "login.html";
const HISTORIAL_PAGE = "historialClinico.html";

const unique = (values) => [...new Set(values.filter(Boolean))];

const resolveNutritionBase = () => {
  if (window.location.protocol === "file:") {
    return "http://localhost:5000/nutricion";
  }
  const host = window.location.hostname || "localhost";
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:5000/nutricion";
  }
  return `${window.location.protocol}//${window.location.host}/nutricion`;
};

const NUTRICION_API_BASES = unique([resolveNutritionBase()]).map((base) => `${base}/api`);

const SLOT_DURATION_MINUTES = 45;
const HORARIO_BLOQUES = [
  { inicio: { horas: 9, minutos: 0 }, fin: { horas: 14, minutos: 0 } },
  { inicio: { horas: 15, minutos: 0 }, fin: { horas: 20, minutos: 0 } }
];


const modalCitaState = {

  cache: new Map()

};

let usuarioActual = null;

let pacienteId = null;
let pacienteActual = null;
let registroAntSeleccionado = null;
let dietaActualSeleccionada = null;


const elements = {

  back: null,

  nombre: null,

  meta: null,

  badges: null,

  detalleNombre: null,

  detalleNacimiento: null,

  detalleEmail: null,

  detalleTelefono: null,

  detalleActualizacion: null,

  proximasCitas: null,

  tablaCitas: null,

  citasTotal: null,

  antResumenBadge: null,

  antResumen: null,

  antUltimaMedicion: null,

  antPesoActual: null,

  antVariacion30d: null,

  antImcActual: null,

  antGrasaActual: null,

  tablaAntropometria: null,

  antModal: null,

  antForm: null,

  antFecha: null,

  antPeso: null,

  antAltura: null,

  antImc: null,

  antGrasa: null,

  antObservaciones: null,

  antFeedback: null,

  antAbrirBtn: null,

  antCerrarBtn: null,

  antCancelarBtn: null,

  antDeleteModal: null,

  antDeleteMessage: null,

  antDeleteConfirm: null,

  antDeleteCancel: null,

  antDeleteClose: null,

  citaModal: null,

  citaForm: null,

  citaFecha: null,

  citaHora: null,

  citaTipo: null,

  citaNotas: null,

  citaFeedback: null,

  citaAbrirBtn: null,

  citaCerrarBtn: null,

  citaCancelarBtn: null,

  citaDisponibilidad: null,
  agendaLink: null,
  dietCard: null,
  dietSummary: null,
  dietButton: null,
  dietSaveButton: null,
  dietHistoryButton: null,
  dietHistoryModal: null,
  dietHistoryContent: null,
  dietHistoryClose: null,
  historialLista: null,
  historialTotal: null,
  bajaBtn: null,
  reactivarBtn: null
};


const getStoredUser = () => {

  try {

    const raw = localStorage.getItem("bizihotzUsuario");

    if (!raw) return null;

    return JSON.parse(raw);

  } catch (error) {

    console.warn("No se pudo interpretar el usuario guardado:", error);

    return null;

  }

};



const buildHeaders = (baseHeaders = {}) => {

  const headers = Object.assign({ Accept: "application/json" }, baseHeaders || {});

  try {

    const token =

      (usuarioActual && (usuarioActual.token || usuarioActual.accessToken || usuarioActual.authToken)) ||

      (() => {

        const stored = getStoredUser();

        return stored ? stored.token || stored.accessToken || stored.authToken : null;

      })();

    if (token) {

      headers.Authorization = `Bearer ${token}`;

    }

  } catch (error) {

    console.warn("No se pudo preparar Authorization:", error);

  }

  return headers;

};



const requestJson = async (path, options = {}) => {

  const endpoints = [`${API_URL}${path}`];

  if (API_FALLBACK && API_FALLBACK !== API_URL) {

    endpoints.push(`${API_FALLBACK}${path}`);

  }



  let lastError = null;



  for (let index = 0; index < endpoints.length; index += 1) {

    const endpoint = endpoints[index];

    const isLast = index === endpoints.length - 1;



    try {

      const headers = buildHeaders(options.headers);

      const response = await fetch(endpoint, { ...options, headers });

      if (!response.ok) {

        let errMsg = `HTTP ${response.status}`;

        try {

          const text = await response.text();

          if (text) {

            try {

              const json = JSON.parse(text);

              errMsg = json?.mensaje || json?.message || text;

            } catch {

              errMsg = text;

            }

          }

        } catch {

          // noop

        }

        const error = new Error(errMsg);

        error.status = response.status;

        throw error;

      }

      if (response.status === 204) {

        return null;

      }

      const text = await response.text();

      return text ? JSON.parse(text) : null;

    } catch (error) {

      lastError = error;

      if (isLast) throw error;

    }

  }



  if (lastError) throw lastError;

  throw new Error("No se pudo completar la petici├│n.");

};



const requestNutritionJson = async (path, options = {}) => {
  const endpoints = NUTRICION_API_BASES.map((base) => `${base}${path}`);
  let lastError = null;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    const isLast = index === endpoints.length - 1;

    try {
      const headers = buildHeaders(options.headers);
      const response = await fetch(endpoint, { ...options, headers });
      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const text = await response.text();
          if (text) {
            try {
              const json = JSON.parse(text);
              errMsg = json?.mensaje || json?.message || text;
            } catch {
              errMsg = text;
            }
          }
        } catch {
          // noop
        }
        const error = new Error(errMsg);
        error.status = response.status;
        throw error;
      }
      if (response.status === 204) {
        return null;
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      lastError = error;
      if (isLast) throw error;
    }
  }

  if (lastError) throw lastError;
  throw new Error("No se pudo completar la petici├│n.");
};


const formatDate = (value, options = {}) => {
  if (!value) return "";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) return "";

  const opts = Object.assign(

    { day: "2-digit", month: "2-digit", year: "numeric" },

    options

  );

  return fecha.toLocaleDateString("es-ES", opts);

};



const formatDatetime = (value) => {

  if (!value) return "";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) return "";

  return fecha.toLocaleString("es-ES", {

    day: "2-digit",

    month: "short",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit"

  });

};



const calculateAge = (fechaNac) => {

  if (!fechaNac) return "";

  const nacimiento = new Date(fechaNac);

  if (Number.isNaN(nacimiento.getTime())) return "";

  const hoy = new Date();

  let edad = hoy.getFullYear() - nacimiento.getFullYear();

  const mes = hoy.getMonth() - nacimiento.getMonth();

  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {

    edad -= 1;

  }

  return edad;

};

const isPacienteEnStandby = (paciente) => {
  const estado = (paciente?.estado || "").toLowerCase();
  return estado === "standby" || estado === "baja";
};



const formatNumber = (value, decimals = 2) => {

  if (typeof value !== "number" || Number.isNaN(value)) {

    return "N/D";

  }

  return value.toFixed(decimals).replace(".", ",");

};



const formatDiff = (value) => {

  if (typeof value !== "number" || Number.isNaN(value)) {

    return "";

  }

  if (value === 0) {

    return "Sin cambio";

  }

  const prefix = value > 0 ? "+" : "-";

  const absValue = Math.abs(value);

  return `${prefix}${absValue.toFixed(2).replace(".", ",")} kg en 30 d├¡as`;

};



const getNutricionPacienteId = (paciente) => {

  if (!paciente || typeof paciente !== "object") {

    return null;

  }



  const candidates = [

    paciente.nutricionId,

    paciente.idNutricion,

    paciente.codigoNutricion,

    paciente.numeroNutricion,

    paciente.pacienteNutricionId,

    paciente.paciente_id,

    paciente.numeroHistoria,

    paciente.numeroExpediente,

    paciente.numeroPaciente,

    paciente.idPaciente,

    paciente.id

  ];



  for (const candidate of candidates) {

    if (candidate === null || candidate === undefined) continue;

    if (typeof candidate === "number" && Number.isFinite(candidate)) {

      return candidate;

    }

    if (typeof candidate === "string") {

      const trimmed = candidate.trim();

      if (/^\d+$/.test(trimmed)) {

        return Number.parseInt(trimmed, 10);

      }

    }

  }



  return null;

};



const escapeHtml = (value) => {
  if (value === null || typeof value === "undefined") {

    return "";

  }

  return String(value)

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#39;");

};



const renderBadges = (paciente) => {
  if (!elements.badges) return;
  const badges = [];

  if (isPacienteEnStandby(paciente)) {
    const fecha = paciente.fechaBaja ? ` - ${formatDate(paciente.fechaBaja)}` : "";
    badges.push(`<span class="badge danger">En standby${fecha}</span>`);
  } else {
    badges.push(`<span class="badge">Activo</span>`);
  }

  const edad = calculateAge(paciente.fechaNac);

  if (Number.isInteger(edad)) {

    badges.push(`<span class="badge">${edad} años</span>`);

  }

  if (paciente.createdAt) {

    badges.push(`<span class="badge">Alta: ${formatDate(paciente.createdAt)}</span>`);

  }

  if (paciente.updatedAt) {

    badges.push(`<span class="badge">Actualizado: ${formatDate(paciente.updatedAt)}</span>`);

  }



  elements.badges.innerHTML = badges.join("");

};



const renderPaciente = (paciente) => {

  pacienteActual = paciente;
  const nombre = `${paciente.nombrePaciente || ""} ${paciente.apellidos || ""}`.trim() || "Paciente";
  if (elements.nombre) {

    elements.nombre.textContent = nombre;

  }

  if (elements.meta) {

    const email = paciente.emailPaciente || "Sin email";

    const telefono = paciente.telefono || "Sin tel├®fono";

    elements.meta.textContent = `${email} - ${telefono}`;

  }



  if (elements.detalleNombre) {

    elements.detalleNombre.textContent = nombre;

  }

  if (elements.detalleNacimiento) {

    const fecha = paciente.fechaNac ? formatDate(paciente.fechaNac) : "N/D";

    const edad = calculateAge(paciente.fechaNac);

    elements.detalleNacimiento.textContent = edad ? `${fecha} (${edad} años)` : fecha;

  }

  if (elements.detalleEmail) {

    elements.detalleEmail.textContent = paciente.emailPaciente || "N/D";

  }

  if (elements.detalleTelefono) {

    elements.detalleTelefono.textContent = paciente.telefono || "N/D";

  }

  if (elements.detalleActualizacion) {

    elements.detalleActualizacion.textContent = formatDatetime(paciente.updatedAt) || "N/D";

  }



  renderBadges(paciente);
  updateAccionesPaciente(paciente);
};



const getEstadoClass = (estado = "") => {

  const normalizado = estado.toLowerCase();

  if (normalizado.includes("cancel")) {

    return "status-pill is-cancelled";

  }

  if (normalizado.includes("atend") || normalizado.includes("hecho") || normalizado.includes("done")) {

    return "status-pill is-done";

  }

  return "status-pill is-pending";

};



const updateAccionesPaciente = (paciente) => {
  if (!elements.bajaBtn || !elements.reactivarBtn) return;
  const enStandby = isPacienteEnStandby(paciente);
  elements.bajaBtn.hidden = enStandby;
  elements.reactivarBtn.hidden = !enStandby;
  elements.bajaBtn.disabled = false;
  elements.reactivarBtn.disabled = false;
};



const renderProximasCitas = (citas) => {

  const container = elements.proximasCitas;

  if (!container) return;



  if (!Array.isArray(citas) || citas.length === 0) {

    container.innerHTML = "";

    container.dataset.empty = "No hay citas programadas.";

    return;

  }



  const contenido = citas

    .map((cita) => {

      const fecha = formatDate(cita.fechaCita, { day: "2-digit", month: "short", year: "numeric" });

      const hora = cita.hora || "--:--";

      const profesional = escapeHtml(cita.profesional || "Profesional");

      const tipo = escapeHtml(cita.tipoConsulta || "Consulta");

      const estado = escapeHtml(cita.estado || "Pendiente");

      return `<div class="appointment-card">

        <div class="title">${tipo}</div>

        <div class="meta">

          <span>${fecha} - ${hora}</span>

          <span>${profesional}</span>

          <span class="badge">${estado}</span>

        </div>

      </div>`;

    })

    .join("");



  container.innerHTML = contenido;

  if (container.dataset) {

    container.dataset.empty = "";

  }

};



const renderTodasLasCitas = (citas) => {

  const body = elements.tablaCitas;

  if (!body) return;



  if (!Array.isArray(citas) || citas.length === 0) {

    const empty = body.dataset.empty || "No hay citas registradas.";

    body.innerHTML = `<tr><td colspan="6">${empty}</td></tr>`;

    if (elements.citasTotal) {

      elements.citasTotal.textContent = "";

    }

    return;

  }



  const rows = citas

    .map((cita) => {

      const fecha = formatDate(cita.fechaCita, { day: "2-digit", month: "short", year: "numeric" });

      const hora = cita.hora || "--:--";

      const profesional = cita.profesional || "Profesional";

      const motivo = cita.motivo || cita.tipoConsulta || "Consulta";

      const estado = cita.estado || (cita.atendida ? "Atendida" : "Pendiente");

      const notas =

        cita.notas && cita.notas.trim()

          ? escapeHtml(cita.notas.trim()).replace(/\n/g, "<br />")

          : "N/D";



      return `<tr>

        <td>${fecha}</td>

        <td>${hora}</td>

        <td>${escapeHtml(profesional)}</td>

        <td>${escapeHtml(motivo)}</td>

        <td><span class="${getEstadoClass(estado)}">${escapeHtml(estado)}</span></td>

        <td>${notas}</td>

      </tr>`;

    })

    .join("");



  body.innerHTML = rows;

  if (elements.citasTotal) {

    elements.citasTotal.textContent = `${citas.length} cita${citas.length === 1 ? "" : "s"}`;

  }

};



const renderRegistrosAntropometricos = (payload) => {

  const registros = Array.isArray(payload?.registros) ? payload.registros : [];

  const resumen = payload?.resumen || null;



  if (elements.antResumenBadge) {

    elements.antResumenBadge.textContent = `${registros.length} registro${registros.length === 1 ? "" : "s"}`;

  }



  if (elements.antUltimaMedicion) {

    elements.antUltimaMedicion.textContent = resumen?.fechaUltimaMedicion

      ? formatDate(resumen.fechaUltimaMedicion, { day: "2-digit", month: "short", year: "numeric" })

      : "N/D";

  }

  if (elements.antPesoActual) {

    elements.antPesoActual.textContent = resumen?.pesoActual !== undefined ? `${formatNumber(resumen.pesoActual)} kg` : "N/D";

  }

  if (elements.antVariacion30d) {

    elements.antVariacion30d.textContent = resumen?.variacion30Dias !== null && resumen?.variacion30Dias !== undefined

      ? formatDiff(resumen.variacion30Dias)

      : "";

  }

  if (elements.antImcActual) {

    elements.antImcActual.textContent = resumen?.imcActual !== undefined ? formatNumber(resumen.imcActual) : "N/D";

  }

  if (elements.antGrasaActual) {

    elements.antGrasaActual.textContent =

      resumen?.grasaCorporal !== undefined && resumen?.grasaCorporal !== null

        ? `${formatNumber(resumen.grasaCorporal)} %`

        : "N/D";

  }



  if (elements.antResumen) {

    elements.antResumen.dataset.empty = registros.length ? "" : "Sin registros.";

  }



  const body = elements.tablaAntropometria;

  if (!body) return;



  if (!registros.length) {

    const empty = body.dataset.empty || "No hay registros antropom├®tricos.";

    body.innerHTML = `<tr><td colspan="6">${empty}</td></tr>`;

    return;

  }



  const rows = registros

    .map((registro) => {

      const fecha = formatDate(registro.fechaMedicion, { day: "2-digit", month: "short", year: "numeric" });

      const peso = registro.peso !== undefined ? formatNumber(registro.peso) : "N/D";

      const altura = registro.altura !== undefined ? formatNumber(registro.altura) : "N/D";

      const imc = registro.imc !== undefined ? formatNumber(registro.imc) : "N/D";

      const grasa =

        registro.grasaCorporal !== undefined && registro.grasaCorporal !== null

          ? formatNumber(registro.grasaCorporal)

          : "N/D";



      const profesional = registro.profesional ? `<strong>${escapeHtml(registro.profesional)}</strong>` : "";

      const observaciones =

        registro.observaciones && registro.observaciones.trim()

          ? `<div class="obs-text">${escapeHtml(registro.observaciones.trim()).replace(/\n/g, "<br />")}</div>`

          : "";

      const detalle = profesional || observaciones ? `${profesional}${observaciones}` : "N/D";



      return `<tr>

        <td>${fecha}</td>

        <td>${peso}</td>

        <td>${altura}</td>

        <td>${imc}</td>

        <td>${grasa}</td>

        <td>${detalle}</td>

        <td class="table-actions">

          <button type="button"

            class="link-btn"

            data-action="delete-registro"

            data-id="${registro.idMedicion || ""}"

            data-fecha="${fecha}">

            Eliminar

          </button>

        </td>

      </tr>`;

    })

    .join("");



  body.innerHTML = rows;

};



const updateImcField = () => {

  if (!elements.antPeso || !elements.antAltura || !elements.antImc) return;

  const peso = Number.parseFloat(elements.antPeso.value);

  const altura = Number.parseFloat(elements.antAltura.value);

  if (!Number.isNaN(peso) && !Number.isNaN(altura) && altura > 0) {

    const imc = peso / (altura * altura);

    elements.antImc.value = imc ? imc.toFixed(2) : "";

  }

};



const openCitaModal = () => {

  if (!elements.citaModal) return;

  setCitaFeedback("", false);

  if (elements.citaForm) {

    elements.citaForm.reset();

  }

  resetHoraSelect();

  setDisponibilidadHint("Selecciona una fecha para consultar los huecos disponibles.");



  const hoy = new Date();

  const iso = hoy.toISOString().slice(0, 10);

  if (elements.citaFecha) {

    elements.citaFecha.min = iso;

    elements.citaFecha.value = iso;

    modalCitaState.cache.delete(getFechaClave(hoy));

  }



  document.body.classList.add("modal-open");

  elements.citaModal.hidden = false;

  actualizarHorasDisponibles();



  window.setTimeout(() => {

    if (elements.citaFecha) {

      elements.citaFecha.focus();

    } else if (elements.citaHora && !elements.citaHora.disabled) {

      elements.citaHora.focus();

    } else if (elements.citaTipo) {

      elements.citaTipo.focus();

    }

  }, 0);

};



const closeCitaModal = () => {

  if (!elements.citaModal) return;

  elements.citaModal.hidden = true;

  document.body.classList.remove("modal-open");

  setDisponibilidadHint("");

  resetHoraSelect();

};



const setCitaFeedback = (message, isSuccess = false) => {

  if (!elements.citaFeedback) return;

  elements.citaFeedback.textContent = message || "";

  elements.citaFeedback.classList.toggle("success", Boolean(isSuccess));



};



const padTimeUnit = (value) => String(value).padStart(2, "0");



const generarHorariosBase = () => {

  const slots = [];

  HORARIO_BLOQUES.forEach((bloque) => {

    const inicio = bloque.inicio.horas * 60 + bloque.inicio.minutos;

    const fin = bloque.fin.horas * 60 + bloque.fin.minutos;

    for (let minutos = inicio; minutos < fin; minutos += SLOT_DURATION_MINUTES) {

      const horas = Math.floor(minutos / 60);

      const resto = minutos % 60;

      slots.push(`${padTimeUnit(horas)}:${padTimeUnit(resto)}`);

    }

  });

  return slots;

};



const resetHoraSelect = () => {

  if (!elements.citaHora) return;

  elements.citaHora.innerHTML = '<option value="" disabled selected>Selecciona un horario</option>';

  elements.citaHora.disabled = true;

};



const setDisponibilidadHint = (message, variant = "neutral") => {

  if (!elements.citaDisponibilidad) return;

  elements.citaDisponibilidad.textContent = message || "";

  elements.citaDisponibilidad.classList.remove("success", "error");

  if (variant === "success") {

    elements.citaDisponibilidad.classList.add("success");

  } else if (variant === "error") {

    elements.citaDisponibilidad.classList.add("error");

  }

};



const getFechaClave = (fecha) => {

  const year = fecha.getFullYear();

  const month = padTimeUnit(fecha.getMonth() + 1);

  const day = padTimeUnit(fecha.getDate());

  return `${year}-${month}-${day}`;

};



const fetchHorasOcupadas = async (fecha) => {

  const clave = getFechaClave(fecha);

  if (modalCitaState.cache.has(clave)) {

    return modalCitaState.cache.get(clave);

  }



  if (!usuarioActual?.idUsuario) {

    const vacio = new Set();

    modalCitaState.cache.set(clave, vacio);

    return vacio;

  }



  const inicio = new Date(fecha);

  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(inicio);

  fin.setHours(23, 59, 59, 999);



  const params = new URLSearchParams({

    idUsuario: usuarioActual.idUsuario,

    fechaDesde: inicio.toISOString(),

    fechaHasta: fin.toISOString()

  });



  const resultado = await requestJson(`/citas?${params.toString()}`);

  const horasOcupadas = new Set();

  if (Array.isArray(resultado)) {

    resultado.forEach((cita) => {

      if (!cita || typeof cita.hora !== "string") {

        return;

      }

      const hora = cita.hora.trim().slice(0, 5);

      if (hora) {

        horasOcupadas.add(hora);

      }

    });

  }



  modalCitaState.cache.set(clave, horasOcupadas);

  return horasOcupadas;

};



const actualizarHorasDisponibles = async () => {

  if (!elements.citaFecha || !elements.citaHora) {

    return;

  }



  const valorFecha = elements.citaFecha.value;

  if (!valorFecha) {

    resetHoraSelect();

    setDisponibilidadHint("Selecciona una fecha para consultar los huecos disponibles.");

    return;

  }



  const fecha = new Date(`${valorFecha}T00:00:00`);

  if (Number.isNaN(fecha.getTime())) {

    resetHoraSelect();

    setDisponibilidadHint("La fecha seleccionada no es v├ílida.", "error");

    return;

  }



  setDisponibilidadHint("Consultando horarios disponibles...");

  elements.citaHora.disabled = true;

  elements.citaHora.innerHTML = '<option value="" disabled>Cargando horarios...</option>';



  try {

    const slots = generarHorariosBase();

    if (!slots.length) {

      resetHoraSelect();

      setDisponibilidadHint("No hay horarios configurados en la agenda.", "error");

      return;

    }



    const horasOcupadas = await fetchHorasOcupadas(fecha);

    let disponibles = 0;

    const opciones = [];



    slots.forEach((slot) => {

      const ocupado = horasOcupadas.has(slot);

      if (!ocupado) {

        disponibles += 1;

      }

      const etiqueta = `${slot} h${ocupado ? " (Ocupado)" : ""}`;

      opciones.push(`<option value="${slot}"${ocupado ? " disabled" : ""}>${etiqueta}</option>`);

    });



    if (disponibles === 0) {

      elements.citaHora.innerHTML = `<option value="" disabled selected>Sin horarios disponibles</option>${opciones.join("")}`;

      elements.citaHora.disabled = true;

      setDisponibilidadHint("No quedan horarios libres para esa fecha. Revisa la agenda principal.", "error");

      return;

    }



    elements.citaHora.innerHTML = `<option value="" disabled>Selecciona un horario</option>${opciones.join("")}`;

    elements.citaHora.disabled = false;



    const primerDisponible = slots.find((slot) => !horasOcupadas.has(slot));

    if (primerDisponible) {

      elements.citaHora.value = primerDisponible;

    } else {

      elements.citaHora.value = "";

    }



    setDisponibilidadHint(

      `Quedan ${disponibles} horario${disponibles === 1 ? "" : "s"} libres para esa fecha.`,

      "success"

    );

  } catch (error) {

    console.error("No se pudo obtener la disponibilidad de citas:", error);

    resetHoraSelect();

    setDisponibilidadHint(

      "No se pudo consultar la agenda. Intenta de nuevo o abre la agenda principal.",

      "error"

    );

  }

};



const handleCitaFechaChange = () => {

  if (elements.citaFecha) {

    const valorFecha = elements.citaFecha.value;

    if (valorFecha) {

      const fecha = new Date(`${valorFecha}T00:00:00`);

      if (!Number.isNaN(fecha.getTime())) {

        modalCitaState.cache.delete(getFechaClave(fecha));

      }

    }

  }

  actualizarHorasDisponibles();

};



const serializeCitaForm = () => ({

  fecha: elements.citaFecha?.value || "",

  hora: elements.citaHora?.value || "",

  tipo: elements.citaTipo?.value?.trim() || "",

  notas: elements.citaNotas?.value?.trim() || ""

});



const validateCitaForm = (data) => {

  if (!data.fecha) return "Selecciona la fecha de la cita.";

  const fecha = new Date(data.fecha);

  const fechaClave = getFechaClave(fecha);

  if (Number.isNaN(fecha.getTime())) return "La fecha indicada no es v├ílida.";

  if (!data.hora) return "Selecciona un horario disponible.";

  if (!data.tipo) return "Introduce el tipo de consulta.";

  return null;

};



const handleCitaFormSubmit = async (event) => {

  event.preventDefault();

  if (!usuarioActual?.idUsuario) {

    setCitaFeedback("No se pudo determinar el profesional actual.", false);

    return;

  }

  const data = serializeCitaForm();

  const error = validateCitaForm(data);

  if (error) {

    setCitaFeedback(error, false);

    return;

  }

  const fecha = new Date(data.fecha);

  fecha.setHours(0, 0, 0, 0);

  const payload = {

    fechaCita: fecha.toISOString(),

    hora: data.hora,

    tipoConsulta: data.tipo,

    notas: data.notas,

    idPaciente: pacienteId,

    idUsuario: usuarioActual.idUsuario

  };

  setCitaFeedback("", false);

  try {

    await requestJson("/citas", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(payload)

    });

    modalCitaState.cache.delete(fechaClave);

    setCitaFeedback("Cita creada correctamente.", true);

    setTimeout(() => {

      closeCitaModal();

      loadPaciente();

    }, 600);

  } catch (errorSubmit) {

    console.error("No se pudo crear la cita:", errorSubmit);

    setCitaFeedback(errorSubmit?.message || "No se pudo crear la cita.", false);

  }

};

const openAntModal = () => {

  if (!elements.antModal) return;

  elements.antFeedback?.classList.remove("success");

  if (elements.antFeedback) elements.antFeedback.textContent = "";

  if (elements.antForm) elements.antForm.reset();



  const today = new Date();

  const iso = today.toISOString().slice(0, 10);

  if (elements.antFecha) elements.antFecha.value = iso;



  elements.antModal.hidden = false;

  document.body.classList.add("modal-open");

};



const closeAntModal = () => {

  if (!elements.antModal) return;

  elements.antModal.hidden = true;

  document.body.classList.remove("modal-open");

};



const setAntFeedback = (message, isSuccess = false) => {

  if (!elements.antFeedback) return;

  elements.antFeedback.textContent = message || "";

  elements.antFeedback.classList.toggle("success", Boolean(isSuccess));

};



const openDeleteModal = (registro) => {

  if (!elements.antDeleteModal || !registro) return;

  registroAntSeleccionado = registro;

  if (elements.antDeleteMessage) {

    elements.antDeleteMessage.textContent = `┬┐Seguro que deseas eliminar el registro del ${registro.fecha}?`;

  }

  elements.antDeleteModal.hidden = false;

  document.body.classList.add("modal-open");

};



const closeDeleteModal = () => {

  if (!elements.antDeleteModal) return;

  elements.antDeleteModal.hidden = true;

  document.body.classList.remove("modal-open");

  registroAntSeleccionado = null;

};



const serializeAntropometria = () => {

  const fecha = elements.antFecha?.value || "";

  const peso = elements.antPeso?.value ? Number.parseFloat(elements.antPeso.value) : NaN;

  const altura = elements.antAltura?.value ? Number.parseFloat(elements.antAltura.value) : NaN;

  let imc = elements.antImc?.value ? Number.parseFloat(elements.antImc.value) : NaN;

  const grasa = elements.antGrasa?.value ? Number.parseFloat(elements.antGrasa.value) : null;

  const observaciones = elements.antObservaciones?.value?.trim() || "";



  if (Number.isNaN(imc) && !Number.isNaN(peso) && !Number.isNaN(altura) && altura > 0) {

    imc = peso / (altura * altura);

  }



  return {

    fechaMedicion: fecha,

    peso,

    altura,

    imc,

    grasaCorporal: grasa,

    observaciones

  };

};



const validateAntropometria = (data) => {

  if (!data.fechaMedicion) return "Selecciona la fecha de medici├│n.";

  const fecha = new Date(data.fechaMedicion);

  if (Number.isNaN(fecha.getTime())) return "La fecha de medici├│n no es v├ílida.";

  if (Number.isNaN(data.peso) || data.peso <= 0) return "Introduce un peso v├ílido.";

  if (Number.isNaN(data.altura) || data.altura <= 0) return "Introduce una altura v├ílida.";

  if (Number.isNaN(data.imc) || data.imc <= 0) return "El IMC calculado no es v├ílido.";

  if (data.grasaCorporal !== null && (Number.isNaN(data.grasaCorporal) || data.grasaCorporal < 0)) {

    return "La grasa corporal debe ser un porcentaje positivo.";

  }

  return null;

};



const renderHistorial = (historial) => {

  const container = elements.historialLista;

  if (!container) return;



  if (!Array.isArray(historial) || historial.length === 0) {

    container.innerHTML = "";

    container.dataset.empty = "Sin anotaciones registradas.";

    if (elements.historialTotal) {

      elements.historialTotal.textContent = "";

    }

    return;

  }



  const items = historial

    .map((entrada) => {

      const fecha = formatDatetime(entrada.fechaActualizacion);

      const profesional = escapeHtml(entrada.profesional || "Profesional");

      const citaInfo = entrada.cita

        ? `Consulta ${formatDate(entrada.cita.fechaCita)} - ${escapeHtml(entrada.cita.tipoConsulta || "")}`

        : null;

      const observaciones =

        entrada.observaciones && entrada.observaciones.trim()

          ? escapeHtml(entrada.observaciones.trim()).replace(/\n/g, "<br />")

          : "Sin observaciones";

      return `<article class="timeline-item">

        <header class="timeline-head">

          <span class="date">${fecha}</span>

          <span>-</span>

          <span>${profesional}</span>

        </header>

        <div class="timeline-body">${observaciones}</div>

        ${

          citaInfo

            ? `<footer class="timeline-foot">

          ${citaInfo}

        </footer>`

            : ""

        }

      </article>`;

    })

    .join("");



  container.innerHTML = items;

  if (elements.historialTotal) {

    elements.historialTotal.textContent = `${historial.length} registro${historial.length === 1 ? "" : "s"}`;

  }

  if (container.dataset) {

    container.dataset.empty = "";

  }

};



const handleAntFormSubmit = async (event) => {

  event.preventDefault();

  if (!usuarioActual?.idUsuario) {

    setAntFeedback("No se pudo determinar el profesional actual.", false);

    return;

  }



  const data = serializeAntropometria();

  const error = validateAntropometria(data);

  if (error) {

    setAntFeedback(error, false);

    return;

  }



  setAntFeedback("");



  try {

    await requestJson("/registros", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        fechaMedicion: data.fechaMedicion,

        peso: data.peso,

        altura: data.altura,

        imc: data.imc,

        grasaCorporal: data.grasaCorporal,

        observaciones: data.observaciones,

        idPaciente: pacienteId,

        idUsuario: usuarioActual.idUsuario

      })

    });



    setAntFeedback("Registro guardado correctamente.", true);

    setTimeout(() => {

      closeAntModal();

      loadPaciente();

    }, 600);

  } catch (errorSubmit) {

    console.error("No se pudo guardar el registro antropom├®trico:", errorSubmit);

    setAntFeedback(errorSubmit?.message || "Error guardando el registro.", false);

  }

};



const handleDeleteRegistro = async () => {

  if (!registroAntSeleccionado?.id) {

    closeDeleteModal();

    return;

  }



  try {

    await requestJson(`/registros/${encodeURIComponent(registroAntSeleccionado.id)}`, {

      method: "DELETE"

    });

    closeDeleteModal();

    loadPaciente();

  } catch (error) {

    console.error("No se pudo eliminar el registro antropom├®trico:", error);

    alert(error?.message || "No se pudo eliminar el registro.");

    closeDeleteModal();

  }

};



const darDeBajaPaciente = async () => {
  if (!pacienteId) {
    return;
  }
  if (elements.bajaBtn) {
    elements.bajaBtn.disabled = true;
  }

  const confirmar = window.confirm("¿Quieres poner en standby a este paciente? No se eliminará de la base de datos.");
  if (!confirmar) {
    if (elements.bajaBtn) elements.bajaBtn.disabled = false;
    return;
  }

  try {
    await requestJson(`/pacientes/${encodeURIComponent(pacienteId)}/baja`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    await loadPaciente();
    alert("Paciente pasado a standby correctamente.");
  } catch (error) {
    console.error("No se pudo poner en standby al paciente:", error);
    alert(error?.message || "No se pudo poner en standby al paciente.");
  } finally {
    if (elements.bajaBtn) elements.bajaBtn.disabled = false;
  }
};

const reactivarPaciente = async () => {
  if (!pacienteId) {
    return;
  }
  if (elements.reactivarBtn) {
    elements.reactivarBtn.disabled = true;
  }

  const confirmar = window.confirm("┬┐Quieres reactivar al paciente?");
  if (!confirmar) {
    if (elements.reactivarBtn) elements.reactivarBtn.disabled = false;
    return;
  }

  try {
    await requestJson(`/pacientes/${encodeURIComponent(pacienteId)}/reactivar`, {
      method: "POST"
    });
    await loadPaciente();
    alert("Paciente reactivado correctamente.");
  } catch (error) {
    console.error("No se pudo reactivar al paciente:", error);
    alert(error?.message || "No se pudo reactivar al paciente.");
  } finally {
    if (elements.reactivarBtn) elements.reactivarBtn.disabled = false;
  }
};



const loadPaciente = async () => {

  try {

    const resumen = await requestJson(`/pacientes/${encodeURIComponent(pacienteId)}/resumen`);

    if (!resumen || !resumen.paciente) {

      throw new Error("No se pudo encontrar la ficha del paciente.");

    }

    renderPaciente(resumen.paciente);

    renderProximasCitas(resumen.proximasCitas || []);

    renderTodasLasCitas(resumen.citas || []);

    renderRegistrosAntropometricos(resumen.registrosAntropometricos || null);

    renderHistorial(resumen.historial || []);

    await loadPacienteDietas(resumen.paciente);

    elements.dietButton?.removeAttribute("disabled");
  } catch (error) {

    console.error("No se pudo obtener el paciente:", error);

    alert(error?.message || "No se pudo cargar el paciente.");

    window.location.href = HISTORIAL_PAGE;

  }

};



const handleBack = (event) => {

  event.preventDefault();

  window.location.href = HISTORIAL_PAGE;

};



const init = () => {

  usuarioActual = getStoredUser();

  if (!usuarioActual) {

    window.location.href = LOGIN_PAGE;

    return;

  }



  const params = new URLSearchParams(window.location.search);

  pacienteId = params.get("id");

  if (!pacienteId) {

    window.location.href = HISTORIAL_PAGE;

    return;

  }



  elements.back = document.getElementById("volverHistorial");

  elements.back?.addEventListener("click", handleBack);



  elements.nombre = document.getElementById("pacienteNombre");

  elements.meta = document.getElementById("pacienteMeta");

  elements.badges = document.getElementById("pacienteBadges");
  elements.bajaBtn = document.getElementById("btnBajaPaciente");
  elements.reactivarBtn = document.getElementById("btnReactivarPaciente");
  elements.bajaBtn?.addEventListener("click", darDeBajaPaciente);
  elements.reactivarBtn?.addEventListener("click", reactivarPaciente);

  elements.detalleNombre = document.getElementById("detalleNombre");

  elements.detalleNacimiento = document.getElementById("detalleNacimiento");

  elements.detalleEmail = document.getElementById("detalleEmail");

  elements.detalleTelefono = document.getElementById("detalleTelefono");

  elements.detalleActualizacion = document.getElementById("detalleActualizacion");

  elements.proximasCitas = document.getElementById("proximasCitas");

  elements.tablaCitas = document.getElementById("tablaCitas");

  elements.citasTotal = document.getElementById("citasTotal");

  elements.citaModal = document.getElementById("modalCita");

  elements.citaForm = document.getElementById("formCitaPaciente");

  elements.citaFecha = document.getElementById("citaFecha");

  elements.citaHora = document.getElementById("citaHora");

  if (elements.citaHora) {

    resetHoraSelect();

  }

  elements.citaTipo = document.getElementById("citaTipo");

  elements.citaNotas = document.getElementById("citaNotas");

  elements.citaFeedback = document.getElementById("citaFeedback");

  elements.citaDisponibilidad = document.getElementById("citaDisponibilidad");

  elements.citaAbrirBtn = document.getElementById("abrirModalCita");

  elements.citaCerrarBtn = document.getElementById("cerrarModalCita");

  elements.citaCancelarBtn = document.getElementById("cancelarCitaPaciente");

  elements.agendaLink = document.getElementById("verAgendaPaciente");

  elements.dietCard = document.getElementById("dietPlanCard");

  elements.dietSummary = document.getElementById("pacienteDietas");

  elements.dietButton = document.getElementById("abrirGestorDietas");
  elements.dietSaveButton = document.getElementById("guardarDieta");
  elements.dietHistoryButton = document.getElementById("verHistorialDieta");
  elements.dietHistoryModal = document.getElementById("modalHistorialDieta");
  elements.dietHistoryContent = document.getElementById("historialDietaContenido");
  elements.dietHistoryClose = document.getElementById("cerrarModalHistorialDieta");

  elements.dietButton?.setAttribute("disabled", "disabled");
  setHistorialDietaState(false);

  elements.dietButton?.addEventListener("click", (event) => {
    event.preventDefault();
    const nutricionPacienteId = getNutricionPacienteId(pacienteActual);
    const destino = Number.isFinite(nutricionPacienteId)
      ? "dietas.html?pacienteId=" + encodeURIComponent(nutricionPacienteId)
      : "dietas.html";
    window.location.href = destino;
  });
  elements.dietSaveButton?.addEventListener("click", handleGuardarDieta);
  elements.dietHistoryButton?.addEventListener("click", openHistorialDietaModal);
  elements.dietHistoryClose?.addEventListener("click", closeHistorialDietaModal);
  elements.dietHistoryModal?.addEventListener("click", (event) => {
    if (event.target === elements.dietHistoryModal) {
      closeHistorialDietaModal();
    }
  });

  elements.antResumenBadge = document.getElementById("antResumenBadge");

  elements.antResumen = document.getElementById("antResumen");

  elements.antUltimaMedicion = document.getElementById("antUltimaMedicion");

  elements.antPesoActual = document.getElementById("antPesoActual");

  elements.antVariacion30d = document.getElementById("antVariacion30d");

  elements.antImcActual = document.getElementById("antImcActual");

  elements.antGrasaActual = document.getElementById("antGrasaActual");

  elements.tablaAntropometria = document.getElementById("tablaAntropometria");

  elements.antModal = document.getElementById("modalAntropometria");

  elements.antForm = document.getElementById("formAntropometria");

  elements.antFecha = document.getElementById("antFecha");

  elements.antPeso = document.getElementById("antPeso");

  elements.antAltura = document.getElementById("antAltura");

  elements.antImc = document.getElementById("antImc");

  elements.antGrasa = document.getElementById("antGrasa");

  elements.antObservaciones = document.getElementById("antObservaciones");

  elements.antFeedback = document.getElementById("antFeedback");

  elements.antAbrirBtn = document.getElementById("abrirModalAntropometria");

  elements.antCerrarBtn = document.getElementById("cerrarModalAnt");

  elements.antCancelarBtn = document.getElementById("cancelarAntropometria");

  elements.antDeleteModal = document.getElementById("modalEliminarAnt");

  elements.antDeleteMessage = document.getElementById("eliminarMensaje");

  elements.antDeleteConfirm = document.getElementById("confirmarEliminarAnt");

  elements.antDeleteCancel = document.getElementById("cancelarEliminarAnt");

  elements.antDeleteClose = document.getElementById("cerrarModalEliminar");

  elements.historialLista = document.getElementById("historialLista");

  elements.historialTotal = document.getElementById("historialTotal");



  if (elements.agendaLink && pacienteId) {

    elements.agendaLink.setAttribute("href", `agenda.html?pacienteId=${encodeURIComponent(pacienteId)}`);

  }



  elements.citaAbrirBtn?.addEventListener("click", openCitaModal);

  elements.citaCerrarBtn?.addEventListener("click", closeCitaModal);

  elements.citaCancelarBtn?.addEventListener("click", closeCitaModal);

  elements.citaForm?.addEventListener("submit", handleCitaFormSubmit);

  elements.citaFecha?.addEventListener("change", handleCitaFechaChange);



  if (elements.citaDisponibilidad) {

    setDisponibilidadHint("Selecciona una fecha para consultar los huecos disponibles.");

  }



  elements.antAbrirBtn?.addEventListener("click", openAntModal);

  elements.antCerrarBtn?.addEventListener("click", closeAntModal);

  elements.antCancelarBtn?.addEventListener("click", closeAntModal);

  elements.antForm?.addEventListener("submit", handleAntFormSubmit);

  elements.antPeso?.addEventListener("input", updateImcField);

  elements.antAltura?.addEventListener("input", updateImcField);

  elements.antDeleteConfirm?.addEventListener("click", handleDeleteRegistro);

  elements.antDeleteCancel?.addEventListener("click", closeDeleteModal);

  elements.antDeleteClose?.addEventListener("click", closeDeleteModal);



  if (elements.citaModal) {

    elements.citaModal.hidden = true;

  }

  if (elements.antModal) {

    elements.antModal.hidden = true;

  }

  if (elements.antDeleteModal) {

    elements.antDeleteModal.hidden = true;

  }

  document.body.classList.remove("modal-open");



  elements.citaModal?.addEventListener("click", (event) => {

    if (event.target === elements.citaModal) {

      closeCitaModal();

    }

  });



  elements.antModal?.addEventListener("click", (event) => {

    if (event.target === elements.antModal) {

      closeAntModal();

    }

  });

  elements.antDeleteModal?.addEventListener("click", (event) => {

    if (event.target === elements.antDeleteModal) {

      closeDeleteModal();

    }

  });



  elements.tablaAntropometria?.addEventListener("click", (event) => {

    const target = event.target;

    if (!target || target.dataset.action !== "delete-registro") {

      return;

    }

    event.preventDefault();

    const id = target.dataset.id;

    const fecha = target.dataset.fecha || "";

    if (!id) return;

    openDeleteModal({ id, fecha });

  });



  loadPaciente();

};



document.addEventListener("DOMContentLoaded", init);





const setGuardarDietaState = (estado = {}) => {
  const button = elements.dietSaveButton;
  if (!button) return;
  if (estado.loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = estado.text || "Guardando...";
    button.setAttribute("disabled", "disabled");
    return;
  }
  if (estado.disabled) {
    button.setAttribute("disabled", "disabled");
  } else {
    button.removeAttribute("disabled");
  }
  if (estado.text) {
    button.textContent = estado.text;
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
};

const setHistorialDietaState = (enabled = false) => {
  const button = elements.dietHistoryButton;
  if (!button) return;
  if (enabled) {
    button.removeAttribute("disabled");
  } else {
    button.setAttribute("disabled", "disabled");
  }
};


const handleGuardarDieta = async () => {
  if (!dietaActualSeleccionada) {
    alert("No hay una dieta actual para guardar.");
    return;
  }

  const dietaId = Number.parseInt(
    dietaActualSeleccionada.id || dietaActualSeleccionada.dieta_id || "",
    10
  );
  if (!Number.isFinite(dietaId)) {
    alert("No se pudo identificar la dieta actual.");
    return;
  }

  const normalizeDateForApi = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  };

  const parsedDescripcion = parsePlanDescripcion(dietaActualSeleccionada.descripcion) || {};
  const latestHistSnapshot = (() => {
    if (!Array.isArray(dietaActualSeleccionada.historial) || !dietaActualSeleccionada.historial.length) return null;
    const sorted = dietaActualSeleccionada.historial
      .slice()
      .sort(
        (a, b) =>
          new Date(b.registrado_en || b.fecha || b.creado_en || 0).getTime() -
          new Date(a.registrado_en || a.fecha || a.creado_en || 0).getTime()
      );
    const snap = sorted[0]?.snapshot;
    const desc = snap?.descripcion || sorted[0]?.descripcion;
    return {
      snapshot: snap || null,
      descripcion: parsePlanDescripcion(desc) || null
    };
  })();

  const fechaInicio =
    dietaActualSeleccionada.fecha_inicio ||
    parsedDescripcion.fecha_inicio ||
    parsedDescripcion.fechaInicio ||
    latestHistSnapshot?.snapshot?.fecha_inicio ||
    latestHistSnapshot?.snapshot?.fechaInicio ||
    latestHistSnapshot?.descripcion?.fecha_inicio ||
    latestHistSnapshot?.descripcion?.fechaInicio ||
    null;
  const fechaFin =
    dietaActualSeleccionada.fecha_fin ??
    parsedDescripcion.fecha_fin ??
    parsedDescripcion.fechaFin ??
    latestHistSnapshot?.snapshot?.fecha_fin ??
    latestHistSnapshot?.snapshot?.fechaFin ??
    latestHistSnapshot?.descripcion?.fecha_fin ??
    latestHistSnapshot?.descripcion?.fechaFin ??
    null;

  setGuardarDietaState({ loading: true, text: "Guardando..." });
  try {
    const actorId = usuarioActual?.idUsuario || null;
    const payload = { actor_usuario_id: actorId };
    const fechaInicioNorm = normalizeDateForApi(fechaInicio);
    const fechaFinNorm = normalizeDateForApi(fechaFin);
    if (fechaInicioNorm) payload.fecha_inicio = fechaInicioNorm;
    if (fechaFinNorm) payload.fecha_fin = fechaFinNorm;
    await requestNutritionJson(`/dietas/${dietaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await loadPacienteDietas(pacienteActual);
  } catch (error) {
    console.warn("No se pudo registrar el guardado de la dieta:", error);
    alert(error?.message || "No se pudo guardar la dieta.");
  } finally {
    setGuardarDietaState({ loading: false, text: "Guardar dieta" });
  }
};

const parsePlanDescripcion = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const buildMacroPills = (macros = {}) => {
  const get = (key) => {
    const val = macros[key];
    const num = Number.parseFloat(val);
    return Number.isFinite(num) ? num : null;
  };
  const energia = get("energia") ?? get("calorias");
  const proteina = get("proteina") ?? get("proteinas");
  const grasa = get("grasa") ?? get("grasas");
  const carb = get("carbohidratos");
  const fibra = get("fibra");

  const pills = [];
  if (energia !== null) pills.push(`<span class="pill soft small">Kcal: ${formatNumber(energia, 0)}</span>`);
  if (proteina !== null) pills.push(`<span class="pill muted small">P: ${formatNumber(proteina, 0)} g</span>`);
  if (grasa !== null) pills.push(`<span class="pill muted small">G: ${formatNumber(grasa, 0)} g</span>`);
  if (carb !== null) pills.push(`<span class="pill muted small">HC: ${formatNumber(carb, 0)} g</span>`);
  if (fibra !== null) pills.push(`<span class="pill muted small">Fibra: ${formatNumber(fibra, 0)} g</span>`);

  return pills.join("");
};

const shouldDisplayHistEntry = (entry) => {
  if (!entry) return false;
  const detalle = (entry.detalle || "").toLowerCase();
  if (detalle.includes("asignacion a paciente")) return false;
  // Solo mostrar entradas provenientes de guardado (PUT en gestor)
  const isSaveEntry = detalle.includes("actualizacion de campos") || detalle.includes("actualización de campos");
  if (!isSaveEntry) return false;
  return isSaveEntry;
};

const buildDonutChart = (macros = {}, label = "", small = false) => {
  const valores = [
    { key: "grasa", value: Number.parseFloat(macros.grasa ?? macros.grasas), color: "#b21e35" },
    { key: "carbohidratos", value: Number.parseFloat(macros.carbohidratos), color: "#f28b30" },
    { key: "proteina", value: Number.parseFloat(macros.proteina ?? macros.proteinas), color: "#3fb8de" },
    { key: "fibra", value: Number.parseFloat(macros.fibra), color: "#2d9e5e" },
  ].filter((item) => Number.isFinite(item.value) && item.value > 0);
  if (!valores.length) {
    // Donut vacÃ­o para mostrar el placeholder del meal
    const sizeClass = small ? "hist-donut hist-donut--small" : "hist-donut";
    const centerLabel = small ? "" : `<span>Energia</span><strong>0</strong><small>kcal</small>`;
    return `<div class="${small ? "hist-donut-mini" : "hist-donut-main"}">
        <div class="${sizeClass} hist-donut--empty">
          <div class="hist-donut__center">${centerLabel}</div>
        </div>
        ${label ? `<div class="hist-donut-label">${escapeHtml(label)}</div>` : ""}
      </div>`;
  }
  const total = valores.reduce((acc, item) => acc + item.value, 0);
  let start = 0;
  const segments = valores
    .map((item) => {
      const deg = (item.value / total) * 360;
      const seg = `${start}deg ${start + deg}deg ${item.color}`;
      start += deg;
      return seg;
    })
    .map((seg, idx, arr) => {
      const [startDeg, endDeg, color] = seg.split(" ");
      const nextStart = idx === 0 ? startDeg : arr[idx - 1].split(" ")[1];
      return `${color} ${nextStart} ${endDeg}`;
    })
    .join(", ");
  const energia = Number.parseFloat(macros.energia ?? macros.calorias ?? 0) || 0;
  const sizeClass = small ? "hist-donut hist-donut--small" : "hist-donut";
  const centerLabel = small ? "" : `<span>Energia</span><strong>${formatNumber(energia, 0)}</strong><small>kcal</small>`;
  return `<div class="${small ? "hist-donut-mini" : "hist-donut-main"}">
      <div class="${sizeClass}" style="background: conic-gradient(${segments});">
        <div class="hist-donut__center">${centerLabel}</div>
      </div>
      ${label ? `<div class="hist-donut-label">${escapeHtml(label)}</div>` : ""}
    </div>`;
};

const buildMacroBarsDetail = (macros = {}) => {
  const entries = [
    { key: "energia", label: "Energía", value: Number.parseFloat(macros.energia ?? macros.calorias), unit: "kcal" },
    { key: "grasa", label: "Grasa", value: Number.parseFloat(macros.grasa ?? macros.grasas), unit: "g" },
    { key: "carbohidratos", label: "Hidratos de carbono", value: Number.parseFloat(macros.carbohidratos), unit: "g" },
    { key: "proteina", label: "Proteína", value: Number.parseFloat(macros.proteina ?? macros.proteinas), unit: "g" },
    { key: "fibra", label: "Fibra", value: Number.parseFloat(macros.fibra), unit: "g" }
  ].filter((item) => Number.isFinite(item.value));
  if (!entries.length) return "";
  const maxValue = Math.max(...entries.map((item) => item.value));
  return entries
    .map((item) => {
      const percent = maxValue > 0 ? Math.max(6, Math.round((item.value / maxValue) * 100)) : 0;
      return `<div class="hist-macro-row">
        <span class="hist-macro-dot hist-macro-dot--${item.key}"></span>
        <div class="hist-macro-label">${item.label}</div>
        <div class="hist-macro-bar"><span class="hist-macro-fill--${item.key}" style="width:${percent}%;"></span></div>
        <div class="hist-macro-val">${formatNumber(item.value, 1)} ${item.unit}</div>
      </div>`;
    })
    .join("");
};

const renderHistorialDietaModal = (dieta) => {
  const container = elements.dietHistoryContent;
  if (!container) return;

  container.innerHTML = "";
  const entriesRaw = Array.isArray(dieta?.historial) ? dieta.historial.filter(shouldDisplayHistEntry) : [];
  if (!dieta || !entriesRaw.length) {
    container.dataset.empty = "Todavía no hay cambios guardados.";
    return;
  }
  container.dataset.empty = "";

  const sorted = entriesRaw
    .slice()
    .sort(
      (a, b) =>
        new Date(b.registrado_en || b.fecha || b.creado_en || 0).getTime() -
        new Date(a.registrado_en || a.fecha || a.creado_en || 0).getTime()
    );
  const totalEntries = sorted.length;

  const entries = sorted.map((entry, idx) => {
    const parseMaybeJson = (value) => {
      if (!value || typeof value !== "string") return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };
    const snapshot = entry.snapshot || parseMaybeJson(entry.snapshot_data) || {};
    const snapshotDescripcion = parsePlanDescripcion(snapshot.descripcion);
    const descripcion = snapshotDescripcion || parsePlanDescripcion(dieta?.descripcion) || {};
    const fechaInicioRaw =
      snapshot?.fecha_inicio ??
      snapshot?.fechaInicio ??
      descripcion?.fecha_inicio ??
      descripcion?.fechaInicio ??
      dieta?.historial?.[idx]?.snapshot?.fecha_inicio ??
      dieta?.historial?.[idx]?.snapshot?.fechaInicio ??
      dieta?.fecha_inicio ??
      null;
    const fechaFinRaw =
      snapshot?.fecha_fin ??
      snapshot?.fechaFin ??
      descripcion?.fecha_fin ??
      descripcion?.fechaFin ??
      dieta?.historial?.[idx]?.snapshot?.fecha_fin ??
      dieta?.historial?.[idx]?.snapshot?.fechaFin ??
      dieta?.fecha_fin ??
      null;
    const parsedComidas = Array.isArray(descripcion?.comidas) ? descripcion.comidas : [];
    const fallbackComidas = parsePlanDescripcion(dieta?.descripcion)?.comidas || [];
    const comidas = parsedComidas.length ? parsedComidas : fallbackComidas;
    const totales =
      snapshot.totales?.macros ||
      snapshot.totales ||
      dieta?.totales?.macros ||
      dieta?.totales ||
      {};
    const fechaRaw =
      entry.registrado_en ||
      entry.fecha ||
      entry.creado_en ||
      entry.actualizado_en ||
      snapshot.fecha ||
      Date.now();
    const fechaFixed = new Date(fechaRaw);
    // Ajuste ligero para evitar desfase horario (-1h) reportado
    const fechaLabel = formatDatetime(new Date(fechaFixed.getTime() + 60 * 60 * 1000)) || "Sin fecha";
    const fallbackVersion = totalEntries - idx;
    const version =
      snapshot.version !== undefined && snapshot.version !== null && snapshot.version !== 0
        ? Math.max(snapshot.version, fallbackVersion)
        : fallbackVersion;
    const versionLabel = `<span class="pill soft small">v${version}</span>`;
    const detalle = (() => {
      if (!entry.detalle) return "";
      const lower = entry.detalle.toLowerCase();
      if (lower.includes("actualizacion de campos") || lower.includes("actualización de campos")) {
        return "";
      }
      return escapeHtml(entry.detalle);
    })();
    return {
      entry,
      snapshot,
      descripcion,
      fechaInicioRaw,
      fechaFinRaw,
      comidas,
      totales,
      fechaLabel,
      version,
      versionLabel,
      detalle
    };
  });

const renderMealsDetail = (comidas) => {
    const defaultMeals = ["Desayuno", "Comida", "Cena", "Almuerzo", "Merienda"];
    const normalizeMacros = (macros) => ({
      energia: Number(macros?.energia ?? macros?.calorias ?? 0) || 0,
      grasa: Number(macros?.grasa ?? macros?.grasas ?? 0) || 0,
      carbohidratos: Number(macros?.carbohidratos ?? 0) || 0,
      proteina: Number(macros?.proteina ?? macros?.proteinas ?? 0) || 0,
      fibra: Number(macros?.fibra ?? 0) || 0
    });
    const asArray = Array.isArray(comidas) ? comidas : [];
    const mapped = asArray.map((c) => ({
      nombre: c?.nombre || "Comida",
      items: Array.isArray(c?.items) ? c.items : [],
      macros: normalizeMacros(c?.macros || {})
    }));
    const byName = new Map();
    mapped.forEach((c) => byName.set(c.nombre, c));
    const ordered = [
      ...defaultMeals.map((name) => byName.get(name) || { nombre: name, items: [], macros: normalizeMacros({}) }),
      ...mapped.filter((m) => !defaultMeals.includes(m.nombre))
    ];

    return ordered
      .map((comida) => {
        const macrosHtml = buildMacroPills(comida?.macros || {});
        const items = Array.isArray(comida?.items) ? comida.items : [];
        const itemsHtml = items.length
          ? `<ul class="hist-meal__items">${items
              .map((item) => {
                const cantidadNum = Number.parseFloat(item.cantidad);
                const cantidad = Number.isFinite(cantidadNum)
                  ? formatNumber(cantidadNum, 0)
                  : escapeHtml(item.cantidad || "");
                const unidad = item.unidad ? ` ${escapeHtml(item.unidad)}` : "";
                const nombre = escapeHtml(item.nombre || item.alimento || "Alimento");
                return `<li>${cantidad}${unidad ? unidad : ""} ${nombre}</li>`;
              })
              .join("")}</ul>`
          : '<div class="pill muted small">Sin alimentos asignados.</div>';
        return `<div class="hist-meal">
            <div class="hist-meal__header">
              <strong>${escapeHtml(comida?.nombre || "Comida")}</strong>
              <div class="hist-meal__macros">${macrosHtml || '<span class="pill muted small">Sin macros</span>'}</div>
            </div>
            ${itemsHtml}
          </div>`;
      })
      .join("");
  };

  const renderDetail = (index) => {
    const detailEl = container.querySelector(".hist-detail");
    if (!detailEl || !entries[index]) return;
    const data = entries[index];
    const macroBars = buildMacroBarsDetail(data.totales);
    const defaultMeals = ["Desayuno", "Comida", "Cena", "Almuerzo", "Merienda"];
    const mealsForDonuts = (() => {
      const mapped = Array.isArray(data.comidas) ? data.comidas : [];
      const byName = new Map();
      mapped.forEach((m) => byName.set(m?.nombre || "", m));
      return [
        ...defaultMeals.map((name) => byName.get(name) || { nombre: name, macros: {} }),
        ...mapped.filter((m) => !defaultMeals.includes(m?.nombre || ""))
      ];
    })();
    const miniDonuts = mealsForDonuts
      .map((c) => buildDonutChart(c.macros || {}, c.nombre || "Comida", true))
      .join("");
    const periodoHtml = (() => {
      const inicio = formatDate(data.fechaInicioRaw || dieta?.fecha_inicio) || "N/D";
      const finRaw = data.fechaFinRaw ?? dieta?.fecha_fin;
      const fin = finRaw ? formatDate(finRaw) || "Indefinido" : "Indefinido";
      if (!inicio && !finRaw) return "";
      return `<div class="hist-entry__meta-line">
        <span class="pill soft small">Inicio: ${inicio}</span>
        <span class="pill soft small">Fin: ${fin}</span>
      </div>`;
    })();

    detailEl.innerHTML = `<div class="hist-detail__head">
        <div>
          <p class="hist-entry__title">Modificación de la dieta</p>
          <div class="hist-entry__meta">
            <span class="pill muted">${data.fechaLabel}</span>
            ${data.versionLabel}
            ${data.detalle ? `<span class="pill soft small">${data.detalle}</span>` : ""}
          </div>
        </div>
      </div>
      ${periodoHtml}
      <div class="hist-detail__charts">
        <div class="hist-donut-section">
          ${buildDonutChart(data.totales)}
          <div class="hist-donut-minis">${miniDonuts || '<div class="pill muted small">Sin comidas con macros</div>'}</div>
        </div>
        <div class="hist-macro-bars">
          ${macroBars || '<div class="pill muted small">Sin macros</div>'}
        </div>
      </div>
      <div class="hist-entry__foods">${renderMealsDetail(data.comidas)}</div>`;
  };

  const listItems = entries
    .map((item, idx) => {
      const deleteBtn = item.entry?.id
        ? `<button type="button" class="hist-delete" data-hist-delete="${item.entry.id}" title="Eliminar versi\u00f3n">Eliminar</button>`
        : "";
      return `<div class="hist-list__item ${idx === 0 ? "is-active" : ""}" data-hist-index="${idx}">
        <div>
          <div class="hist-list__title">v${item.version}</div>
          <div class="hist-list__meta">${item.fechaLabel}</div>
        </div>
        ${deleteBtn}
      </div>`;
    })
    .join("");

  container.innerHTML = `<div class="hist-layout">
      <aside class="hist-list">${listItems}</aside>
      <div class="hist-detail"></div>
    </div>`;

  const btns = Array.from(container.querySelectorAll("[data-hist-index]"));
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const idx = Number(btn.dataset.histIndex);
      renderDetail(idx);
    });
  });

  const deleteBtns = Array.from(container.querySelectorAll("[data-hist-delete]"));
  deleteBtns.forEach((delBtn) => {
    delBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = delBtn.dataset.histDelete;
      if (!id || !dietaActualSeleccionada?.id) return;
      const confirmar = window.confirm("?Seguro que quieres eliminar esta versi?n del historial?");
      if (!confirmar) return;
      try {
        delBtn.disabled = true;
        await requestNutritionJson(`/dietas/${encodeURIComponent(dietaActualSeleccionada.id)}/historial/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
        await loadPaciente();
        if (dietaActualSeleccionada) {
          renderHistorialDietaModal(dietaActualSeleccionada);
        }
      } catch (error) {
        alert(error?.message || "No se pudo eliminar la versi?n.");
      } finally {
        delBtn.disabled = false;
      }
    });
  });

  renderDetail(0);
};

const openHistorialDietaModal = () => {
  if (!elements.dietHistoryModal) return;
  if (!dietaActualSeleccionada) {
    alert("No hay una dieta seleccionada.");
    return;
  }
  renderHistorialDietaModal(dietaActualSeleccionada);
  document.body.classList.add("modal-open");
  elements.dietHistoryModal.hidden = false;
};

const closeHistorialDietaModal = () => {
  if (!elements.dietHistoryModal) return;
  elements.dietHistoryModal.hidden = true;
  document.body.classList.remove("modal-open");
};


const renderPacienteDietas = (dietas) => {
  const container = elements.dietSummary;
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(dietas) || !dietas.length) {
    dietaActualSeleccionada = null;
    setGuardarDietaState({ disabled: true, text: "Guardar dieta" });
    setHistorialDietaState(false);
    container.dataset.empty = "No hay dietas asignadas actualmente.";
    return;
  }

  const computeDietStatus = (dieta) => {
    const asignacionActual = Array.isArray(dieta.asignaciones)
      ? dieta.asignaciones.find((item) => item.es_actual)
      : null;
    const now = Date.now();
    const startDate = asignacionActual?.fecha_asignacion || dieta.fecha_inicio;
    const endDate = dieta.fecha_fin;

    if (!asignacionActual && dieta.es_plantilla) {
      return { label: "Plantilla", variant: "soft" };
    }
    if (!asignacionActual) {
      return { label: "Sin asignar", variant: "muted" };
    }
    if (dieta.activa === false) {
      return { label: "Inactiva", variant: "muted" };
    }
    if (startDate) {
      const start = new Date(startDate).getTime();
      if (start > now) {
        return { label: "Programada", variant: "warning" };
      }
    }
    if (endDate) {
      const fin = new Date(endDate).getTime();
      if (fin < now) {
        return { label: "Finalizada", variant: "muted" };
      }
    }
    return { label: "Activa", variant: "success" };
  };

  const parseDescripcion = (value) => {
    if (!value || typeof value !== "string") return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  const sortByFecha = (items) => {
    return [...items].sort((a, b) => {
      const fechaA =
        new Date(a.asignaciones?.find((it) => it.es_actual)?.fecha_asignacion || a.fecha_inicio || a.creado_en || 0).getTime() ||
        0;
      const fechaB =
        new Date(b.asignaciones?.find((it) => it.es_actual)?.fecha_asignacion || b.fecha_inicio || b.creado_en || 0).getTime() ||
        0;
      return fechaB - fechaA;
    });
  };

  const sortedDietas = sortByFecha(dietas);
  const actual =
    sortedDietas.find((d) => d.asignaciones?.some((a) => a.es_actual)) ||
    sortedDietas.find((d) => d.activa !== false && d.es_plantilla === false) ||
    sortedDietas[0];
  dietaActualSeleccionada = actual || null;
  const hasHistorial = dietaActualSeleccionada?.historial?.some((item) => shouldDisplayHistEntry(item));
  setGuardarDietaState({ disabled: !dietaActualSeleccionada, text: "Guardar dieta" });
  setHistorialDietaState(Boolean(dietaActualSeleccionada && hasHistorial));

  const historyHtml = "";

  const items = [actual]
    .filter(Boolean)
    .map((dieta) => {
      const estadoLabel = dieta.es_plantilla
        ? "Plantilla"
        : dieta.activa
        ? "Activa"
        : "Hist&oacute;rica";
      const parsedDescripcion = parseDescripcion(dieta.descripcion);
      const comidasCount = parsedDescripcion?.comidas?.length || 0;
      const kcal =
        (dieta.totales?.macros?.calorias ?? dieta.calorias_objetivo ?? parsedDescripcion?.resumen?.energia) || 0;
      const macrosRaw = dieta.totales?.macros || parsedDescripcion?.resumen || {};
      const macros = {
        calorias: Number(macrosRaw.calorias ?? kcal ?? dieta.calorias_objetivo ?? 0) || 0,
        proteinas: Number(macrosRaw.proteinas ?? macrosRaw.proteina ?? 0) || 0,
        grasas: Number(macrosRaw.grasas ?? macrosRaw.grasa ?? 0) || 0,
        carbohidratos: Number(macrosRaw.carbohidratos ?? 0) || 0,
        fibra: Number(macrosRaw.fibra ?? 0) || 0
      };
      const macrosHtml = `<div class="diet-macros">
            <span class="pill soft small">Kcal: ${formatNumber(macros.calorias, 0)}</span>
            <span class="pill muted small">P: ${formatNumber(macros.proteinas, 0)} g</span>
            <span class="pill muted small">G: ${formatNumber(macros.grasas, 0)} g</span>
            <span class="pill muted small">HC: ${formatNumber(macros.carbohidratos, 0)} g</span>
            <span class="pill muted small">Fibra: ${formatNumber(macros.fibra, 0)} g</span>
          </div>`;
      const asignacionActual = Array.isArray(dieta.asignaciones)
        ? dieta.asignaciones.find((item) => item.es_actual)
        : null;
      const meta = [];
      if (dieta.fecha_inicio) {
        meta.push(`Inicio: ${formatDate(dieta.fecha_inicio)}`);
      }
      if (asignacionActual?.fecha_asignacion) {
        meta.push(`Asignada: ${formatDate(asignacionActual.fecha_asignacion)}`);
      }
      if (dieta.fecha_fin) {
        meta.push(`Fin: ${formatDate(dieta.fecha_fin)}`);
      }
      if (comidasCount > 0) {
        meta.push(`${comidasCount} comidas`);
      }
      const estadoBadge =
        (() => {
          const { label, variant } = computeDietStatus(dieta);
          return `<span class="pill ${variant}">${escapeHtml(label)}</span>`;
        })();
      const metaHtml = meta.length
        ? `<div class="diet-card__item-meta">${meta.map((valor) => `<span class="pill muted">${escapeHtml(valor)}</span>`).join("")}</div>`
        : "";
      const objetivo = dieta.objetivo
        ? `<div class="diet-card__item-note"><strong>Objetivo:</strong> ${escapeHtml(dieta.objetivo)}</div>`
        : "";
      const descripcion =
        parsedDescripcion && parsedDescripcion.comidas
          ? `<div class="diet-card__item-note muted">Plan con ${parsedDescripcion.comidas.length} comidas.</div>`
          : dieta.descripcion
          ? `<div class="diet-card__item-note">${escapeHtml(dieta.descripcion).replace(/\n/g, "<br />")}</div>`
          : "";
      const notas = dieta.notas
        ? `<div class="diet-card__item-note">${escapeHtml(dieta.notas).replace(/\n/g, "<br />")}</div>`
        : "";
      const historialItems = Array.isArray(dieta.historial)
        ? dieta.historial
            .slice()
            .filter((item) => shouldDisplayHistEntry(item))
            .sort(
              (a, b) =>
                new Date(b.registrado_en || b.fecha || b.creado_en || 0).getTime() -
                new Date(a.registrado_en || a.fecha || a.creado_en || 0).getTime()
            )
            .map((item, index) => {
              const fecha = item.registrado_en || item.fecha || item.creado_en || null;
              const fechaLabel = fecha ? formatDatetime(fecha) : "Sin fecha";
              const detalle = item.detalle ? escapeHtml(item.detalle) : "Actualizaci&oacute;n registrada";
              const snapshot = item.snapshot || {};
              const versionLabel =
                snapshot.version != null ? `<span class="pill soft small">v${snapshot.version}</span>` : "";
              const snapshotHtml = snapshot && Object.keys(snapshot).length
                ? `<div class="diet-history__snapshot" data-history-panel="${index}" hidden>
                    <div class="diet-history__snapshot-row"><strong>Nombre:</strong> ${escapeHtml(snapshot.nombre || "Plan")}</div>
                    <div class="diet-history__snapshot-row"><strong>Calor&iacute;as:</strong> ${formatNumber(snapshot.calorias_objetivo || 0, 0)} kcal</div>
                    <div class="diet-history__snapshot-row"><strong>Objetivo:</strong> ${escapeHtml(snapshot.objetivo || "Sin objetivo")}</div>
                    <div class="diet-history__snapshot-row"><strong>Notas:</strong> ${escapeHtml(snapshot.notas || "Sin notas")}</div>
                    <div class="diet-history__snapshot-row"><strong>Estado:</strong> ${escapeHtml(String(snapshot.estado || ""))}</div>
                    <div class="diet-history__snapshot-row"><strong>Activo:</strong> ${snapshot.activa ? "S&iacute;" : "No"}</div>
                  </div>`
                : "";
              const toggleBtn = snapshot && Object.keys(snapshot).length
                ? `<button type="button" class="pill ghost small" data-history-toggle="${index}">Ver versi&oacute;n</button>`
                : "";
              return `<li>
                <div class="diet-history__row">
                  <div class="diet-history__meta">
                    <span class="pill muted">${fechaLabel}</span>
                    ${versionLabel}
                    <span class="pill soft small">${detalle}</span>
                    ${toggleBtn}
                  </div>
                </div>
                ${snapshotHtml}
              </li>`;
            })
        : [];
      const historialCambiosHtml = "";
      return `
        <div class="diet-card__item">
          <div class="diet-card__item-head">
            <div>
              <strong>${escapeHtml(dieta.nombre || "Plan nutricional")}</strong>
              ${objetivo}
            </div>
            <div class="diet-card__item-chips">
              ${estadoBadge}
            </div>
          </div>
          ${kcal ? `<div class="diet-card__item-meta"><span class="pill soft">${formatNumber(kcal, 0)} kcal</span></div>` : ""}
          ${metaHtml}
          ${macrosHtml}
          ${descripcion}
          ${notas}
          ${historyHtml}
          ${historialCambiosHtml}
        </div>
      `;
    })
    .join("");

  container.innerHTML = items;
};

const loadPacienteDietas = async (paciente) => {
  const container = elements.dietSummary;
  if (!container) return;

  container.dataset.empty = "Consultando plan nutricional...";
  container.innerHTML = "";
  setGuardarDietaState({ disabled: true, text: "Guardar dieta" });

  const nutricionId =
    getNutricionPacienteId(paciente) ||
    paciente?.id ||
    paciente?.idPaciente ||
    paciente?.id_paciente ||
    pacienteId ||
    null;
  if (!nutricionId) {
    container.innerHTML =
      '<p class="diet-card__item-note">Asigna el identificador num&eacute;rico del paciente en el gestor de nutrici&oacute;n para vincular sus dietas.</p>';
    setHistorialDietaState(false);
    return;
  }

  elements.dietButton?.setAttribute("disabled", "disabled");

  try {
    const params = new URLSearchParams({ paciente_id: String(nutricionId), solo_actuales: "true" });
    const response = await requestNutritionJson(`/dietas?${params.toString()}`);
    const dietas = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
    renderPacienteDietas(dietas);
  } catch (error) {
    console.warn("No se pudo obtener el plan nutricional del paciente:", error);
    container.innerHTML = `<p class="diet-card__item-note">${escapeHtml(error?.message || "No se pudo consultar el servicio de nutrici&oacute;n.")}</p>`;
    setHistorialDietaState(false);
  }
};

