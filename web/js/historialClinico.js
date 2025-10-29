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

const state = {
  page: 1,
  pageSize: 10,
  total: 0,
  pages: 1,
  search: "",
  loading: false,
  debounceId: null
};

const elements = {
  search: null,
  tableBody: null,
  pager: null,
  prev: null,
  next: null,
  pagerInfo: null,
  status: null,
  back: null
};

let usuarioActual = null;

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

const formatDate = (value) => {
  if (!value) return "";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    return "";
  }
  return fecha.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const calculateAge = (fechaNac) => {
  if (!fechaNac) return "";
  const nacimiento = new Date(fechaNac);
  if (Number.isNaN(nacimiento.getTime())) {
    return "";
  }
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad -= 1;
  }
  return `${edad} años`;
};

const setStatus = (message) => {
  if (elements.status) {
    elements.status.textContent = message || "";
  }
};

const setLoading = (isLoading) => {
  state.loading = isLoading;
  const body = elements.tableBody;
  if (!body) return;

  if (isLoading) {
    body.innerHTML = `<tr><td colspan="5" class="empty">Cargando pacientes...</td></tr>`;
  }
};

const renderPatients = (items) => {
  const body = elements.tableBody;
  if (!body) return;

  if (!Array.isArray(items) || items.length === 0) {
    const emptyText = body.dataset.empty || "No se encontraron pacientes.";
    body.innerHTML = `<tr><td colspan="5" class="empty">${emptyText}</td></tr>`;
    return;
  }

  const rows = items
    .map((paciente) => {
      const nombre = `${paciente.nombrePaciente || ""} ${paciente.apellidos || ""}`.trim() || "-";
      const email = paciente.emailPaciente || "—";
      const telefono = paciente.telefono || "—";
      const edad = calculateAge(paciente.fechaNac);
      const updated = formatDate(paciente.updatedAt || paciente.createdAt);
      const id = paciente.idPaciente || paciente._id || paciente.id;
      return `<tr>
        <td>
          <div class="paciente-name">${nombre}</div>
          <div class="paciente-meta">${email}</div>
        </td>
        <td>${edad || "—"}</td>
        <td>
          <span class="pill">Tel: ${telefono}</span>
        </td>
        <td>${updated || "—"}</td>
        <td style="text-align:right;">
          <a class="action-link" href="pacienteDetalle.html?id=${encodeURIComponent(id)}">Ver ficha</a>
        </td>
      </tr>`;
    })
    .join("");

  body.innerHTML = rows;
};

const renderPager = () => {
  if (!elements.pager || !elements.prev || !elements.next || !elements.pagerInfo) {
    return;
  }
  if (state.pages <= 1) {
    elements.pager.hidden = true;
    return;
  }
  elements.pager.hidden = false;
  elements.prev.disabled = state.page <= 1;
  elements.next.disabled = state.page >= state.pages;
  elements.pagerInfo.textContent = `Página ${state.page} de ${state.pages} · ${state.total} pacientes`;
};

const fetchPatients = async () => {
  setLoading(true);
  setStatus("Buscando pacientes…");

  const params = new URLSearchParams({
    page: String(state.page),
    limit: String(state.pageSize)
  });
  if (state.search) {
    params.set("buscar", state.search);
  }

  try {
    const response = await requestJson(`/pacientes?${params.toString()}`);
    let items = [];
    if (response && Array.isArray(response.items)) {
      items = response.items;
      state.total = response.total ?? response.items.length;
      state.pages = response.pages ?? 1;
    } else if (Array.isArray(response)) {
      items = response;
      state.total = items.length;
      state.pages = 1;
    } else {
      items = [];
      state.total = 0;
      state.pages = 1;
    }

    renderPatients(items);
    renderPager();
    const summary =
      state.total === 0
        ? "No se encontraron pacientes."
        : `${state.total} paciente${state.total === 1 ? "" : "s"} encontrados.`;
    setStatus(summary);
  } catch (error) {
    console.error("No se pudieron cargar los pacientes:", error);
    renderPatients([]);
    setStatus(error?.message || "No se pudieron cargar los pacientes.");
  } finally {
    setLoading(false);
  }
};

const handleSearchInput = (event) => {
  state.search = event.target.value?.trim() || "";
  state.page = 1;

  if (state.debounceId) {
    window.clearTimeout(state.debounceId);
  }
  state.debounceId = window.setTimeout(() => {
    fetchPatients();
  }, 350);
};

const handlePrevPage = () => {
  if (state.page <= 1) return;
  state.page -= 1;
  fetchPatients();
};

const handleNextPage = () => {
  if (state.page >= state.pages) return;
  state.page += 1;
  fetchPatients();
};

const handleBack = (event) => {
  event.preventDefault();
  window.location.href = "principal.html";
};

const init = () => {
  usuarioActual = getStoredUser();
  if (!usuarioActual) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  elements.search = document.getElementById("buscarPacientes");
  elements.tableBody = document.getElementById("patientsTableBody");
  elements.pager = document.getElementById("pager");
  elements.prev = document.getElementById("prevPage");
  elements.next = document.getElementById("nextPage");
  elements.pagerInfo = document.getElementById("pagerInfo");
  elements.status = document.getElementById("listStatus");
  elements.back = document.getElementById("volverPanel");

  elements.search?.addEventListener("input", handleSearchInput);
  elements.prev?.addEventListener("click", handlePrevPage);
  elements.next?.addEventListener("click", handleNextPage);
  elements.back?.addEventListener("click", handleBack);

  fetchPatients();
};

document.addEventListener("DOMContentLoaded", init);

