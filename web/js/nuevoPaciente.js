"use strict";

const buildGestionBases = () => {
  const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
  const hostname = (window.location.hostname || "localhost").toLowerCase();
  const port = window.location.port;
  const isLocal = !hostname || hostname === "localhost" || hostname === "127.0.0.1";
  const targetHost = isLocal ? "localhost" : hostname;

  const candidates = [`${protocol}//${targetHost}:5000/gestion`];
  if (port && (port === "5000" || port === "4001")) {
    candidates.push(`${protocol}//${targetHost}:${port}/gestion`);
  } else if (!port || port === "80" || port === "443") {
    candidates.push(`${protocol}//${targetHost}/gestion`);
  }

  const seen = new Set();
  return candidates
    .filter(Boolean)
    .map((base) => base.replace(/\/+$/, ""))
    .filter((base) => {
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    });
};

const GESTION_BASES = buildGestionBases();
const API_BASE_URL = GESTION_BASES[0];
const API_URL = `${API_BASE_URL}/api`;
const API_FALLBACK = GESTION_BASES[1] || null;
const LOGIN_PAGE = "login.html";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{9}$/;

let usuarioActual = null;
let roleContextReady = true;
const normalizePhone = (value = "") => value.replace(/\D/g, "");
const normalizeRole = (value = "") => value.toString().trim().toLowerCase();
const requiresProfessionalSelection = () => {
  const role = normalizeRole(usuarioActual?.rolSistema || usuarioActual?.rol);
  return role === "recepcionista" || role === "administrador" || role === "admin";
};

const elements = {
  form: null,
  nombre: null,
  apellidos: null,
  fechaNac: null,
  email: null,
  telefono: null,
  profesionalField: null,
  profesionalSelect: null,
  helperText: null,
  feedback: null,
  submit: null,
  cancel: null,
  back: null
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

const cleanUiMessage = (message, fallback = "") => {
  const raw = String(message || "").trim();
  if (!raw) {
    return fallback;
  }
  const cleaned = raw
    .replace(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s"']*)?/gi, "el servidor")
    .replace(/\b(?:localhost|127\.0\.0\.1)(?::\d+)?\b/gi, "el servidor")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
};

const setFeedback = (message, isSuccess = false) => {
  if (!elements.feedback) return;
  elements.feedback.textContent = cleanUiMessage(message, "");
  elements.feedback.classList.toggle("success", Boolean(isSuccess));
};

const setHelperText = (message) => {
  if (!elements.helperText) return;
  elements.helperText.textContent = message || "";
};

const toggleSubmitting = (isSubmitting) => {
  if (elements.submit) {
    const blockedByRoleContext = requiresProfessionalSelection() && !roleContextReady;
    elements.submit.disabled = isSubmitting || blockedByRoleContext;
    elements.submit.textContent = isSubmitting ? "Guardando..." : "Guardar paciente";
  }
  if (elements.cancel) {
    elements.cancel.disabled = isSubmitting;
  }
};

const buildHeaders = (baseHeaders = {}) => {
  const headers = Object.assign({ Accept: "application/json" }, baseHeaders || {});
  try {
    const stored = getStoredUser();
    const token =
      (stored && (stored.token || stored.accessToken || stored.authToken)) ||
      (usuarioActual && (usuarioActual.token || usuarioActual.accessToken || usuarioActual.authToken));
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("No se pudo preparar la cabecera de autorizacion:", error);
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
        let errorMessage = `Error HTTP ${response.status}`;
        try {
          const text = await response.text();
          if (text) {
            try {
              const json = JSON.parse(text);
              if (json && typeof json.mensaje === "string") {
                errorMessage = json.mensaje;
              } else if (json && typeof json.message === "string") {
                errorMessage = json.message;
              } else {
                errorMessage = text;
              }
            } catch {
              errorMessage = text;
            }
          }
        } catch {
          // noop
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      if (response.status === 204) {
        return null;
      }

      const text = await response.text();
      if (!text) {
        return null;
      }
      try {
        return JSON.parse(text);
      } catch {
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
  throw new Error("No se pudo completar la peticion.");
};

const fetchProfesionalesActivos = async () => {
  const response = await requestJson("/usuarios?limit=200");
  const data = Array.isArray(response?.data) ? response.data : [];
  return data.filter((usuario) => {
    const rolSistema = normalizeRole(usuario?.rolSistema || usuario?.rol);
    const esProfesional = rolSistema === "profesional del centro" || rolSistema === "profesional";
    return esProfesional && usuario?.activo !== false;
  });
};

const getDisplayName = (usuario = {}) => {
  const fullName = (usuario.nombreCompleto || "").trim();
  if (fullName) return fullName;
  const merged = `${usuario.nombre || ""} ${usuario.apellidos || ""}`.replace(/\s+/g, " ").trim();
  if (merged) return merged;
  return usuario.nombreUsuario || usuario.email || "Profesional";
};

const loadProfessionalContext = async () => {
  const needsSelector = requiresProfessionalSelection();
  if (!elements.profesionalField || !elements.profesionalSelect) {
    roleContextReady = !needsSelector;
    return;
  }

  if (!needsSelector) {
    elements.profesionalField.hidden = true;
    elements.profesionalSelect.required = false;
    elements.profesionalSelect.disabled = true;
    setHelperText("Al guardar, el paciente quedara asociado a tu agenda de forma automatica.");
    roleContextReady = true;
    return;
  }

  roleContextReady = false;
  elements.profesionalField.hidden = false;
  elements.profesionalSelect.required = true;
  elements.profesionalSelect.disabled = true;
  elements.profesionalSelect.innerHTML =
    '<option value="" selected disabled>Cargando profesionales...</option>';
  setHelperText(
    "Al guardar, selecciona el profesional responsable para asociar el paciente a su agenda."
  );
  setFeedback("Cargando profesionales activos...", false);

  try {
    const profesionales = await fetchProfesionalesActivos();
    if (!profesionales.length) {
      throw new Error("No hay profesionales activos disponibles para asignacion.");
    }

    elements.profesionalSelect.innerHTML = [
      '<option value="" selected disabled>Selecciona un profesional</option>',
      ...profesionales.map(
        (usuario) =>
          `<option value="${usuario.idUsuario}">${getDisplayName(usuario)}</option>`
      )
    ].join("");

    elements.profesionalSelect.disabled = false;
    roleContextReady = true;
    setFeedback("", false);
  } catch (error) {
    roleContextReady = false;
    elements.profesionalSelect.innerHTML =
      '<option value="" selected disabled>No disponible</option>';
    setFeedback(error?.message || "No se pudieron cargar profesionales.", false);
  }
};

const serializeForm = () => ({
  nombrePaciente: elements.nombre?.value?.trim() || "",
  apellidos: elements.apellidos?.value?.trim() || "",
  fechaNac: elements.fechaNac?.value || "",
  emailPaciente: elements.email?.value?.trim().toLowerCase() || "",
  telefono: normalizePhone(elements.telefono?.value || "")
});

const validateForm = (data) => {
  if (!data.nombrePaciente || data.nombrePaciente.length < 2) {
    return "Introduce el nombre del paciente.";
  }
  if (!data.apellidos || data.apellidos.length < 2) {
    return "Introduce los apellidos del paciente.";
  }
  if (!data.fechaNac) {
    return "Selecciona la fecha de nacimiento.";
  }
  const fecha = new Date(data.fechaNac);
  if (Number.isNaN(fecha.getTime())) {
    return "La fecha de nacimiento no es valida.";
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (fecha > hoy) {
    return "La fecha de nacimiento no puede ser futura.";
  }
  if (!data.emailPaciente || !EMAIL_REGEX.test(data.emailPaciente)) {
    return "Introduce un email valido.";
  }
  const telefonoDigits = normalizePhone(data.telefono);
  if (!telefonoDigits || !PHONE_REGEX.test(telefonoDigits)) {
    return "El número de teléfono debe tener exactamente 9 dígitos.";
  }
  return null;
};

const resolveProfesionalAsignado = () => {
  if (requiresProfessionalSelection()) {
    return elements.profesionalSelect?.value?.trim() || "";
  }
  return usuarioActual?.idUsuario || "";
};

const createPaciente = async (payload) =>
  requestJson("/pacientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

const vincularPacienteConProfesional = async (idPaciente, idUsuarioAsignado) => {
  if (!idUsuarioAsignado) {
    throw new Error("Selecciona un profesional para asignar el paciente.");
  }
  return requestJson("/pacientes-usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idPaciente,
      idUsuario: idUsuarioAsignado
    })
  });
};

const handleSubmit = async (event) => {
  event.preventDefault();
  if (!elements.form) {
    return;
  }

  if (!roleContextReady) {
    setFeedback("Espera a que termine la carga de profesionales.", false);
    return;
  }

  setFeedback("");
  const formData = serializeForm();
  const validationError = validateForm(formData);
  if (validationError) {
    setFeedback(validationError, false);
    return;
  }

  const profesionalAsignado = resolveProfesionalAsignado();
  if (!profesionalAsignado) {
    setFeedback("Selecciona el profesional asignado para continuar.", false);
    return;
  }

  toggleSubmitting(true);

  try {
    const paciente = await createPaciente(formData);
    if (!paciente || !(paciente.idPaciente || paciente._id)) {
      throw new Error("No se obtuvo la información del paciente creado.");
    }
    const pacienteId = paciente.idPaciente || paciente._id;

    await vincularPacienteConProfesional(pacienteId, profesionalAsignado);

    setFeedback("Paciente creado y asociado correctamente.", true);
    elements.form.reset();
    if (elements.profesionalSelect && requiresProfessionalSelection()) {
      elements.profesionalSelect.selectedIndex = 0;
    }

    setTimeout(() => {
      window.location.href = "principal.html";
    }, 1200);
  } catch (error) {
    console.warn("No se pudo registrar el paciente:", error);
    setFeedback(error?.message || "No se pudo registrar el paciente.", false);
  } finally {
    toggleSubmitting(false);
  }
};

const handleCancel = (event) => {
  event.preventDefault();
  window.location.href = "principal.html";
};

const init = async () => {
  elements.form = document.getElementById("newPatientForm");
  elements.nombre = document.getElementById("nombrePaciente");
  elements.apellidos = document.getElementById("apellidosPaciente");
  elements.fechaNac = document.getElementById("fechaNac");
  elements.email = document.getElementById("emailPaciente");
  elements.telefono = document.getElementById("telefonoPaciente");
  elements.profesionalField = document.getElementById("profesionalAsignadoField");
  elements.profesionalSelect = document.getElementById("profesionalAsignado");
  elements.helperText = document.getElementById("asignacionHelperText");
  elements.feedback = document.getElementById("formFeedback");
  elements.submit = document.getElementById("submitPaciente");
  elements.cancel = document.getElementById("cancelarRegistro");
  elements.back = document.getElementById("volverPrincipal");

  const user = getStoredUser();
  if (!user) {
    window.location.href = LOGIN_PAGE;
    return;
  }
  usuarioActual = user;

  await loadProfessionalContext();
  toggleSubmitting(false);

  elements.form?.addEventListener("submit", handleSubmit);
  elements.cancel?.addEventListener("click", handleCancel);
  elements.back?.addEventListener("click", handleCancel);
};

document.addEventListener("DOMContentLoaded", () => {
  init();
});


