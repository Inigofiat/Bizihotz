"use strict";

const API_BASE_URL = (() => {
  const gatewayBase = "http://localhost:5000/gestion";
  const serviceBase = "http://localhost:4001";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{6,20}$/;

let usuarioActual = null;

const elements = {
  form: null,
  nombre: null,
  apellidos: null,
  fechaNac: null,
  email: null,
  telefono: null,
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

const setFeedback = (message, isSuccess = false) => {
  if (!elements.feedback) return;
  elements.feedback.textContent = message || "";
  elements.feedback.classList.toggle("success", Boolean(isSuccess));
};

const toggleSubmitting = (isSubmitting) => {
  if (elements.submit) {
    elements.submit.disabled = isSubmitting;
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
    console.warn("No se pudo preparar la cabecera de autorización:", error);
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
  throw new Error("No se pudo completar la petición.");
};

const serializeForm = () => ({
  nombrePaciente: elements.nombre?.value?.trim() || "",
  apellidos: elements.apellidos?.value?.trim() || "",
  fechaNac: elements.fechaNac?.value || "",
  emailPaciente: elements.email?.value?.trim().toLowerCase() || "",
  telefono: elements.telefono?.value?.trim() || ""
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
    return "La fecha de nacimiento no es válida.";
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (fecha > hoy) {
    return "La fecha de nacimiento no puede ser futura.";
  }
  if (!data.emailPaciente || !EMAIL_REGEX.test(data.emailPaciente)) {
    return "Introduce un email válido.";
  }
  if (!data.telefono || !PHONE_REGEX.test(data.telefono)) {
    return "Introduce un teléfono válido.";
  }
  return null;
};

const createPaciente = async (payload) =>
  requestJson("/pacientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

const vincularPacienteConProfesional = async (idPaciente) => {
  if (!usuarioActual?.idUsuario) {
    throw new Error("No se pudo determinar el usuario actual.");
  }
  return requestJson("/pacientes-usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idPaciente,
      idUsuario: usuarioActual.idUsuario
    })
  });
};

const handleSubmit = async (event) => {
  event.preventDefault();
  if (!elements.form) {
    return;
  }

  setFeedback("");
  const formData = serializeForm();
  const validationError = validateForm(formData);
  if (validationError) {
    setFeedback(validationError, false);
    return;
  }

  toggleSubmitting(true);

  try {
    const paciente = await createPaciente(formData);
    if (!paciente || !(paciente.idPaciente || paciente._id)) {
      throw new Error("No se obtuvo la información del paciente creado.");
    }
    const pacienteId = paciente.idPaciente || paciente._id;

    try {
      await vincularPacienteConProfesional(pacienteId);
    } catch (error) {
      // si la vinculación falla por duplicado, informamos pero no revertimos el alta
      if (error?.status !== 409) {
        throw error;
      }
    }

    setFeedback("Paciente creado y asociado correctamente.", true);
    elements.form.reset();

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

const init = () => {
  elements.form = document.getElementById("newPatientForm");
  elements.nombre = document.getElementById("nombrePaciente");
  elements.apellidos = document.getElementById("apellidosPaciente");
  elements.fechaNac = document.getElementById("fechaNac");
  elements.email = document.getElementById("emailPaciente");
  elements.telefono = document.getElementById("telefonoPaciente");
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

  elements.form?.addEventListener("submit", handleSubmit);
  elements.cancel?.addEventListener("click", handleCancel);
  elements.back?.addEventListener("click", handleCancel);
};

document.addEventListener("DOMContentLoaded", init);

