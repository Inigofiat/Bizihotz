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

const state = {
  page: 1,
  pageSize: 10,
  total: 0,
  pages: 1,
  search: "",
  loading: false,
  debounceId: null,
  scope: "all",
  counts: {
    all: null,
    mine: null
  }
};

const elements = {
  search: null,
  tableBody: null,
  pager: null,
  prev: null,
  next: null,
  pagerInfo: null,
  status: null,
  back: null,
  scopeToggle: null,
  scopeButtons: []
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

const resolveDefaultScope = () => "mine";

const updateScopeButtons = () => {
  if (!Array.isArray(elements.scopeButtons)) {
    return;
  }

  elements.scopeButtons.forEach((button) => {
    const scopeValue = button.dataset.scope || "";
    const isActive = scopeValue === state.scope;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");

    const countNode = button.querySelector(".view-toggle__count");
    if (countNode) {
      const totalValue = state.counts?.[scopeValue];
      countNode.textContent = Number.isFinite(totalValue) ? String(totalValue) : "";
    }
  });
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
    const emptyFallback =
      state.scope === "mine" ? "No tienes pacientes asignados." : "No se encontraron pacientes.";
    const emptyText = body.dataset.empty || emptyFallback;
    body.innerHTML = `<tr><td colspan="5" class="empty">${emptyText}</td></tr>`;
    return;
  }

  const rows = items
    .map((paciente) => {
      const nombre = `${paciente.nombrePaciente || ""} ${paciente.apellidos || ""}`.trim() || "-";
      const email = paciente.emailPaciente || "N/D";
      const telefono = paciente.telefono || "N/D";
      const edad = calculateAge(paciente.fechaNac);
      const updated = formatDate(paciente.updatedAt || paciente.createdAt);
      const id = paciente.idPaciente || paciente._id || paciente.id;
      const estado = String(paciente.estado || "").toLowerCase();
      const enStandby = estado === "standby" || estado === "baja";
      const standbyBadge = enStandby ? `<span class="pill pill--standby">Standby</span>` : "";
      return `<tr class="${enStandby ? "is-standby" : ""}">
        <td>
          <div class="paciente-name">${nombre} ${standbyBadge}</div>
          <div class="paciente-meta">${email}</div>
        </td>
        <td>${edad || "N/D"}</td>
        <td>
          <span class="pill">Tel: ${telefono}</span>
        </td>
        <td>${updated || "N/D"}</td>
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
    limit: String(state.pageSize),
    sort: "nombrePaciente:asc"
  });
  params.set("scope", state.scope === "all" ? "all" : "mine");
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

    if (state.counts && state.scope) {
      state.counts[state.scope] = state.total;
    }
    updateScopeButtons();

    const normalize = (value = "") =>
      String(value || "")
        .toLocaleLowerCase("es-ES")
        .trim();

    const fullName = (paciente) =>
      normalize(`${paciente?.nombrePaciente || ""} ${paciente?.apellidos || ""}`);

    items = items
      .slice()
      .sort((a, b) => fullName(a).localeCompare(fullName(b), "es-ES"));

    renderPatients(items);
    renderPager();
    const scopeLabel = state.scope === "mine" ? "mis pacientes" : "todos los pacientes";
    const summary =
      state.total === 0
        ? `No se encontraron pacientes en ${scopeLabel}.`
        : `${state.total} paciente${state.total === 1 ? "" : "s"} en ${scopeLabel}.`;
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

const handleScopeClick = (event) => {
  const button = event.target.closest("[data-scope]");
  if (!button || !elements.scopeToggle?.contains(button)) {
    return;
  }
  const nextScope = button.dataset.scope;
  if (!nextScope || nextScope === state.scope) {
    return;
  }
  state.scope = nextScope;
  state.page = 1;
  updateScopeButtons();
  fetchPatients();
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

const fetchScopeTotal = async (scopeValue) => {
  const params = new URLSearchParams({
    page: "1",
    limit: "1",
    sort: "nombrePaciente:asc",
    scope: scopeValue === "all" ? "all" : "mine"
  });

  try {
    const response = await requestJson(`/pacientes?${params.toString()}`);
    if (response && typeof response.total === "number") {
      state.counts[scopeValue] = response.total;
    } else if (Array.isArray(response)) {
      state.counts[scopeValue] = response.length;
    }
    updateScopeButtons();
  } catch (error) {
    console.warn(`No se pudo obtener el total para scope=${scopeValue}:`, error);
  }
};

const prefetchCounts = () => {
  // Siempre queremos mostrar los totales iniciales en ambos botones.
  fetchScopeTotal("all");
  fetchScopeTotal("mine");
};

const handleBack = (event) => {
  if (event?.currentTarget?.tagName === "A") {
    return;
  }
  event?.preventDefault();
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
  elements.scopeToggle = document.getElementById("scopeToggle");
  elements.scopeButtons = elements.scopeToggle
    ? Array.from(elements.scopeToggle.querySelectorAll("[data-scope]"))
    : [];

  state.scope = resolveDefaultScope();
  updateScopeButtons();

  elements.search?.addEventListener("input", handleSearchInput);
  elements.scopeToggle?.addEventListener("click", handleScopeClick);
  elements.prev?.addEventListener("click", handlePrevPage);
  elements.next?.addEventListener("click", handleNextPage);
  elements.back?.addEventListener("click", handleBack);

  prefetchCounts();
  fetchPatients();
};

document.addEventListener("DOMContentLoaded", init);

