"use strict";



const API_BASE_URL = (() => {

  const gatewayBase = "http://localhost:5000/gestion";

  const serviceBase = "http://localhost:4002";



  if (window.location.protocol === "file:") {

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
const HISTORIAL_PAGE = "historialClinico.html";

const unique = (values) => [...new Set(values.filter(Boolean))];

const resolveNutritionBase = () => {
  if (window.location.protocol === "file:") {
    return "http://localhost:5002";
  }
  const host = window.location.hostname || "localhost";
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:5002";
  }
  return `${window.location.protocol}//${window.location.host}/nutricion`;
};

const resolveNutritionGateway = () => {
  if (window.location.protocol === "file:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:5000/nutricion";
  }
  return `${window.location.protocol}//${window.location.host}/nutricion`;
};

const NUTRICION_API_BASES = unique([resolveNutritionBase(), resolveNutritionGateway()]).map((base) => `${base}/api`);

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

  throw new Error("No se pudo completar la petición.");

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
  throw new Error("No se pudo completar la petición.");
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

const isPacienteEnBaja = (paciente) => paciente?.estado === "baja";



const formatNumber = (value, decimals = 2) => {

  if (typeof value !== "number" || Number.isNaN(value)) {

    return "—";

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

  return `${prefix}${absValue.toFixed(2).replace(".", ",")} kg en 30 días`;

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

  if (isPacienteEnBaja(paciente)) {
    const fecha = paciente.fechaBaja ? ` - ${formatDate(paciente.fechaBaja)}` : "";
    badges.push(`<span class="badge danger">En baja${fecha}</span>`);
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

    const telefono = paciente.telefono || "Sin teléfono";

    elements.meta.textContent = `${email} - ${telefono}`;

  }



  if (elements.detalleNombre) {

    elements.detalleNombre.textContent = nombre;

  }

  if (elements.detalleNacimiento) {

    const fecha = paciente.fechaNac ? formatDate(paciente.fechaNac) : "—";

    const edad = calculateAge(paciente.fechaNac);

    elements.detalleNacimiento.textContent = edad ? `${fecha} (${edad} años)` : fecha;

  }

  if (elements.detalleEmail) {

    elements.detalleEmail.textContent = paciente.emailPaciente || "—";

  }

  if (elements.detalleTelefono) {

    elements.detalleTelefono.textContent = paciente.telefono || "—";

  }

  if (elements.detalleActualizacion) {

    elements.detalleActualizacion.textContent = formatDatetime(paciente.updatedAt) || "—";

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
  const enBaja = isPacienteEnBaja(paciente);
  elements.bajaBtn.hidden = enBaja;
  elements.reactivarBtn.hidden = !enBaja;
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

          : "—";



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

      : "—";

  }

  if (elements.antPesoActual) {

    elements.antPesoActual.textContent = resumen?.pesoActual !== undefined ? `${formatNumber(resumen.pesoActual)} kg` : "—";

  }

  if (elements.antVariacion30d) {

    elements.antVariacion30d.textContent = resumen?.variacion30Dias !== null && resumen?.variacion30Dias !== undefined

      ? formatDiff(resumen.variacion30Dias)

      : "";

  }

  if (elements.antImcActual) {

    elements.antImcActual.textContent = resumen?.imcActual !== undefined ? formatNumber(resumen.imcActual) : "—";

  }

  if (elements.antGrasaActual) {

    elements.antGrasaActual.textContent =

      resumen?.grasaCorporal !== undefined && resumen?.grasaCorporal !== null

        ? `${formatNumber(resumen.grasaCorporal)} %`

        : "—";

  }



  if (elements.antResumen) {

    elements.antResumen.dataset.empty = registros.length ? "" : "Sin registros.";

  }



  const body = elements.tablaAntropometria;

  if (!body) return;



  if (!registros.length) {

    const empty = body.dataset.empty || "No hay registros antropométricos.";

    body.innerHTML = `<tr><td colspan="6">${empty}</td></tr>`;

    return;

  }



  const rows = registros

    .map((registro) => {

      const fecha = formatDate(registro.fechaMedicion, { day: "2-digit", month: "short", year: "numeric" });

      const peso = registro.peso !== undefined ? formatNumber(registro.peso) : "—";

      const altura = registro.altura !== undefined ? formatNumber(registro.altura) : "—";

      const imc = registro.imc !== undefined ? formatNumber(registro.imc) : "—";

      const grasa =

        registro.grasaCorporal !== undefined && registro.grasaCorporal !== null

          ? formatNumber(registro.grasaCorporal)

          : "—";



      const profesional = registro.profesional ? `<strong>${escapeHtml(registro.profesional)}</strong>` : "";

      const observaciones =

        registro.observaciones && registro.observaciones.trim()

          ? `<div class="obs-text">${escapeHtml(registro.observaciones.trim()).replace(/\n/g, "<br />")}</div>`

          : "";

      const detalle = profesional || observaciones ? `${profesional}${observaciones}` : "—";



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

    setDisponibilidadHint("La fecha seleccionada no es válida.", "error");

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

  if (Number.isNaN(fecha.getTime())) return "La fecha indicada no es válida.";

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

    elements.antDeleteMessage.textContent = `¿Seguro que deseas eliminar el registro del ${registro.fecha}?`;

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

  if (!data.fechaMedicion) return "Selecciona la fecha de medición.";

  const fecha = new Date(data.fechaMedicion);

  if (Number.isNaN(fecha.getTime())) return "La fecha de medición no es válida.";

  if (Number.isNaN(data.peso) || data.peso <= 0) return "Introduce un peso válido.";

  if (Number.isNaN(data.altura) || data.altura <= 0) return "Introduce una altura válida.";

  if (Number.isNaN(data.imc) || data.imc <= 0) return "El IMC calculado no es válido.";

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

    console.error("No se pudo guardar el registro antropométrico:", errorSubmit);

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

    console.error("No se pudo eliminar el registro antropométrico:", error);

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

  const confirmar = window.confirm("¿Quieres dar de baja a este paciente?");
  if (!confirmar) {
    if (elements.bajaBtn) elements.bajaBtn.disabled = false;
    return;
  }

  let motivo = "";
  try {
    const respuesta = window.prompt("Motivo de la baja (opcional):", "") ?? "";
    motivo = respuesta.trim();
  } catch {
    motivo = "";
  }

  try {
    await requestJson(`/pacientes/${encodeURIComponent(pacienteId)}/baja`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo })
    });
    await loadPaciente();
    alert("Paciente dado de baja correctamente.");
  } catch (error) {
    console.error("No se pudo dar de baja al paciente:", error);
    alert(error?.message || "No se pudo dar de baja al paciente.");
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

  const confirmar = window.confirm("¿Quieres reactivar al paciente?");
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

  elements.dietButton?.setAttribute("disabled", "disabled");

  elements.dietButton?.addEventListener("click", (event) => {
    event.preventDefault();
    const nutricionPacienteId = getNutricionPacienteId(pacienteActual);
    const destino = Number.isFinite(nutricionPacienteId)
      ? "dietas.html?pacienteId=" + encodeURIComponent(nutricionPacienteId)
      : "dietas.html";
    window.location.href = destino;
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





const renderPacienteDietas = (dietas) => {
  const container = elements.dietSummary;
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(dietas) || !dietas.length) {
    container.dataset.empty = "No hay dietas asignadas actualmente.";
    return;
  }

  const items = dietas
    .map((dieta) => {
      const estadoLabel = dieta.es_plantilla
        ? "Plantilla"
        : dieta.activa
        ? "Activa"
        : "Hist&oacute;rica";
      const meta = [];
      if (dieta.objetivo) {
        meta.push(dieta.objetivo);
      }
      if (typeof dieta.calorias_objetivo === "number" && Number.isFinite(dieta.calorias_objetivo)) {
        meta.push(`${formatNumber(dieta.calorias_objetivo, 0)} kcal`);
      }
      if (dieta.fecha_inicio) {
        meta.push(`Inicio: ${formatDate(dieta.fecha_inicio)}`);
      }
      if (dieta.fecha_fin) {
        meta.push(`Fin: ${formatDate(dieta.fecha_fin)}`);
      }
      const asignacionActual = Array.isArray(dieta.asignaciones)
        ? dieta.asignaciones.find((item) => item.es_actual)
        : null;
      if (asignacionActual?.fecha_asignacion) {
        meta.push(`Asignada: ${formatDate(asignacionActual.fecha_asignacion)}`);
      }
      if (dieta.activa === false) {
        meta.push("Estado: inactiva");
      }
      const metaHtml = meta.length
        ? `<div class="diet-card__item-meta">${meta.map((valor) => `<span>${escapeHtml(valor)}</span>`).join("")}</div>`
        : "";
      const descripcion = dieta.descripcion
        ? `<div class="diet-card__item-note">${escapeHtml(dieta.descripcion).replace(/\n/g, "<br />")}</div>`
        : "";
      const notas = dieta.notas
        ? `<div class="diet-card__item-note">${escapeHtml(dieta.notas).replace(/\n/g, "<br />")}</div>`
        : "";
      return `
        <div class="diet-card__item">
          <div class="diet-card__item-head">
            <strong>${escapeHtml(dieta.nombre || "Plan nutricional")}</strong>
            <span class="badge">${estadoLabel} - V${dieta.version || 1}</span>
          </div>
          ${metaHtml}
          ${descripcion}
          ${notas}
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

  const nutricionId = getNutricionPacienteId(paciente);
  if (!Number.isFinite(nutricionId)) {
    container.innerHTML = "<p class=\"diet-card__item-note\">Asigna el identificador num&eacute;rico del paciente en el gestor de nutrici&oacute;n para vincular sus dietas.</p>";
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
  }
};


