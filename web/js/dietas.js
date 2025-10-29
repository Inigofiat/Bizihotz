"use strict";

(() => {
  const UNIQUE = (values) => [...new Set(values.filter(Boolean).map((value) => value.replace(/\/\/+$/, "")))];

  const resolveGatewayBase = () => {
    const protocol = window.location.protocol;
    const hostname = (window.location.hostname || "").toLowerCase();
    if (protocol === "file:") {
      return "http://localhost:5000";
    }
    if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
      const baseHost = hostname || "localhost";
      return `${protocol}//${baseHost}:5000`;
    }
    return `${protocol}//${window.location.host}`;
  };

  const resolveNutritionGateway = () => `${resolveGatewayBase()}/nutricion`;
  const resolveGestionGateway = () => `${resolveGatewayBase()}/gestion`;
  const DEFAULT_NUTRICION_USUARIO_ID = 1;
  const isGestionObjectId = (value) => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value.trim());

  const NUTRICION_API_BASES = UNIQUE([resolveNutritionGateway()]).map((base) => `${base}/api`);
  const GESTION_API_BASES = UNIQUE([resolveGestionGateway()]).map((base) => `${base}/api`);

  const LOGIN_PAGE = "login.html";
  const EMPTY_STATE_MESSAGES = {
    dietas: "Todavia no hay dietas registradas.",
    recetas: "Todavia no hay recetas registradas. Usa \"+ Nueva receta\" para crear la primera.",
    alimentos: "Aun no se cargo ningun alimento."
  };
  const STATIC_PATIENT_HINTS = Object.freeze({});
  const errorSources = new Set();
  let alertTimer;

  const hideAlert = () => {
    const alertNode = document.getElementById("globalAlert");
    if (!alertNode) return;
    alertNode.hidden = true;
    alertNode.textContent = "";
    alertNode.className = "global-alert";
  };

  const setGlobalAlert = (message = "", variant = "info") => {
    const alertNode = document.getElementById("globalAlert");
    if (!alertNode) return;
    clearTimeout(alertTimer);
    if (!message) {
      hideAlert();
      return;
    }
    alertNode.textContent = message;
    alertNode.className = `global-alert global-alert--${variant}`;
    alertNode.hidden = false;
    if (variant !== "error") {
      alertTimer = setTimeout(() => {
        if (errorSources.size === 0) {
          hideAlert();
        }
      }, 4200);
    }
  };

  const registerError = (source, message) => {
    errorSources.add(source);
    setGlobalAlert(message, "error");
  };

  const clearError = (source) => {
    if (errorSources.has(source)) {
      errorSources.delete(source);
      if (errorSources.size === 0) {
        setGlobalAlert("");
      }
    }
  };

  const markSuccess = (source, message) => {
    errorSources.delete(source);
    setGlobalAlert(message, "success");
  };

  const setListPlaceholder = (element, message) => {
    if (!element) return;
    element.dataset.empty = message;
    element.innerHTML = "";
  };

  const toNumericId = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number.parseInt(value, 10);
    }
    return Number.NaN;
  };

  const resolveUsuarioId = (usuario) => {
    if (!usuario || typeof usuario !== "object") {
      return DEFAULT_NUTRICION_USUARIO_ID;
    }
    const candidates = [
      usuario.idUsuario,
      usuario.usuarioId,
      usuario.id_usuario,
      usuario.id,
      usuario._id,
      usuario?.usuario?.idUsuario,
      usuario?.usuario?.id,
      usuario?.idNutricion,
      usuario?.nutricionId
    ];
    for (const candidate of candidates) {
      const numeric = toNumericId(candidate);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return DEFAULT_NUTRICION_USUARIO_ID;
  };

  const normalizePatientId = (value) => {
    if (value === null || typeof value === "undefined") return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "object") {
      return normalizePatientId(
        value?.idPaciente ?? value?.id ?? value?._id ?? value?.paciente_id ?? value?.pacienteId
      );
    }
    return null;
  };

  const state = {
    usuario: null,
    dietas: [],
    dietasRaw: [],
    recetas: [],
    alimentos: [],
    pacientes: [],
    pacientesLoaded: false,
    dietSearch: "",
    recetaSearch: "",
    alimentoSearch: "",
    initialPacienteFilter: "",
    filters: {
      mostrarPlantillas: true,
      mostrarPersonalizadas: true,
      estado: "todas",
      asignacion: "todas"
    },
    ui: {
      activeTab: "catalogo",
      selectedDietaId: null,
      assignmentSearch: "",
      assignmentEstado: "vigentes"
    },
    modalContext: {
      dieta: null
    },
    editing: {
      alimentoId: null,
      recetaId: null,
      dietaId: null
    }
  };
  const patientCache = new Map();
  const patientPromises = new Map();
  let pacientesListPromise = null;

  const getStoredUser = () => {
    try {
      const raw = localStorage.getItem("bizihotzUsuario");
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn("No se pudo interpretar el usuario almacenado:", error);
      return null;
    }
  };

  const updateLocalUser = (patch = {}) => {
    if (!state.usuario) return;
    state.usuario = { ...state.usuario, ...patch };
    try {
      localStorage.setItem("bizihotzUsuario", JSON.stringify(state.usuario));
    } catch (error) {
      console.warn("No se pudo actualizar el usuario en localStorage:", error);
    }
  };

  const buildHeaders = (baseHeaders = {}) => {
    const headers = Object.assign({ Accept: "application/json" }, baseHeaders || {});
    const token =
      state.usuario?.token ||
      state.usuario?.accessToken ||
      state.usuario?.authToken ||
      state.usuario?.jwt ||
      state.usuario?.jwtToken;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  const parseErrorResponse = async (response) => {
    const fallback = `Error HTTP ${response.status || ""}`.trim();
    try {
      const text = await response.text();
      if (!text) return fallback;
      try {
        const json = JSON.parse(text);
        if (typeof json?.detail === "string") return json.detail;
        if (json?.mensaje) return json.mensaje;
        if (json?.message) return json.message;
        if (Array.isArray(json?.detail) && json.detail[0]?.msg) return json.detail[0].msg;
      } catch {
        return text;
      }
      return text;
    } catch {
      return fallback;
    }
  };

  const redirectToLogin = () => {
    localStorage.removeItem("bizihotzUsuario");
    window.location.href = LOGIN_PAGE;
  };

  const requestJson = async (path, options = {}) => {
    let lastError = null;
    for (let index = 0; index < NUTRICION_API_BASES.length; index += 1) {
      const endpoint = `${NUTRICION_API_BASES[index]}${path}`;
      try {
        const response = await fetch(endpoint, { ...options, headers: buildHeaders(options.headers) });
        if (response.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!response.ok) {
          const error = new Error(await parseErrorResponse(response));
          error.status = response.status;
          lastError = error;
          continue;
        }
        if (response.status === 204) return null;
        const text = await response.text();
        if (!text) return null;
        return JSON.parse(text);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No se pudo contactar con el microservicio de nutricion.");
  };

  const requestBinary = async (path) => {
    let lastError = null;
    for (let index = 0; index < NUTRICION_API_BASES.length; index += 1) {
      const endpoint = `${NUTRICION_API_BASES[index]}${path}`;
      try {
        const response = await fetch(endpoint, { headers: buildHeaders() });
        if (response.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!response.ok) {
          const error = new Error(await parseErrorResponse(response));
          error.status = response.status;
          lastError = error;
          continue;
        }
        const blob = await response.blob();
        return {
          blob,
          disposition: response.headers.get("content-disposition") || ""
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No se pudo exportar la dieta seleccionada.");
  };
  const requestGestionJson = async (path, options = {}) => {
    let lastError = null;
    for (let index = 0; index < GESTION_API_BASES.length; index += 1) {
      const endpoint = `${GESTION_API_BASES[index]}${path}`;
      try {
        const response = await fetch(endpoint, { ...options, headers: buildHeaders(options.headers) });
        if (response.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!response.ok) {
          const error = new Error(await parseErrorResponse(response));
          error.status = response.status;
          lastError = error;
          continue;
        }
        if (response.status === 204) {
          return null;
        }
        const text = await response.text();
        if (!text) return null;
        return JSON.parse(text);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No se pudo contactar con el servicio de gestion.");
  };
  const getStaticPatientName = (value) => {
    const normalized = normalizePatientId(value);
    if (!normalized) return null;
    const numeric = toNumericId(normalized);
    const hint = Number.isFinite(numeric) ? STATIC_PATIENT_HINTS[numeric] : null;
    if (!hint) {
      return null;
    }
    const nombre = (hint.nombre || "").trim();
    const apellidos = (hint.apellidos || "").trim();
    const completo = [nombre, apellidos].filter(Boolean).join(" ").trim();
    return { id: normalized, nombre, apellidos, completo };
  };
  const storePatientRecord = (paciente, { isHint = false } = {}) => {
    if (!paciente || typeof paciente !== "object") {
      return null;
    }
    const pacienteId = normalizePatientId(paciente);
    if (!pacienteId) {
      return null;
    }
    const isObjectId = isGestionObjectId(pacienteId);
    const numericId = toNumericId(pacienteId);
    const nombre = [
      paciente.nombrePaciente || paciente.nombre || "",
      paciente.apellidos || paciente.apellido || ""
    ]
      .map((part) => (part || "").trim())
      .filter(Boolean)
      .join(" ");
    const fallbackHint = getStaticPatientName(pacienteId);
    const fallbackNombre = fallbackHint?.completo || "";
    let nombreCompleto = nombre || fallbackNombre;
    if (!nombreCompleto) {
      if (Number.isFinite(numericId)) {
        nombreCompleto = `Paciente #${numericId}`;
      } else if (!isObjectId) {
        nombreCompleto = pacienteId;
      } else {
        nombreCompleto = "Paciente sin nombre";
      }
    }
    if (isHint && isObjectId && /^Paciente\s*#\d+$/i.test(nombreCompleto)) {
      nombreCompleto = "";
    }
    const email = (paciente.emailPaciente || paciente.email || "").trim();
    const telefono = (paciente.telefono || paciente.telefonoPaciente || "").trim();
    patientCache.set(pacienteId, {
      id: pacienteId,
      nombreCompleto,
      numericId: Number.isFinite(numericId) ? numericId : null,
      email,
      telefono,
      isHint
    });
    return patientCache.get(pacienteId);
  };
  const storePatientHint = (pacienteId, nombre = "", apellidos = "") => {
    const normalizedId = normalizePatientId(pacienteId);
    if (!normalizedId) return;
    const numericId = toNumericId(normalizedId);
    const nombreTrim = (nombre || "").trim();
    const apellidosTrim = (apellidos || "").trim();
    const fallbackHint = getStaticPatientName(normalizedId);
    if (!nombreTrim && !apellidosTrim && !fallbackHint) {
      return;
    }
    const record = patientCache.get(normalizedId);
    if (record?.nombreCompleto && (!record.numericId || record.nombreCompleto !== `Paciente #${record.numericId}`)) {
      return;
    }
    storePatientRecord({
      idPaciente: normalizedId,
      nombrePaciente: nombreTrim || fallbackHint?.nombre || "",
      apellidos: apellidosTrim || fallbackHint?.apellidos || ""
    }, { isHint: true });
  };
  const ensurePatientLoaded = (pacienteId) => {
    const normalizedId = normalizePatientId(pacienteId);
    if (!normalizedId) {
      return Promise.resolve();
    }
    if (patientCache.has(normalizedId)) {
      return Promise.resolve();
    }
    if (!isGestionObjectId(normalizedId)) {
      if (!patientCache.has(normalizedId)) {
        storePatientRecord(
          {
            idPaciente: normalizedId,
            nombrePaciente: "",
            apellidos: ""
          },
          { isHint: true }
        );
      }
      return Promise.resolve();
    }
    if (patientPromises.has(normalizedId)) {
      return patientPromises.get(normalizedId);
    }
    const promise = (async () => {
      try {
        const paciente = await requestGestionJson(`/pacientes/${normalizedId}`);
        if (paciente) {
          storePatientRecord(paciente);
        } else if (!patientCache.has(normalizedId)) {
          storePatientRecord(
            {
              idPaciente: normalizedId,
              nombrePaciente: "",
              apellidos: ""
            },
            { isHint: true }
          );
        }
      } catch (error) {
        console.warn(`No se pudo obtener el paciente ${normalizedId}:`, error);
        if (!patientCache.has(normalizedId)) {
          storePatientRecord(
            {
              idPaciente: normalizedId,
              nombrePaciente: "",
              apellidos: ""
            },
            { isHint: true }
          );
        }
      }
    })().finally(() => {
      patientPromises.delete(normalizedId);
    });
    patientPromises.set(normalizedId, promise);
    return promise;
  };
  const preloadDietPatients = async (dietas) => {
    if (!Array.isArray(dietas) || !dietas.length) {
      return;
    }
    const ids = new Set();
    dietas.forEach((dieta) => {
      const baseId = normalizePatientId(dieta.paciente_id);
      if (baseId) {
        ids.add(baseId);
      }
      if (Array.isArray(dieta.asignaciones)) {
        dieta.asignaciones.forEach((item) => {
          const asignadoId = normalizePatientId(item?.paciente_id);
          if (asignadoId) {
            ids.add(asignadoId);
          }
        });
      }
    });
    if (!ids.size) {
      return;
    }
    await Promise.all([...ids].map((id) => ensurePatientLoaded(id)));
  };
  const formatPatientName = (pacienteId, fallback = "") => {
    const normalizedId = normalizePatientId(pacienteId);
    if (!normalizedId) {
      return fallback || "";
    }
    const record = patientCache.get(normalizedId);
    if (record?.nombreCompleto) {
      return record.nombreCompleto;
    }
    const staticHint = getStaticPatientName(normalizedId);
    if (staticHint?.completo) {
      patientCache.set(normalizedId, {
        id: normalizedId,
        nombreCompleto: staticHint.completo,
        numericId: Number.isFinite(toNumericId(normalizedId)) ? toNumericId(normalizedId) : null,
        email: "",
        telefono: "",
        isHint: true
      });
      return staticHint.completo;
    }
    const numericId = toNumericId(normalizedId);
    if (Number.isFinite(numericId)) {
      const nombre = `Paciente #${numericId}`;
      patientCache.set(normalizedId, {
        id: normalizedId,
        nombreCompleto: nombre,
        numericId,
        email: "",
        telefono: "",
        isHint: true
      });
      return nombre;
    }
    if (!isGestionObjectId(normalizedId)) {
      patientCache.set(normalizedId, {
        id: normalizedId,
        nombreCompleto: normalizedId,
        numericId: null,
        email: "",
        telefono: "",
        isHint: true
      });
      return normalizedId;
    }
    return fallback || "";
  };
  const extractNombre = (source) => {
    if (!source || typeof source !== "object") {
      return "";
    }
    return (
      source.paciente_nombre ||
      source.pacienteNombre ||
      source.nombrePaciente ||
      source?.paciente?.nombrePaciente ||
      source?.paciente?.nombre ||
      ""
    );
  };
  const extractApellidos = (source) => {
    if (!source || typeof source !== "object") {
      return "";
    }
    return (
      source.paciente_apellidos ||
      source.pacienteApellidos ||
      source.apellidosPaciente ||
      source.apellidos ||
      source.apellido ||
      source?.paciente?.apellidos ||
      ""
    );
  };
  const buildPatientDisplayName = (source, fallback = "") => {
    if (source === null || typeof source === "undefined") {
      return fallback;
    }
    const nombre = (extractNombre(source) || "").trim();
    const apellidos = (extractApellidos(source) || "").trim();
    const composed = [nombre, apellidos].filter(Boolean).join(" ").trim();
    if (composed) {
      return composed;
    }
    const rawId =
      typeof source === "object"
        ? source.paciente_id ?? source.id ?? source._id ?? source
        : source;
    return formatPatientName(rawId, fallback) || fallback;
  };
  const PATIENT_SELECT_SELECTOR = "select[data-patient-select]";

  const buildPatientOptionLabel = (paciente, fallbackNombre = "") => {
    const normalizedId = normalizePatientId(paciente);
    const baseFallback = fallbackNombre || formatPatientName(normalizedId) || "";
    const baseName = buildPatientDisplayName(paciente, baseFallback) || baseFallback || "Paciente";
    const infoParts = [];
    const email = (paciente?.emailPaciente || paciente?.email || "").trim();
    if (email) {
      infoParts.push(email);
    }
    const telefono = (paciente?.telefono || paciente?.telefonoPaciente || "").trim();
    if (telefono) {
      infoParts.push(telefono);
    }
    const details = infoParts.length ? ` - ${infoParts.join(" | ")}` : "";
    return `${baseName}${details}`;
  };

  const buildFallbackPatientsList = (includeHints = true) => {
    const entries = new Map();
    patientCache.forEach((record) => {
      const id = normalizePatientId(record?.id);
      if (!id || entries.has(id)) return;
      if (!includeHints && record?.isHint) return;
      const fakePaciente = {
        idPaciente: id,
        nombrePaciente: record?.nombreCompleto || "",
        emailPaciente: record?.email || "",
        telefono: record?.telefono || ""
      };
      const label = buildPatientOptionLabel(fakePaciente, record?.nombreCompleto || "");
      entries.set(id, {
        id,
        label,
        raw: fakePaciente
      });
    });
    if (includeHints) {
      Object.entries(STATIC_PATIENT_HINTS).forEach(([idValue, hint]) => {
        const id = normalizePatientId(idValue);
        if (!id || entries.has(id)) return;
        const nombreCompleto = [hint?.nombre, hint?.apellidos].filter(Boolean).join(" ").trim();
        const fakePaciente = {
          idPaciente: id,
          nombrePaciente: hint?.nombre || "",
          apellidos: hint?.apellidos || ""
        };
        const label = buildPatientOptionLabel(fakePaciente, nombreCompleto);
        entries.set(id, { id, label, raw: fakePaciente });
      });
    }
    return Array.from(entries.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" })
    );
  };

  const updatePatientSelects = (targetSelect = null) => {
    const selects = targetSelect ? [targetSelect] : Array.from(document.querySelectorAll(PATIENT_SELECT_SELECTOR));
    selects.forEach((select) => {
      if (!select) return;
      const previousValue = select.value;
      let placeholder = select.querySelector('option[value=""]');
      if (!placeholder) {
        placeholder = document.createElement("option");
        placeholder.value = "";
        select.insertBefore(placeholder, select.firstChild || null);
      }
      placeholder.textContent = state.pacientesLoaded ? "Selecciona un paciente" : "Cargando pacientes...";
      select.querySelectorAll("option[data-paciente-option]").forEach((option) => option.remove());
      state.pacientes.forEach((paciente) => {
        const option = document.createElement("option");
        option.value = String(paciente.id);
        option.textContent = paciente.label;
        option.dataset.pacienteOption = "true";
        select.appendChild(option);
      });
      if (previousValue && select.querySelector(`option[value="${previousValue}"]`)) {
        select.value = previousValue;
      } else if (!state.pacientesLoaded) {
        select.value = "";
      }
    });
  };

  const loadPacientes = async (force = false) => {
    if (!force) {
      if (state.pacientesLoaded && state.pacientes.length) {
        return state.pacientes;
      }
      if (pacientesListPromise) {
        return pacientesListPromise;
      }
    }

    pacientesListPromise = (async () => {
      try {
        const response = await requestGestionJson("/pacientes?sort=nombrePaciente:asc");
        const items = Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : [];
        const unique = new Map();
        items.forEach((paciente) => {
          const record = storePatientRecord(paciente);
          if (!record) return;
          const label = buildPatientOptionLabel(paciente, record.nombreCompleto);
          unique.set(record.id, {
            id: record.id,
            label,
            raw: paciente
          });
        });
        state.pacientes = Array.from(unique.values()).sort((a, b) =>
          a.label.localeCompare(b.label, "es", { sensitivity: "base" })
        );
        if (!state.pacientes.length) {
          state.pacientes = buildFallbackPatientsList(false);
        }
        state.pacientesLoaded = state.pacientes.length > 0;
        updatePatientSelects();
        clearError("pacientes");
        return state.pacientes;
      } catch (error) {
        console.warn("No se pudieron cargar los pacientes:", error);
        state.pacientes = buildFallbackPatientsList();
        state.pacientesLoaded = state.pacientes.length > 0;
        if (state.pacientesLoaded) {
          updatePatientSelects();
        }
        registerError("pacientes", error?.message || "No se pudo cargar la lista de pacientes.");
        throw error;
      } finally {
        pacientesListPromise = null;
      }
    })();

    return pacientesListPromise;
  };

  const ensureSelectHasPatientOption = async (select, pacienteId) => {
    if (!select) return;
    const normalizedId = normalizePatientId(pacienteId);
    if (!normalizedId) {
      select.value = "";
      return;
    }
    if (!state.pacientesLoaded) {
      try {
        await loadPacientes();
      } catch (error) {
        return;
      }
    }
    await ensurePatientLoaded(normalizedId);
    const labelFallback = formatPatientName(normalizedId) || normalizedId;
    const record = patientCache.get(normalizedId);
    const pseudoPaciente = {
      idPaciente: normalizedId,
      nombrePaciente: record?.nombreCompleto || labelFallback,
      emailPaciente: record?.email || "",
      telefono: record?.telefono || ""
    };
    const label = buildPatientOptionLabel(pseudoPaciente, labelFallback).trim();
    if (!label) {
      select.value = "";
      return;
    }
    if (!select.querySelector(`option[value="${normalizedId}"]`)) {
      const option = document.createElement("option");
      option.value = normalizedId;
      option.textContent = label;
      option.dataset.pacienteOption = "true";
      select.appendChild(option);
    }
    select.value = normalizedId;
  };

  const buildDietTitle = (dieta) => {
    const nombre = (dieta?.nombre || "").trim();
    if (!nombre) {
      return "Plan nutricional";
    }
    const match = /^(.*?)(?:\s*-\s*Paciente\s*#?\s*(\d+))$/i.exec(nombre);
    if (match) {
      const base = match[1].trim();
      const pacienteNombre = formatPatientName(match[2]);
      if (pacienteNombre && !/^Paciente\s*#?\d+$/i.test(pacienteNombre)) {
        return `${base} - ${pacienteNombre}`;
      }
      return base || nombre;
    }
    return nombre;
  };

  const formatNumber = (value, decimals = 1) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "--";
    }
    const number = Number.parseFloat(value);
    if (!Number.isFinite(number)) {
      return "--";
    }
    return Number(number).toLocaleString("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };
  const escapeHtml = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const normalize = (value) => (value || "").toString().toLowerCase();

  const parseMicros = (raw) => {
    if (!raw) return {};
    const result = {};
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [key, value] = line.split(":").map((segment) => segment.trim());
        if (!key || !value) return;
        const numeric = Number.parseFloat(value.replace(",", "."));
        if (Number.isFinite(numeric)) {
          result[key] = numeric;
        }
      });
    return result;
  };

  const populateSelect = (select, options, placeholder = "Selecciona...") => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";
    const baseOption = document.createElement("option");
    baseOption.value = "";
    baseOption.textContent = placeholder;
    select.appendChild(baseOption);
    options.forEach((option) => {
      const node = document.createElement("option");
      node.value = option.id;
      node.textContent = option.nombre;
      select.appendChild(node);
    });
    if (current && select.querySelector(`option[value="${current}"]`)) {
      select.value = current;
    }
  };

  const renderAlimentos = () => {
    const container = document.getElementById("alimentosList");
    if (!container) return;
    container.innerHTML = "";
    container.dataset.empty = EMPTY_STATE_MESSAGES.alimentos;
    const term = normalize(state.alimentoSearch);
    const listado = state.alimentos.filter((item) => {
      if (!term) return true;
      return normalize(item.nombre).includes(term) || normalize(item.descripcion).includes(term);
    });
    if (!listado.length) {
      if (state.alimentos.length) {
        container.dataset.empty = "No encontramos alimentos con ese criterio.";
      }
      return;
    }
    delete container.dataset.empty;
    listado.forEach((alimento) => {
      const alimentoIdRaw = alimento.id ?? alimento.alimento_id;
      const alimentoId = Number.parseInt(alimentoIdRaw, 10);
      if (!Number.isFinite(alimentoId)) return;
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.id = String(alimentoId);
      card.innerHTML = `
        <div class="card__header">
          <h3 class="card__title">${alimento.nombre}</h3>
          <span class="badge">${alimento.unidad_base || "g"}</span>
        </div>
        <div class="card__meta">
          <span>${formatNumber(alimento.calorias, 0)} kcal</span>
          <span>Proteinas: ${formatNumber(alimento.proteinas, 1)} g</span>
          <span>Grasas: ${formatNumber(alimento.grasas, 1)} g</span>
          <span>Carbohidratos: ${formatNumber(alimento.carbohidratos, 1)} g</span>
          <span>Fibra: ${formatNumber(alimento.fibra, 1)} g</span>
        </div>
        ${alimento.descripcion ? `<p class="muted">${alimento.descripcion}</p>` : ""}
        ${
          alimento.micronutrientes && Object.keys(alimento.micronutrientes).length
            ? `<div class="chips">
                ${Object.entries(alimento.micronutrientes)
                  .slice(0, 6)
                  .map(([clave, valor]) => `<span class="chip">${clave}: ${formatNumber(valor, 2)}</span>`)
                  .join("")}
              </div>`
            : ""
        }
        <div class="card__actions">
          <button type="button" class="btn mini" data-entity="alimento" data-action="edit" data-id="${alimentoId}">Editar</button>
          <button type="button" class="btn mini danger" data-entity="alimento" data-action="delete" data-id="${alimentoId}">Eliminar</button>
        </div>
      `;
      container.appendChild(card);
    });
  };

  const renderRecetas = () => {
    const container = document.getElementById("recetasList");
    if (!container) return;
    container.innerHTML = "";
    container.dataset.empty = EMPTY_STATE_MESSAGES.recetas;
    const term = normalize(state.recetaSearch);
    const listado = state.recetas.filter((receta) => {
      if (!term) return true;
      const matchNombre = normalize(receta.nombre).includes(term);
      const matchIngrediente = (receta.ingredientes || []).some((item) => normalize(item?.alimento?.nombre).includes(term));
      return matchNombre || matchIngrediente;
    });
    if (!listado.length) {
      if (state.recetas.length) {
        container.dataset.empty = "No encontramos recetas con ese criterio.";
      }
      return;
    }
    delete container.dataset.empty;
    listado.forEach((receta) => {
      const recetaId = Number.parseInt(receta.id ?? receta.receta_id, 10);
      if (!Number.isFinite(recetaId)) return;
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.id = String(recetaId);
      const totales = receta.totales || { macros: {}, micros: {} };
      card.innerHTML = `
        <div class="card__header">
          <div>
            <h3 class="card__title">${receta.nombre}</h3>
            <div class="card__meta">
              <span>${(receta.ingredientes || []).length} ingrediente(s)</span>
              ${
                receta.calorias_objetivo
                  ? `<span>Objetivo: ${formatNumber(receta.calorias_objetivo, 0)} kcal</span>`
                  : ""
              }
            </div>
          </div>
        </div>
        ${receta.descripcion ? `<p class="muted">${receta.descripcion}</p>` : ""}
        <div class="totals-grid">
          <div class="totals-panel">
            <h4>Macros</h4>
            <ul>
              ${Object.entries(totales.macros || {})
                .map(([clave, valor]) => `<li>${clave}: <strong>${formatNumber(valor, 1)}</strong></li>`)
                .join("")}
            </ul>
          </div>
          ${
            Object.keys(totales.micros || {}).length
              ? `<div class="totals-panel">
                   <h4>Micros</h4>
                   <ul>
                     ${Object.entries(totales.micros || {})
                       .slice(0, 6)
                       .map(([clave, valor]) => `<li>${clave}: <strong>${formatNumber(valor, 2)}</strong></li>`)
                       .join("")}
                   </ul>
                 </div>`
              : ""
          }
        </div>
        <div class="card__actions">
          <button type="button" class="btn mini" data-entity="receta" data-action="edit" data-id="${recetaId}">Editar</button>
          <button type="button" class="btn mini danger" data-entity="receta" data-action="delete" data-id="${recetaId}">Eliminar</button>
        </div>
      `;
      container.appendChild(card);
    });
  };

  
  const formatAsignacion = (dieta) => {
    const asignaciones = Array.isArray(dieta.asignaciones) ? dieta.asignaciones : [];
    if (!asignaciones.length) {
    return "<span class='muted'>Sin asignaciones</span>";
  }
  const actual = asignaciones.find((item) => item.es_actual);
  if (actual) {
    const fecha = actual.fecha_asignacion ? new Date(actual.fecha_asignacion).toLocaleDateString("es-ES") : "--";
    const nombre = buildPatientDisplayName(actual, formatPatientName(actual.paciente_id));
    const detalles = [
      nombre ? `Asignado a ${escapeHtml(nombre)}` : "",
      fecha !== "--" ? `el ${fecha}` : ""
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    return `<span class="badge active">Vigente</span><span class="muted">${detalles || "Asignaci&oacute;n vigente"}</span>`;
  }
  return `<span class="badge historic">Hist&oacute;rico</span><span class="muted">${asignaciones.length} versi&oacute;n(es)</span>`;
};

  const applyDietFilters = () => {
    const term = normalize(state.dietSearch);
    state.dietas = state.dietasRaw.filter((dieta) => {
      if (dieta.es_plantilla && !state.filters.mostrarPlantillas) return false;
      if (!dieta.es_plantilla && !state.filters.mostrarPersonalizadas) return false;
      if (state.filters.estado === "activas" && !dieta.activa) return false;
      if (state.filters.estado === "inactivas" && dieta.activa) return false;
      const tieneAsignacionVigente =
        Boolean(dieta.paciente_id) || Boolean(dieta.asignaciones?.some((item) => item?.es_actual));
      if (state.filters.asignacion === "asignadas" && !tieneAsignacionVigente) return false;
      if (state.filters.asignacion === "sin-asignar" && tieneAsignacionVigente) return false;
      if (term) {
        const contenido =
          normalize(dieta.nombre) +
          normalize(dieta.objetivo) +
          normalize(dieta.descripcion) +
          normalize(dieta.notas);
      const pacientesRelacionados = [
        normalizePatientId(dieta.paciente_id),
        ...(Array.isArray(dieta.asignaciones)
          ? dieta.asignaciones.map((item) => normalizePatientId(item?.paciente_id))
          : [])
      ]
        .filter(Boolean)
        .flatMap((id) => {
          const raw = normalize(id);
          const nombre = normalize(formatPatientName(id));
          return nombre && nombre !== raw ? [raw, nombre] : [raw];
        });
        const pacienteCoincide = pacientesRelacionados.some((id) => id.includes(term));
        if (!contenido.includes(term) && !pacienteCoincide) return false;
      }
      return true;
    });
  };

  const updateStats = () => {
    const plantillasNode = document.getElementById("statPlantillas");
    const activasNode = document.getElementById("statDietasActivas");
    const pacientesNode = document.getElementById("statPacientes");
    const plantillas = state.dietasRaw.filter((dieta) => dieta.es_plantilla);
    const activas = state.dietasRaw.filter((dieta) => !dieta.es_plantilla && dieta.activa);
    const pacientes = new Set(
      state.dietasRaw
        .filter((dieta) => !dieta.es_plantilla && dieta.paciente_id)
        .map((dieta) => normalizePatientId(dieta.paciente_id))
        .filter(Boolean)
    );
    plantillasNode && (plantillasNode.textContent = plantillas.length.toString());
    activasNode && (activasNode.textContent = activas.length.toString());
    pacientesNode && (pacientesNode.textContent = pacientes.size.toString());
  };

  const ensureSelectedDieta = () => {
    if (!state.dietas.length) {
      state.ui.selectedDietaId = null;
      return null;
    }
    if (!state.dietas.some((item) => item.id === state.ui.selectedDietaId)) {
      state.ui.selectedDietaId = state.dietas[0].id;
    }
    return state.dietas.find((item) => item.id === state.ui.selectedDietaId) || null;
  };

  const renderDietCatalog = () => {
    const list = document.getElementById("dietCatalogList");
    if (!list) return;
    list.innerHTML = "";
    list.dataset.empty = EMPTY_STATE_MESSAGES.dietas;
    if (!state.dietas.length) {
      return;
    }
    delete list.dataset.empty;
    const selected = ensureSelectedDieta();
    const selectedId = selected?.id ?? null;
    state.dietas.forEach((dieta) => {
      const pacientesRelacionados = new Set();
      if (dieta.paciente_id) {
        pacientesRelacionados.add(formatPatientName(dieta.paciente_id));
      }
      (dieta.asignaciones || []).forEach((item) => {
        if (!item) return;
        pacientesRelacionados.add(buildPatientDisplayName(item, formatPatientName(item.paciente_id)));
      });
      const resumenAsignaciones = pacientesRelacionados.size
        ? `${pacientesRelacionados.size} paciente${pacientesRelacionados.size === 1 ? "" : "s"}`
        : dieta.es_plantilla
        ? "Sin asignar"
        : "Paciente pendiente";
      const statusBadge = `<span class="badge ${dieta.es_plantilla ? "template" : dieta.activa ? "active" : "historic"}">${
        dieta.es_plantilla ? "Plantilla" : dieta.activa ? "Activa" : "Hist&oacute;rica"
      }</span>`;
      const versionBadge = `<span class="badge version">V${dieta.version || 1}</span>`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `diet-summary${dieta.id === selectedId ? " is-selected" : ""}`;
      button.dataset.id = String(dieta.id);
      button.innerHTML = `
        <div class="diet-summary__header">
          <h3 class="diet-summary__title">${escapeHtml(buildDietTitle(dieta))}</h3>
          <div>${statusBadge}${versionBadge}</div>
        </div>
        <div class="diet-summary__meta">
          <span><strong>Recetas:</strong> ${(dieta.recetas || []).length}</span>
          <span><strong>Asignaciones:</strong> ${escapeHtml(resumenAsignaciones)}</span>
          ${
            dieta.calorias_objetivo
              ? `<span><strong>Kcal:</strong> ${formatNumber(dieta.calorias_objetivo, 0)}</span>`
              : ""
          }
        </div>
      `;
      list.appendChild(button);
    });
  };

  const buildPacienteChips = (dieta, pacienteActualValor, pacienteActualIdNormalizado) => {
    const pacientesMap = new Map();
    const addPaciente = (entrada, esActual = false) => {
      if (entrada === null || typeof entrada === "undefined") return;
      let rawValor = entrada;
      let nombreHint = "";
      let apellidosHint = "";
      if (typeof entrada === "object") {
        rawValor = entrada.paciente_id ?? entrada.id ?? entrada;
        nombreHint = extractNombre(entrada);
        apellidosHint = extractApellidos(entrada);
      }
      const normalizedId = normalizePatientId(rawValor);
      if (!normalizedId) return;
      const numeric = toNumericId(normalizedId);
      storePatientHint(normalizedId, nombreHint, apellidosHint);
      const registro =
        pacientesMap.get(normalizedId) ||
        {
          id: normalizedId,
          raw: normalizedId,
          numericId: Number.isFinite(numeric) ? numeric : null,
          esActual: false,
          displayName: "",
          isPlaceholder: false
        };
      registro.esActual = registro.esActual || esActual;
      const displayName =
        buildPatientDisplayName(
          typeof entrada === "object"
            ? entrada
            : {
                paciente_id: normalizedId,
                paciente_nombre: nombreHint,
                paciente_apellidos: apellidosHint
              },
          formatPatientName(normalizedId)
        ) || registro.displayName;
      registro.displayName = displayName;
      registro.isPlaceholder =
        /^Paciente\s*#\d+$/i.test((displayName || "").trim()) ||
        (!displayName && !nombreHint && !apellidosHint);
      pacientesMap.set(normalizedId, registro);
    };
    (Array.isArray(dieta.asignaciones) ? dieta.asignaciones : []).forEach((item) => addPaciente(item, Boolean(item?.es_actual)));
    addPaciente(
      {
        paciente_id: dieta.paciente_id,
        paciente_nombre: extractNombre(dieta),
        paciente_apellidos: extractApellidos(dieta)
      },
      !dieta.es_plantilla && Boolean(dieta.activa)
    );
    return Array.from(pacientesMap.values())
      .filter((registro) => !registro.isPlaceholder)
      .sort((a, b) => {
      const aEsActual =
        a.esActual ||
        (Number.isFinite(pacienteActualValor)
          ? a.numericId === pacienteActualValor
          : a.raw === pacienteActualIdNormalizado);
      const bEsActual =
        b.esActual ||
        (Number.isFinite(pacienteActualValor)
          ? b.numericId === pacienteActualValor
          : b.raw === pacienteActualIdNormalizado);
      if (aEsActual && !bEsActual) return -1;
      if (!aEsActual && bEsActual) return 1;
      if (Number.isFinite(a.numericId) && Number.isFinite(b.numericId)) {
        return a.numericId - b.numericId;
      }
      const nombreA = a.displayName || formatPatientName(a.numericId ?? a.raw);
      const nombreB = b.displayName || formatPatientName(b.numericId ?? b.raw);
      return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
    });
  };

  const renderDietaDetail = (selected) => {
    const panel = document.getElementById("dietDetailPanel");
    if (!panel) return;
    if (!selected) {
      panel.innerHTML = `
        <div class="diet-detail__placeholder">
          <h3>Selecciona una dieta</h3>
          <p>Consulta los detalles, recetas y pacientes asignados desde este panel.</p>
          <button type="button" class="btn primary btn--new-dieta" data-action="create-dieta">Crear nueva dieta</button>
        </div>
      `;
      panel.removeAttribute("data-id");
      return;
    }
    panel.dataset.id = String(selected.id);
    const totales = selected.totales || { macros: {}, micros: {} };
    const macros = Object.entries(totales.macros || {});
    const micros = Object.entries(totales.micros || {});
    const asignaciones = Array.isArray(selected.asignaciones) ? selected.asignaciones : [];
    const asignacionActual = asignaciones.find((item) => item.es_actual);
    const pacienteActualIdRaw = asignacionActual?.paciente_id ?? selected.paciente_id;
    const pacienteActualId = normalizePatientId(pacienteActualIdRaw);
    const pacienteActualValor = toNumericId(pacienteActualId);
    const pacienteActualNombre = pacienteActualId ? formatPatientName(pacienteActualId) : "";
    const pacientePrincipal = asignacionActual || selected;
    const pacienteDisplayName = buildPatientDisplayName(
      pacientePrincipal,
      pacienteActualNombre || (selected.es_plantilla ? "" : formatPatientName(pacienteActualId))
    );
    const pacienteIdLabel = "";
    const assignmentStatusBadge = asignacionActual
      ? '<span class="badge assignment assignment--current">Asignaci&oacute;n vigente</span>'
      : selected.es_plantilla
      ? '<span class="badge assignment unassigned">Pendiente de asignar</span>'
      : '<span class="badge assignment">Sin asignaci&oacute;n vigente</span>';
    const badges = [
      `<span class="badge ${selected.es_plantilla ? "template" : selected.activa ? "active" : "historic"}">${selected.es_plantilla ? "Plantilla" : selected.activa ? "Activa" : "Hist&oacute;rica"}</span>`,
      `<span class="badge version">V${selected.version || 1}</span>`
    ];
    const metaItems = [
      selected.objetivo ? `<span><strong>Objetivo:</strong> ${escapeHtml(selected.objetivo)}</span>` : "",
      selected.calorias_objetivo
        ? `<span><strong>Calor&iacute;as:</strong> ${formatNumber(selected.calorias_objetivo, 0)} kcal</span>`
        : "",
      selected.fecha_inicio ? `<span><strong>Inicio:</strong> ${new Date(selected.fecha_inicio).toLocaleDateString("es-ES")}</span>` : "",
      selected.fecha_fin ? `<span><strong>Fin:</strong> ${new Date(selected.fecha_fin).toLocaleDateString("es-ES")}</span>` : ""
    ].filter(Boolean);
    const assignmentMeta = formatAsignacion(selected);
    const pacientePrincipalLabel = pacienteDisplayName || pacienteActualNombre || (selected.es_plantilla ? "Sin asignar" : "");
    const pacienteFallbackLabel =
      pacientePrincipalLabel ||
      (selected.es_plantilla ? "Plantilla disponible" : "Sin datos");
    const patientChips = buildPacienteChips(selected, pacienteActualValor, pacienteActualId);
    const showPatientList = patientChips.length > 1 || patientChips.some((item) => !item.esActual);
    const pacientesAsignadosHtml = showPatientList
      ? `<div class="dieta-card__patients"><strong>Pacientes vinculados:</strong>${patientChips
          .map((item) => {
            const baseNombre = item.displayName || formatPatientName(item.raw);
            const displayName = baseNombre || `Paciente ${item.raw}`;
            const isCurrent =
              item.esActual ||
              (Number.isFinite(pacienteActualValor)
                ? item.numericId === pacienteActualValor
                : pacienteActualId && item.raw === pacienteActualId);
            const tooltip = Number.isFinite(item.numericId)
              ? ` title="ID ${item.numericId}"`
              : item.raw
              ? ` title="ID ${item.raw}"`
              : "";
            return `<span class="${isCurrent ? "is-current" : ""}"${tooltip}>${escapeHtml(displayName)}</span>`;
          })
          .join("")}</div>`
      : "";
    const macrosHtml = macros.length
      ? macros.map(([clave, valor]) => `<li>${clave}: <strong>${formatNumber(valor, 1)}</strong></li>`).join("")
      : "<li>Sin datos registrados.</li>";
    const microsHtml = micros.length
      ? `<div class="totals-panel">
           <h4>Micros</h4>
           <ul>
             ${micros
               .slice(0, 6)
               .map(([clave, valor]) => `<li>${clave}: <strong>${formatNumber(valor, 2)}</strong></li>`)
               .join("")}
           </ul>
         </div>`
      : "";
    const historialHtml = asignaciones.length
      ? `<div class="dieta-asignaciones">
           <h4>Historial de asignaciones</h4>
           <ul>
             ${asignaciones
               .map((item) => {
                 const fecha = item.fecha_asignacion ? new Date(item.fecha_asignacion).toLocaleDateString("es-ES") : "--";
                 const comentario = item.comentario
                   ? `<div class="dieta-asignaciones__comment">${escapeHtml(item.comentario)}</div>`
                   : "";
                 const pacienteHistId = normalizePatientId(item.paciente_id);
                 const nombreHist = buildPatientDisplayName(item, formatPatientName(pacienteHistId));
                 const numericHist = toNumericId(pacienteHistId);
                 const idHist = pacienteHistId
                   ? Number.isFinite(numericHist)
                     ? `#${numericHist}`
                     : pacienteHistId
                   : "";
                 return `<li>
                   <div class="dieta-asignaciones__row">
                     <span class="pill${item.es_actual ? "" : " is-inactive"}">${item.es_actual ? "Vigente" : "Hist&oacute;rica"}</span>
                     <div class="dieta-asignaciones__person">
                       <span class="dieta-asignaciones__name">${escapeHtml(nombreHist)}</span>
                       ${idHist ? `<span class="dieta-asignaciones__id">${idHist}</span>` : ""}
                     </div>
                     <span class="dieta-asignaciones__version">V${item.version ?? "--"}</span>
                     <time datetime="${item.fecha_asignacion || ""}">${fecha}</time>
                   </div>
                   ${comentario}
                 </li>`;
               })
               .join("")}
           </ul>
         </div>`
      : "";
    panel.innerHTML = `
      <div class="diet-detail__header">
        <div class="diet-detail__title">
          <h3>${escapeHtml(buildDietTitle(selected))}</h3>
          ${
            metaItems.length
              ? `<p>${metaItems.join(" &middot; ")}</p>`
              : ""
          }
        </div>
        <div class="diet-detail__actions">
          <button type="button" class="btn mini" data-action="edit" data-id="${selected.id}">Editar</button>
          <button type="button" class="btn mini danger" data-action="delete" data-id="${selected.id}">Eliminar</button>
          <button type="button" class="btn mini" data-action="export-pdf" data-id="${selected.id}">Exportar PDF</button>
          <button type="button" class="btn mini" data-action="export-csv" data-id="${selected.id}">Exportar CSV</button>
          ${
            selected.es_plantilla
              ? `<button type="button" class="btn mini primary" data-action="assign" data-id="${selected.id}">Asignar</button>`
              : `<button type="button" class="btn mini" data-action="version" data-id="${selected.id}">Nueva versi&oacute;n</button>`
          }
          ${
            selected.paciente_id
              ? `<button type="button" class="btn mini" data-action="notify" data-id="${selected.id}">Notificar</button>`
              : ""
          }
        </div>
      </div>
      <div class="diet-detail__chips">
        ${badges.join("")}
        ${assignmentStatusBadge}
      </div>
      <div class="dieta-card__assignment">
        <div class="dieta-card__assignment-info">
          <span class="dieta-card__assignment-label">${selected.es_plantilla ? "Plantilla" : "Paciente"}</span>
          <span class="dieta-card__assignment-name">${escapeHtml(pacientePrincipalLabel || pacienteFallbackLabel)}</span>
          ${pacienteIdLabel ? `<span class="dieta-card__assignment-id">${pacienteIdLabel}</span>` : ""}
        </div>
        <div class="dieta-card__assignment-state">
          <div class="dieta-card__assignment-meta">${assignmentMeta}</div>
        </div>
      </div>
      ${selected.descripcion ? `<p class="muted dieta-card__description">${escapeHtml(selected.descripcion)}</p>` : ""}
      ${selected.notas ? `<div class="diet-detail__notes">${escapeHtml(selected.notas)}</div>` : ""}
      ${pacientesAsignadosHtml}
      <div class="diet-detail__grid">
        <div class="totals-panel">
          <h4>Macros</h4>
          <ul>${macrosHtml}</ul>
        </div>
        ${microsHtml}
      </div>
      ${historialHtml}
    `;
  };

  const buildAssignmentItems = () => {
    const items = [];
    const now = Date.now();
    state.dietas.forEach((dieta) => {
      const asignaciones = Array.isArray(dieta.asignaciones) ? dieta.asignaciones : [];
      if (!asignaciones.length && dieta.paciente_id) {
        const startDate = dieta.fecha_inicio ? new Date(dieta.fecha_inicio) : null;
        const estadoBase = dieta.activa
          ? startDate && startDate.getTime() > now
            ? "proxima"
            : "vigente"
          : "historica";
        items.push({
          tipo: "sintetica",
          dieta,
          asignacion: null,
          pacienteId: dieta.paciente_id,
          pacienteNombre: buildPatientDisplayName(dieta, formatPatientName(dieta.paciente_id)),
          estado: estadoBase,
          esActual: Boolean(dieta.activa),
          fechaAsignacion: startDate,
          comentario: dieta.notas || "",
          version: dieta.version || 1
        });
      }
      asignaciones.forEach((asignacion) => {
        const fechaAsignacion = asignacion.fecha_asignacion ? new Date(asignacion.fecha_asignacion) : null;
        let estado = asignacion.es_actual ? "vigente" : "historica";
        if (asignacion.es_actual && dieta.fecha_inicio) {
          const inicio = new Date(dieta.fecha_inicio);
          if (inicio.getTime() > now) {
            estado = "proxima";
          }
        }
        items.push({
          tipo: "registro",
          dieta,
          asignacion,
          pacienteId: asignacion.paciente_id,
          pacienteNombre: buildPatientDisplayName(asignacion, formatPatientName(asignacion.paciente_id)),
          estado,
          esActual: Boolean(asignacion.es_actual),
          fechaAsignacion,
          comentario: asignacion.comentario || "",
          version: asignacion.version ?? dieta.version ?? 1
        });
      });
    });
    return items;
  };

  const renderAssignments = () => {
    const list = document.getElementById("dietAssignmentsList");
    if (!list) return;
    list.innerHTML = "";
    list.dataset.empty = "No hay asignaciones registradas.";
    if (state.ui.activeTab !== "asignaciones") {
      return;
    }
    const term = normalize(state.ui.assignmentSearch || "");
    const estadoFiltro = state.ui.assignmentEstado || "vigentes";
    const items = buildAssignmentItems().filter((item) => {
      if (estadoFiltro !== "todas") {
        if (estadoFiltro === "vigentes" && item.estado !== "vigente") return false;
        if (estadoFiltro === "historicas" && item.estado !== "historica") return false;
        if (estadoFiltro === "proximas" && item.estado !== "proxima") return false;
      }
      if (term) {
        const texto = normalize(`${buildDietTitle(item.dieta)} ${item.pacienteNombre || ""}`);
        if (!texto.includes(term)) return false;
      }
      return true;
    });
    if (!items.length) {
      return;
    }
    delete list.dataset.empty;
    const estadoBadge = (estado) => {
      if (estado === "vigente") return '<span class="badge active">Vigente</span>';
      if (estado === "proxima") return '<span class="badge template">Programada</span>';
      return '<span class="badge historic">Hist&oacute;rica</span>';
    };
    items
      .sort((a, b) => {
        const fechaA = a.fechaAsignacion ? a.fechaAsignacion.getTime() : 0;
        const fechaB = b.fechaAsignacion ? b.fechaAsignacion.getTime() : 0;
        return fechaB - fechaA;
      })
      .forEach((item) => {
        const card = document.createElement("article");
        card.className = "assignment-card";
        card.dataset.dietaId = String(item.dieta.id);
        const fechaTexto = item.fechaAsignacion ? item.fechaAsignacion.toLocaleDateString("es-ES") : "";
        card.innerHTML = `
          <div class="assignment-card__info">
            <h3 class="assignment-card__title">${escapeHtml(buildDietTitle(item.dieta))}</h3>
            <span class="assignment-card__patient">${escapeHtml(item.pacienteNombre || "Sin paciente")}</span>
            <div class="assignment-card__meta">
              ${estadoBadge(item.estado)}
              <span>Versi&oacute;n V${item.version}</span>
              ${fechaTexto ? `<span>${item.esActual ? "Asignado" : "Registro"}: ${fechaTexto}</span>` : ""}
            </div>
            ${item.comentario ? `<div class="dieta-asignaciones__comment">${escapeHtml(item.comentario)}</div>` : ""}
          </div>
          <div class="assignment-card__actions">
            <button type="button" class="btn mini" data-action="open-diet" data-id="${item.dieta.id}">Ver dieta</button>
            <button type="button" class="btn mini" data-action="assign" data-id="${item.dieta.id}">Nueva asignaci&oacute;n</button>
            ${
              item.esActual && !item.dieta.es_plantilla
                ? `<button type="button" class="btn mini" data-action="notify" data-id="${item.dieta.id}">Notificar</button>`
                : ""
            }
          </div>
        `;
        list.appendChild(card);
      });
  };

  const updateTabsVisibility = () => {
    if (state.ui.activeTab !== "catalogo" && state.ui.activeTab !== "asignaciones") {
      state.ui.activeTab = "catalogo";
    }
    const tabs = document.querySelectorAll(".diet-tab");
    const panels = document.querySelectorAll(".diet-tabpanel");
    tabs.forEach((tab) => {
      const tabName = tab.getAttribute("data-tab") || "catalogo";
      const isActive = tabName === state.ui.activeTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    panels.forEach((panel) => {
      const tabName = panel.getAttribute("data-tab-panel") || "catalogo";
      const isActive = tabName === state.ui.activeTab;
      panel.classList.toggle("is-active", isActive);
      if (isActive) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "hidden");
      }
    });
    if (state.ui.activeTab === "asignaciones") {
      renderAssignments();
    }
  };

  const renderDietView = () => {
    const selected = ensureSelectedDieta();
    renderDietCatalog();
    renderDietaDetail(selected);
    updateTabsVisibility();
    updateStats();
  };

  const loadAlimentos = async () => {
    try {
      state.alimentos = (await requestJson("/alimentos")) || [];
      renderAlimentos();
      document.querySelectorAll(".receta-ingrediente-select").forEach((select) => populateSelect(select, state.alimentos, "Alimento"));
      clearError("alimentos");
    } catch (error) {
      console.warn("No se pudieron cargar los alimentos:", error);
      const container = document.getElementById("alimentosList");
      if (container) {
        setListPlaceholder(container, "No pudimos cargar los alimentos.");
      }
      registerError("alimentos", "No pudimos cargar los alimentos. Intenta nuevamente.");
    }
  };

  const loadRecetas = async () => {
    try {
      state.recetas = (await requestJson("/recetas")) || [];
      renderRecetas();
      document.querySelectorAll(".diet-recipe-select").forEach((select) => populateSelect(select, state.recetas, "Receta"));
      clearError("recetas");
    } catch (error) {
      console.warn("No se pudieron cargar las recetas:", error);
      const container = document.getElementById("recetasList");
      if (container) {
        setListPlaceholder(container, "No pudimos cargar las recetas.");
      }
      registerError("recetas", "No pudimos cargar las recetas. Intenta nuevamente.");
    }
  };

  const loadDietas = async () => {
    try {
      const params = new URLSearchParams();
      if (state.filters.mostrarPlantillas && !state.filters.mostrarPersonalizadas) {
        params.set("es_plantilla", "true");
      } else if (!state.filters.mostrarPlantillas && state.filters.mostrarPersonalizadas) {
        params.set("es_plantilla", "false");
      }
      if (state.filters.estado === "activas") {
        params.set("activa", "true");
      }
      const query = params.toString() ? `?${params.toString()}` : "";
      state.dietasRaw = (await requestJson(`/dietas${query}`)) || [];
      state.dietasRaw.forEach((dieta) => {
      const pacienteIdNormalizado = normalizePatientId(dieta?.paciente_id);
      if (pacienteIdNormalizado) {
        storePatientHint(pacienteIdNormalizado, extractNombre(dieta), extractApellidos(dieta));
        dieta.paciente_id = pacienteIdNormalizado;
      } else {
        dieta.paciente_id = null;
      }
      if (Array.isArray(dieta?.asignaciones)) {
        dieta.asignaciones = dieta.asignaciones.filter((item) => {
          const asignacionId = normalizePatientId(item?.paciente_id);
          if (!asignacionId) {
            return false;
          }
          storePatientHint(asignacionId, extractNombre(item), extractApellidos(item));
          item.paciente_id = asignacionId;
          return true;
        });
      }
      });
      await preloadDietPatients(state.dietasRaw);
      if (state.initialPacienteFilter) {
        const filtroNormalizado = normalizePatientId(state.initialPacienteFilter);
        const nombrePaciente = filtroNormalizado ? formatPatientName(filtroNormalizado) : "";
        if (nombrePaciente && !/^Paciente\s*#?\d+$/i.test(nombrePaciente)) {
          setGlobalAlert(`Mostrando dietas vinculadas a ${nombrePaciente}.`, "info");
        } else {
          setGlobalAlert("Mostrando dietas vinculadas al paciente seleccionado.", "info");
        }
        state.initialPacienteFilter = "";
      }
      applyDietFilters();
      renderDietView();
      clearError("dietas");
    } catch (error) {
      console.warn("No se pudieron cargar las dietas:", error);
      const catalog = document.getElementById("dietCatalogList");
      if (catalog) {
        setListPlaceholder(catalog, "No pudimos cargar las dietas. Verifica el servicio e intenta nuevamente.");
      }
      const assignments = document.getElementById("dietAssignmentsList");
      if (assignments) {
        setListPlaceholder(assignments, "No pudimos cargar las dietas. Verifica el servicio e intenta nuevamente.");
      }
      registerError("dietas", "No pudimos cargar las dietas. Verifica el servicio de nutricion e intenta nuevamente.");
    }
  };

  const collectRecetaIngredientes = () => {
    const rows = document.querySelectorAll(".receta-ingrediente-row");
    const ingredientes = [];
    rows.forEach((row) => {
      const select = row.querySelector(".receta-ingrediente-select");
      const cantidad = row.querySelector(".receta-ingrediente-cantidad");
      const unidad = row.querySelector(".receta-ingrediente-unidad");
      if (!select || !cantidad) return;
      const alimentoId = Number.parseInt(select.value, 10);
      const cantidadVal = Number.parseFloat(cantidad.value);
      if (!Number.isFinite(alimentoId) || !Number.isFinite(cantidadVal) || cantidadVal <= 0) return;
      ingredientes.push({
        alimento_id: alimentoId,
        cantidad: cantidadVal,
        unidad: unidad?.value?.trim() || null
      });
    });
    return ingredientes;
  };

  const collectDietaRecetas = () => {
    const rows = document.querySelectorAll(".diet-recipe-row");
    const recetas = [];
    rows.forEach((row) => {
      const select = row.querySelector(".diet-recipe-select");
      if (!select) return;
      const recetaId = Number.parseInt(select.value, 10);
      if (!Number.isFinite(recetaId)) return;
      const dia = row.querySelector(".diet-recipe-dia");
      const momento = row.querySelector(".diet-recipe-momento");
      const porciones = row.querySelector(".diet-recipe-porciones");
      const orden = row.querySelector(".diet-recipe-orden");
      const porcionesVal = Number.parseInt(porciones?.value ?? "1", 10);
      const ordenVal = Number.parseInt(orden?.value ?? "", 10);
      recetas.push({
        receta_id: recetaId,
        dia_semana: dia?.value?.trim() || null,
        momento: momento?.value?.trim() || null,
        porciones: Number.isFinite(porcionesVal) && porcionesVal > 0 ? porcionesVal : 1,
        orden: Number.isFinite(ordenVal) ? ordenVal : null
      });
    });
    return recetas;
  };

  const ensureRecetasUnicas = (recetas) => {
    if (!Array.isArray(recetas) || recetas.length === 0) {
      return;
    }
    const combinaciones = new Set();
    for (const item of recetas) {
      const recetaId = toNumericId(item?.receta_id);
      if (!Number.isFinite(recetaId)) {
        continue;
      }
      const dia = (item?.dia_semana || "").trim().toLowerCase();
      const momento = (item?.momento || "").trim().toLowerCase();
      const diaKey = dia || "-";
      const momentoKey = momento || "-";
      const key = `${recetaId}::${diaKey}::${momentoKey}`;
      if (combinaciones.has(key)) {
        throw new Error(
          "No puedes repetir la misma receta en el mismo dia y momento. Ajusta o elimina las filas duplicadas."
        );
      }
      combinaciones.add(key);
    }
  };
  const resetAlimentoForm = () => {
    const form = document.getElementById("alimentoForm");
    if (!form) return;
    form.reset();
    const feedback = document.getElementById("alimentoFeedback");
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("success");
    }
    const title = document.getElementById("alimentoModalTitle");
    title && (title.textContent = "Nuevo alimento");
    const submit = document.getElementById("alimentoSubmit");
    submit && (submit.textContent = "Guardar alimento");
    state.editing.alimentoId = null;
  };

  const resetRecetaForm = () => {
    const form = document.getElementById("recetaForm");
    if (!form) return;
    form.reset();
    const container = document.getElementById("recetaIngredientesContainer");
    if (container) {
      container.innerHTML = "";
      addIngredientRow();
    }
    document.querySelectorAll(".receta-ingrediente-select").forEach((select) => populateSelect(select, state.alimentos, "Alimento"));
    const feedback = document.getElementById("recetaFeedback");
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("success");
    }
    const title = document.getElementById("recetaModalTitle");
    title && (title.textContent = "Nueva receta");
    const submit = document.getElementById("recetaSubmit");
    submit && (submit.textContent = "Guardar receta");
    state.editing.recetaId = null;
  };

  const resetDietaForm = () => {
    const form = document.getElementById("dietaForm");
    if (!form) return;
    form.reset();
    form.dietaEsPlantilla.checked = true;
    form.dietaPacienteId.value = "";
    form.dietaPacienteId.disabled = true;
    updatePatientSelects(form.dietaPacienteId);
    const container = document.getElementById("dietaRecetasContainer");
    if (container) {
      container.innerHTML = "";
      addDietRecipeRow();
    }
    document.querySelectorAll(".diet-recipe-select").forEach((select) => populateSelect(select, state.recetas, "Receta"));
    const feedback = document.getElementById("dietaFeedback");
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("success");
    }
    const title = document.getElementById("dietaModalTitle");
    title && (title.textContent = "Nueva dieta");
    const submit = document.getElementById("dietaSubmit");
    submit && (submit.textContent = "Guardar dieta");
    state.editing.dietaId = null;
  };

  const addIngredientRow = () => {
    const container = document.getElementById("recetaIngredientesContainer");
    if (!container) return null;
    const row = document.createElement("div");
    row.className = "inline-fields receta-ingrediente-row";
    row.innerHTML = `
      <select class="receta-ingrediente-select" required></select>
      <input type="number" class="receta-ingrediente-cantidad" placeholder="Cantidad" min="0.1" step="0.1" required />
      <input type="text" class="receta-ingrediente-unidad" placeholder="Unidad" />
      <button type="button" class="remove-row" aria-label="Eliminar ingrediente">&times;</button>
    `;
    container.appendChild(row);
    populateSelect(row.querySelector(".receta-ingrediente-select"), state.alimentos, "Alimento");
    return row;
  };

  const addDietRecipeRow = () => {
    const container = document.getElementById("dietaRecetasContainer");
    if (!container) return null;
    const row = document.createElement("div");
    row.className = "inline-fields diet-recipe-row";
    row.innerHTML = `
      <select class="diet-recipe-select" required></select>
      <input type="text" class="diet-recipe-dia" placeholder="Dia" />
      <input type="text" class="diet-recipe-momento" placeholder="Momento" />
      <input type="number" class="diet-recipe-porciones" min="1" value="1" />
      <input type="number" class="diet-recipe-orden" placeholder="Orden" />
      <button type="button" class="remove-row" aria-label="Eliminar receta">&times;</button>
    `;
    container.appendChild(row);
    populateSelect(row.querySelector(".diet-recipe-select"), state.recetas, "Receta");
    return row;
  };

  const closeModal = (id) => {
    const modal = document.getElementById(id);
    modal?.classList.remove("is-open");
    modal?.setAttribute("hidden", "hidden");
  };

  const openModal = (id) => {
    const modal = document.getElementById(id);
    modal?.classList.add("is-open");
    modal?.removeAttribute("hidden");
  };

  const showAlimentoModal = (alimento = null) => {
    const form = document.getElementById("alimentoForm");
    if (!form) return;
    resetAlimentoForm();
    if (alimento) {
      const title = document.getElementById("alimentoModalTitle");
      title && (title.textContent = "Editar alimento");
      const submit = document.getElementById("alimentoSubmit");
      submit && (submit.textContent = "Actualizar alimento");
      const alimentoId = toNumericId(alimento.id ?? alimento.alimento_id);
      if (Number.isFinite(alimentoId)) {
        state.editing.alimentoId = alimentoId;
      }
      form.alimentoNombre.value = alimento.nombre || "";
      form.alimentoUnidad.value = alimento.unidad_base || "";
      form.alimentoDescripcion.value = alimento.descripcion || "";
      form.alimentoCalorias.value = alimento.calorias ?? "";
      form.alimentoProteinas.value = alimento.proteinas ?? "";
      form.alimentoGrasas.value = alimento.grasas ?? "";
      form.alimentoCarbohidratos.value = alimento.carbohidratos ?? "";
      form.alimentoFibra.value = alimento.fibra ?? "";
      if (alimento.micronutrientes && typeof alimento.micronutrientes === "object") {
        form.alimentoMicros.value = Object.entries(alimento.micronutrientes)
          .map(([clave, valor]) => `${clave}: ${valor}`)
          .join("\n");
      }
    }
    openModal("alimentoModal");
  };

  const showRecetaModal = (receta = null) => {
    const form = document.getElementById("recetaForm");
    if (!form) return;
    resetRecetaForm();
    if (receta) {
      const title = document.getElementById("recetaModalTitle");
      title && (title.textContent = "Editar receta");
      const submit = document.getElementById("recetaSubmit");
      submit && (submit.textContent = "Actualizar receta");
      const recetaId = toNumericId(receta.id ?? receta.receta_id);
      if (Number.isFinite(recetaId)) {
        state.editing.recetaId = recetaId;
      }
      form.recetaNombre.value = receta.nombre || "";
      form.recetaCalorias.value = receta.calorias_objetivo ?? "";
      form.recetaDescripcion.value = receta.descripcion || "";
      form.recetaInstrucciones.value = receta.instrucciones || "";
      const container = document.getElementById("recetaIngredientesContainer");
      if (container) {
        container.innerHTML = "";
        (receta.ingredientes || []).forEach((item) => {
          const row = addIngredientRow();
          if (!row) return;
          const select = row.querySelector(".receta-ingrediente-select");
          const cantidad = row.querySelector(".receta-ingrediente-cantidad");
          const unidad = row.querySelector(".receta-ingrediente-unidad");
          const alimentoId = toNumericId(item.alimento?.id ?? item.alimento_id);
          if (Number.isFinite(alimentoId)) {
            if (!select.querySelector(`option[value="${alimentoId}"]`)) {
              const option = document.createElement("option");
              option.value = String(alimentoId);
              option.textContent = item.alimento?.nombre || `Alimento #${alimentoId}`;
              select.appendChild(option);
            }
            select.value = String(alimentoId);
          }
          cantidad && (cantidad.value = item.cantidad ?? "");
          unidad && (unidad.value = item.unidad || "");
        });
        if (!container.children.length) {
          addIngredientRow();
        }
      }
    }
    openModal("recetaModal");
  };

  const showDietaModal = async (dieta = null) => {
    const form = document.getElementById("dietaForm");
    if (!form) return;
    resetDietaForm();
    const pacienteSelect = form.dietaPacienteId;
    try {
      await loadPacientes();
    } catch (error) {
      // El aviso ya se gestiona de forma global.
    }
    updatePatientSelects(pacienteSelect);
    if (dieta) {
      const title = document.getElementById("dietaModalTitle");
      title && (title.textContent = "Editar dieta");
      const submit = document.getElementById("dietaSubmit");
      submit && (submit.textContent = "Actualizar dieta");
      const dietaId = toNumericId(dieta.id);
      if (Number.isFinite(dietaId)) {
        state.editing.dietaId = dietaId;
      }
      form.dietaNombre.value = dieta.nombre || "";
      form.dietaEsPlantilla.checked = Boolean(dieta.es_plantilla);
      const esPlantilla = form.dietaEsPlantilla.checked;
      pacienteSelect.disabled = esPlantilla;
      if (!esPlantilla && dieta.paciente_id) {
        await ensureSelectHasPatientOption(pacienteSelect, dieta.paciente_id);
      } else {
        pacienteSelect.value = "";
      }
      form.dietaCalorias.value = dieta.calorias_objetivo ?? "";
      form.dietaFechaInicio.value = dieta.fecha_inicio || "";
      form.dietaFechaFin.value = dieta.fecha_fin || "";
      form.dietaObjetivo.value = dieta.objetivo || "";
      form.dietaDescripcion.value = dieta.descripcion || "";
      form.dietaNotas.value = dieta.notas || "";
      const container = document.getElementById("dietaRecetasContainer");
      if (container) {
        container.innerHTML = "";
        (dieta.recetas || []).forEach((item) => {
          const row = addDietRecipeRow();
          if (!row) return;
          const select = row.querySelector(".diet-recipe-select");
          const dia = row.querySelector(".diet-recipe-dia");
          const momento = row.querySelector(".diet-recipe-momento");
          const porciones = row.querySelector(".diet-recipe-porciones");
          const orden = row.querySelector(".diet-recipe-orden");
          const recetaId = toNumericId(item.receta_id ?? item.receta?.id);
          if (Number.isFinite(recetaId)) {
            if (!select.querySelector(`option[value="${recetaId}"]`)) {
              const option = document.createElement("option");
              option.value = String(recetaId);
              option.textContent = item.receta?.nombre || `Receta #${recetaId}`;
              select.appendChild(option);
            }
            select.value = String(recetaId);
          }
          dia && (dia.value = item.dia_semana || "");
          momento && (momento.value = item.momento || "");
          porciones && (porciones.value = item.porciones ?? 1);
          orden && (orden.value = item.orden ?? "");
        });
        if (!container.children.length) {
          addDietRecipeRow();
        }
      }
    }
    openModal("dietaModal");
  };

  const deleteAlimento = async (alimento) => {
    const alimentoId = toNumericId(alimento?.id ?? alimento?.alimento_id ?? alimento);
    if (!Number.isFinite(alimentoId)) return;
    const nombre = (alimento && alimento.nombre) || `#${alimentoId}`;
    if (!window.confirm(`?Eliminar el alimento ${nombre}?`)) {
      return;
    }
    try {
      await requestJson(`/alimentos/${alimentoId}`, { method: "DELETE" });
      await loadAlimentos();
      await loadRecetas();
      await loadDietas();
      markSuccess("alimentos", `Alimento ${nombre} eliminado.`);
    } catch (error) {
      console.warn("No se pudo eliminar el alimento:", error);
      registerError("alimentos", error.message || "No se pudo eliminar el alimento.");
    }
  };

  const deleteReceta = async (receta) => {
    const recetaId = toNumericId(receta?.id ?? receta?.receta_id ?? receta);
    if (!Number.isFinite(recetaId)) return;
    const nombre = (receta && receta.nombre) || `#${recetaId}`;
    if (!window.confirm(`?Eliminar la receta ${nombre}?`)) {
      return;
    }
    try {
      await requestJson(`/recetas/${recetaId}`, { method: "DELETE" });
      await loadRecetas();
      await loadDietas();
      markSuccess("recetas", `Receta ${nombre} eliminada.`);
    } catch (error) {
      console.warn("No se pudo eliminar la receta:", error);
      registerError("recetas", error.message || "No se pudo eliminar la receta.");
    }
  };

  const deleteDieta = async (dieta) => {
    const dietaId = toNumericId(dieta?.id ?? dieta);
    if (!Number.isFinite(dietaId)) return;
    const nombre = (dieta && dieta.nombre) || `#${dietaId}`;
    if (!window.confirm(`?Eliminar la dieta ${nombre}?`)) {
      return;
    }
    try {
      await requestJson(`/dietas/${dietaId}`, { method: "DELETE" });
      await loadDietas();
      markSuccess("dietas", `Dieta ${nombre} eliminada.`);
    } catch (error) {
      console.warn("No se pudo eliminar la dieta:", error);
      registerError("dietas", error.message || "No se pudo eliminar la dieta.");
    }
  };

  const handleSubmitAlimento = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = document.getElementById("alimentoFeedback");
    feedback && (feedback.textContent = "");
    try {
      const payload = {
        nombre: form.alimentoNombre.value.trim(),
        descripcion: form.alimentoDescripcion.value.trim() || null,
        calorias: Number.parseFloat(form.alimentoCalorias.value),
        proteinas: Number.parseFloat(form.alimentoProteinas.value),
        grasas: Number.parseFloat(form.alimentoGrasas.value),
        carbohidratos: Number.parseFloat(form.alimentoCarbohidratos.value),
        fibra: Number.parseFloat(form.alimentoFibra.value) || 0,
        unidad_base: form.alimentoUnidad.value.trim() || "g",
        micronutrientes: parseMicros(form.alimentoMicros.value)
      };

      if (!payload.nombre) throw new Error("Introduce un nombre.");
      if (!Number.isFinite(payload.calorias) || !Number.isFinite(payload.proteinas) || !Number.isFinite(payload.grasas) || !Number.isFinite(payload.carbohidratos)) {
        throw new Error("Completa los campos nutricionales.");
      }

      const alimentoId = state.editing.alimentoId;
      const isUpdate = Number.isFinite(alimentoId);

      await requestJson(isUpdate ? `/alimentos/${alimentoId}` : "/alimentos", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await loadAlimentos();
      await loadRecetas();
      await loadDietas();

      const message = isUpdate ? "Alimento actualizado correctamente." : "Alimento guardado correctamente.";
      feedback && (feedback.textContent = message);
      feedback && feedback.classList.add("success");
      markSuccess("alimentos", message);
      state.editing.alimentoId = null;
      setTimeout(() => {
        closeModal("alimentoModal");
        resetAlimentoForm();
      }, 400);
    } catch (error) {
      console.warn("No se pudo guardar el alimento:", error);
      feedback && (feedback.textContent = error.message || "No se pudo guardar el alimento.");
      feedback && feedback.classList.remove("success");
      registerError("alimentos", error.message || "No se pudo guardar el alimento.");
    }
  };

  const handleSubmitReceta = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = document.getElementById("recetaFeedback");
    feedback && (feedback.textContent = "");
    try {
      const ingredientes = collectRecetaIngredientes();
      if (!ingredientes.length) throw new Error("Anade al menos un ingrediente.");

      const payload = {
        nombre: form.recetaNombre.value.trim(),
        descripcion: form.recetaDescripcion.value.trim() || null,
        calorias_objetivo: form.recetaCalorias.value ? Number.parseFloat(form.recetaCalorias.value) : null,
        instrucciones: form.recetaInstrucciones.value.trim() || null,
        ingredientes
      };

      if (!payload.nombre) throw new Error("Introduce un nombre para la receta.");

      const recetaId = state.editing.recetaId;
      const isUpdate = Number.isFinite(recetaId);

      await requestJson(isUpdate ? `/recetas/${recetaId}` : "/recetas", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await loadRecetas();
      await loadDietas();

      const message = isUpdate ? "Receta actualizada correctamente." : "Receta guardada correctamente.";
      feedback && (feedback.textContent = message);
      feedback && feedback.classList.add("success");
      markSuccess("recetas", message);
      state.editing.recetaId = null;
      setTimeout(() => {
        closeModal("recetaModal");
        resetRecetaForm();
      }, 400);
    } catch (error) {
      console.warn("No se pudo guardar la receta:", error);
      feedback && (feedback.textContent = error.message || "No se pudo guardar la receta.");
      feedback && feedback.classList.remove("success");
      registerError("recetas", error.message || "No se pudo guardar la receta.");
    }
  };

  const handleSubmitDieta = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = document.getElementById("dietaFeedback");
    feedback && (feedback.textContent = "");
    try {
      const recetas = collectDietaRecetas();
      ensureRecetasUnicas(recetas);
      const esPlantilla = form.dietaEsPlantilla.checked;
      const pacienteId = normalizePatientId(form.dietaPacienteId.value);
      if (!esPlantilla && !pacienteId) {
        throw new Error("Selecciona un paciente.");
      }

      const usuarioId = resolveUsuarioId(state.usuario);
      const payload = {
        nombre: form.dietaNombre.value.trim(),
        objetivo: form.dietaObjetivo.value.trim() || null,
        descripcion: form.dietaDescripcion.value.trim() || null,
        calorias_objetivo: form.dietaCalorias.value ? Number.parseFloat(form.dietaCalorias.value) : null,
        fecha_inicio: form.dietaFechaInicio.value || null,
        fecha_fin: form.dietaFechaFin.value || null,
        paciente_id: esPlantilla ? null : pacienteId,
        usuario_id: usuarioId,
        es_plantilla: esPlantilla,
        notas: form.dietaNotas.value.trim() || null,
        recetas
      };

      if (!payload.nombre) throw new Error("Introduce un nombre para la dieta.");
      if (!Number.isFinite(usuarioId)) throw new Error("No se pudo determinar el usuario responsable.");

      const dietaId = state.editing.dietaId;
      const isUpdate = Number.isFinite(dietaId);

      await requestJson(isUpdate ? `/dietas/${dietaId}` : "/dietas", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await loadDietas();

      const message = isUpdate ? "Dieta actualizada correctamente." : "Plan nutricional guardado correctamente.";
      feedback && (feedback.textContent = message);
      feedback && feedback.classList.add("success");
      markSuccess("dietas", message);
      state.editing.dietaId = null;
      setTimeout(() => {
        closeModal("dietaModal");
        resetDietaForm();
      }, 400);
    } catch (error) {
      console.warn("No se pudo guardar la dieta:", error);
      feedback && (feedback.textContent = error.message || "No se pudo guardar la dieta.");
      feedback && feedback.classList.remove("success");
      registerError("dietas", error.message || "No se pudo guardar la dieta.");
    }
  };

  const prepareAssignModal = async (dieta) => {
    state.modalContext.dieta = dieta;
    const form = document.getElementById("assignForm");
    const feedback = document.getElementById("assignFeedback");
    if (!form) return;
    form.assignDietaId.value = dieta.id;
    try {
      await loadPacientes();
    } catch (error) {
      // Ya se notifico mediante la alerta global.
    }
    updatePatientSelects(form.assignPacienteId);
    const pacienteAsignadoId = normalizePatientId(dieta.paciente_id);
    if (pacienteAsignadoId) {
      await ensureSelectHasPatientOption(form.assignPacienteId, pacienteAsignadoId);
    } else {
      form.assignPacienteId.value = "";
    }
    form.assignFechaInicio.value = dieta.fecha_inicio || "";
    form.assignFechaFin.value = dieta.fecha_fin || "";
    form.assignNotas.value = dieta.notas || "";
    form.assignComentario.value = "";
    if (feedback) {
      feedback.textContent = "";
    }
    openModal("assignModal");
  };

  const handleAssignSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = document.getElementById("assignFeedback");
    feedback && (feedback.textContent = "");

    const dietaId = Number.parseInt(form.assignDietaId.value, 10);
    const pacienteId = normalizePatientId(form.assignPacienteId.value);

    if (!Number.isFinite(dietaId)) {
      feedback && (feedback.textContent = "No se pudo identificar la dieta.");
      return;
    }
    if (!pacienteId) {
      feedback && (feedback.textContent = "Selecciona un paciente valido.");
      return;
    }

    const usuarioId = resolveUsuarioId(state.usuario);
    if (!Number.isFinite(usuarioId)) {
      feedback && (feedback.textContent = "No se pudo determinar el usuario responsable.");
      return;
    }

    try {
      await requestJson(`/dietas/${dietaId}/asignaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paciente_id: pacienteId,
          usuario_id: usuarioId,
          fecha_inicio: form.assignFechaInicio.value || null,
          fecha_fin: form.assignFechaFin.value || null,
          notas: form.assignNotas.value.trim() || null,
          comentario: form.assignComentario.value.trim() || null
        })
      });

      await loadDietas();
      markSuccess("dietas", "Dieta asignada al paciente.");
      closeModal("assignModal");
    } catch (error) {
      console.warn("No se pudo asignar la dieta:", error);
      const message = error.message || "No se pudo asignar la dieta.";
      feedback && (feedback.textContent = message);
      registerError("dietas", message);
    }
  };

  const prepareVersionModal = (dieta) => {
    state.modalContext.dieta = dieta;
    const form = document.getElementById("versionForm");
    const feedback = document.getElementById("versionFeedback");
    if (!form) return;
    form.versionDietaId.value = dieta.id;
    form.versionombre.value = dieta.nombre || "";
    form.versionCalorias.value = dieta.calorias_objetivo || "";
    form.versionFechaInicio.value = dieta.fecha_inicio || "";
    form.versionFechaFin.value = dieta.fecha_fin || "";
    form.versionObjetivo.value = dieta.objetivo || "";
    form.versionotas.value = dieta.notas || "";
    form.versionComentario.value = "";
    if (feedback) {
      feedback.textContent = "";
    }
    openModal("versionModal");
  };

  const handleVersionSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = document.getElementById("versionFeedback");
    feedback && (feedback.textContent = "");

    const dietaId = Number.parseInt(form.versionDietaId.value, 10);
    if (!Number.isFinite(dietaId)) {
      feedback && (feedback.textContent = "No se pudo identificar la dieta.");
      return;
    }

    const usuarioId = resolveUsuarioId(state.usuario);
    if (!Number.isFinite(usuarioId)) {
      feedback && (feedback.textContent = "No se pudo determinar el usuario responsable.");
      return;
    }

    try {
      await requestJson(`/dietas/${dietaId}/versionar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuarioId,
          nombre: form.versionombre.value.trim() || null,
          calorias_objetivo: form.versionCalorias.value ? Number.parseFloat(form.versionCalorias.value) : null,
          fecha_inicio: form.versionFechaInicio.value || null,
          fecha_fin: form.versionFechaFin.value || null,
          objetivo: form.versionObjetivo.value.trim() || null,
          notas: form.versionotas.value.trim() || null,
          comentario: form.versionComentario.value.trim() || null
        })
      });

      await loadDietas();
      markSuccess("dietas", "Se genero una nueva version de la dieta.");
      closeModal("versionModal");
    } catch (error) {
      console.warn("No se pudo versionar la dieta:", error);
      const message = error.message || "No se pudo generar la nueva version.";
      feedback && (feedback.textContent = message);
      registerError("dietas", message);
    }
  };

  const prepareNotifyModal = (dieta) => {
    state.modalContext.dieta = dieta;
    const form = document.getElementById("notifyForm");
    const feedback = document.getElementById("notifyFeedback");
    if (!form) return;
    form.notifyDietaId.value = dieta.id;
    form.notifyCanal.value = "email";
    form.notifyAsunto.value = `Plan nutricional ${dieta.nombre}`;
    form.notifyMensaje.value = `Hola, te compartimos la version ${dieta.version} de tu plan nutricional "${dieta.nombre}".`;
    form.notifyPdf.checked = true;
    form.notifyCsv.checked = false;
    form.notifyCopiaProfesional.checked = false;
    if (feedback) {
      feedback.textContent = "";
    }
    openModal("notifyModal");
  };

  const handleNotifySubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = document.getElementById("notifyFeedback");
    feedback && (feedback.textContent = "");

    const dietaId = Number.parseInt(form.notifyDietaId.value, 10);
    if (!Number.isFinite(dietaId)) {
      feedback && (feedback.textContent = "No se pudo identificar la dieta.");
      return;
    }

    try {
      await requestJson(`/dietas/${dietaId}/notificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canal: form.notifyCanal.value || "email",
          asunto: form.notifyAsunto.value.trim() || null,
          mensaje: form.notifyMensaje.value.trim() || null,
          adjuntar_pdf: form.notifyPdf.checked,
          adjuntar_csv: form.notifyCsv.checked,
          enviar_copia_profesional: form.notifyCopiaProfesional.checked
        })
      });

      markSuccess("dietas", "Se envio la notificacion al paciente.");
      closeModal("notifyModal");
    } catch (error) {
      console.warn("No se pudo notificar la dieta:", error);
      const message = error.message || "No se pudo enviar la notificacion.";
      feedback && (feedback.textContent = message);
      registerError("dietas", message);
    }
  };

  const downloadFile = (blob, fallbackName, disposition) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    let filename = fallbackName;
    const match = /filename="?([^"]+)"?/i.exec(disposition || "");
    if (match?.[1]) {
      filename = match[1];
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDietAction = async (dieta, action) => {
    switch (action) {
      case "edit":
        await showDietaModal(dieta);
        break;
      case "delete":
        await deleteDieta(dieta);
        break;
      case "export-pdf":
      case "export-csv": {
        try {
          const formato = action === "export-pdf" ? "pdf" : "csv";
          const result = await requestBinary(`/dietas/${dieta.id}/exportar?formato=${formato}`);
          if (result) {
            downloadFile(result.blob, `dieta_${dieta.id}.${formato}`, result.disposition);
            markSuccess("dietas", `Exportacion generada en formato ${formato.toUpperCase()}.`);
          }
        } catch (error) {
          registerError("dietas", error.message || "No se pudo exportar la dieta.");
        }
        break;
      }
      case "assign":
        if (dieta.es_plantilla) {
          await prepareAssignModal(dieta);
        }
        break;
      case "version":
        if (!dieta.es_plantilla) {
          prepareVersionModal(dieta);
        }
        break;
      case "notify":
        if (dieta.paciente_id) {
          prepareNotifyModal(dieta);
        }
        break;
      default:
        break;
    }
  };

  const handleAlimentosClick = (event) => {
    const button = event.target.closest('button[data-entity="alimento"]');
    if (!button) return;
    const alimentoId = toNumericId(button.dataset.id);
    if (!Number.isFinite(alimentoId)) return;
    const alimento = state.alimentos.find((item) => toNumericId(item.id ?? item.alimento_id) === alimentoId);
    if (button.dataset.action === "edit") {
      showAlimentoModal(alimento);
    } else if (button.dataset.action === "delete") {
      deleteAlimento(alimento || alimentoId);
    }
  };

  const handleRecetasClick = (event) => {
    const button = event.target.closest('button[data-entity="receta"]');
    if (!button) return;
    const recetaId = toNumericId(button.dataset.id);
    if (!Number.isFinite(recetaId)) return;
    const receta = state.recetas.find((item) => toNumericId(item.id ?? item.receta_id) === recetaId);
    if (button.dataset.action === "edit") {
      showRecetaModal(receta);
    } else if (button.dataset.action === "delete") {
      deleteReceta(receta || recetaId);
    }
  };

  const handleDietCardClick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "create-dieta") {
      showDietaModal();
      return;
    }
    const detailPanel = event.currentTarget.closest("#dietDetailPanel") || document.getElementById("dietDetailPanel");
    const datasetId = button.dataset.id || detailPanel?.dataset.id;
    const dietaId = Number.parseInt(datasetId || "", 10);
    if (!Number.isFinite(dietaId)) return;
    const dieta =
      state.dietas.find((item) => item.id === dietaId) ||
      state.dietasRaw.find((item) => item.id === dietaId);
    if (!dieta) return;
    if (state.ui.selectedDietaId !== dieta.id) {
      state.ui.selectedDietaId = dieta.id;
    }
    handleDietAction(dieta, button.dataset.action);
  };

  const handleAssignmentClick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest(".assignment-card");
    const datasetId = button.dataset.id || card?.dataset.dietaId;
    const dietaId = Number.parseInt(datasetId || "", 10);
    if (!Number.isFinite(dietaId)) return;
    const dieta =
      state.dietas.find((item) => item.id === dietaId) ||
      state.dietasRaw.find((item) => item.id === dietaId);
    if (!dieta) return;
    const action = button.dataset.action;
    if (action === "open-diet") {
      state.ui.activeTab = "catalogo";
      state.ui.selectedDietaId = dieta.id;
      renderDietView();
      return;
    }
    if (state.ui.selectedDietaId !== dieta.id) {
      state.ui.selectedDietaId = dieta.id;
    }
    handleDietAction(dieta, action);
  };

  const attachModalClose = () => {
    const handleResetById = (id) => {
      switch (id) {
        case "alimentoModal":
          resetAlimentoForm();
          break;
        case "recetaModal":
          resetRecetaForm();
          break;
        case "dietaModal":
          resetDietaForm();
          break;
        default:
          break;
      }
    };

    document.querySelectorAll("[data-modal-close]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const id = event.currentTarget.getAttribute("data-modal-close");
        if (!id) return;
        closeModal(id);
        handleResetById(id);
      });
    });
    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          overlay.classList.remove("is-open");
          overlay.setAttribute("hidden", "hidden");
          handleResetById(overlay.id);
        }
      });
    });
  };
  const init = async () => {
    state.usuario = getStoredUser();
    if (!state.usuario) {
      redirectToLogin();
      return;
    }

    setGlobalAlert("");

    const searchParams = new URLSearchParams(window.location.search);
    const initialPacienteFilter = (searchParams.get("pacienteId") || searchParams.get("paciente") || "").trim();
    state.initialPacienteFilter = initialPacienteFilter;
    if (initialPacienteFilter) {
      state.dietSearch = initialPacienteFilter;
      state.filters.asignacion = "asignadas";
    }

    document.getElementById("backToDashboard")?.addEventListener("click", () => {
      window.location.href = "principal.html";
    });
    const openTopButton = document.getElementById("openDietaModalTop");
    openTopButton?.addEventListener("click", () => showDietaModal());
    document.getElementById("openAlimentoModal")?.addEventListener("click", () => showAlimentoModal());
    document.getElementById("openRecetaModal")?.addEventListener("click", () => showRecetaModal());
    document.getElementById("openDietaModal")?.addEventListener("click", () => showDietaModal());
    document.getElementById("openDietaModalEmpty")?.addEventListener("click", () => showDietaModal());

    document.getElementById("addRecetaIngrediente")?.addEventListener("click", addIngredientRow);
    document.getElementById("addDietaReceta")?.addEventListener("click", addDietRecipeRow);

    document.getElementById("recetaIngredientesContainer")?.addEventListener("click", (event) => {
      const button = event.target.closest(".remove-row");
      if (!button) return;
      const row = button.closest(".receta-ingrediente-row");
      row?.remove();
      if (!document.querySelector(".receta-ingrediente-row")) {
        addIngredientRow();
      }
    });

    document.getElementById("dietaRecetasContainer")?.addEventListener("click", (event) => {
      const button = event.target.closest(".remove-row");
      if (!button) return;
      const row = button.closest(".diet-recipe-row");
      row?.remove();
      if (!document.querySelector(".diet-recipe-row")) {
        addDietRecipeRow();
      }
    });

    document.getElementById("alimentoForm")?.addEventListener("submit", handleSubmitAlimento);
    document.getElementById("recetaForm")?.addEventListener("submit", handleSubmitReceta);
    document.getElementById("dietaForm")?.addEventListener("submit", handleSubmitDieta);
    document.getElementById("dietaForm")?.dietaEsPlantilla?.addEventListener("change", async (event) => {
      const pacienteField = document.getElementById("dietaPacienteId");
      if (!pacienteField) return;
      const checkbox = event.currentTarget;
      const target = event.target;
      const fallbackChecked = target && typeof target.checked === "boolean" ? target.checked : false;
      const isPlantilla = checkbox && typeof checkbox.checked === "boolean" ? checkbox.checked : fallbackChecked;
      pacienteField.disabled = isPlantilla;
      if (isPlantilla) {
        pacienteField.value = "";
        return;
      }
      try {
        await loadPacientes();
      } catch (error) {
        // El aviso ya se gestiona de forma global.
      }
      updatePatientSelects(pacienteField);
    });
    document.getElementById("assignForm")?.addEventListener("submit", handleAssignSubmit);
    document.getElementById("versionForm")?.addEventListener("submit", handleVersionSubmit);
    document.getElementById("notifyForm")?.addEventListener("submit", handleNotifySubmit);

    document.getElementById("alimentosList")?.addEventListener("click", handleAlimentosClick);
    document.getElementById("recetasList")?.addEventListener("click", handleRecetasClick);
    document.getElementById("dietCatalogList")?.addEventListener("click", (event) => {
      const summary = event.target.closest(".diet-summary");
      if (!summary) return;
      const dietaId = Number.parseInt(summary.dataset.id || "", 10);
      if (!Number.isFinite(dietaId)) return;
      state.ui.selectedDietaId = dietaId;
      renderDietView();
    });
    document.getElementById("dietDetailPanel")?.addEventListener("click", handleDietCardClick);
    document.getElementById("dietAssignmentsList")?.addEventListener("click", handleAssignmentClick);

    document.getElementById("dietSearch")?.addEventListener("input", (event) => {
      state.dietSearch = event.target.value || "";
      applyDietFilters();
      renderDietView();
    });
    document.getElementById("filterPlantillas")?.addEventListener("change", (event) => {
      state.filters.mostrarPlantillas = event.target.checked;
      applyDietFilters();
      renderDietView();
      loadDietas();
    });
    document.getElementById("filterPersonales")?.addEventListener("change", (event) => {
      state.filters.mostrarPersonalizadas = event.target.checked;
      applyDietFilters();
      renderDietView();
      loadDietas();
    });
    document.getElementById("filterEstado")?.addEventListener("change", (event) => {
      state.filters.estado = event.target.value || "todas";
      applyDietFilters();
      renderDietView();
      loadDietas();
    });
    document.getElementById("filterAsignacion")?.addEventListener("change", (event) => {
      state.filters.asignacion = event.target.value || "todas";
      applyDietFilters();
      renderDietView();
    });
    document.getElementById("assignmentSearch")?.addEventListener("input", (event) => {
      state.ui.assignmentSearch = event.target.value || "";
      if (state.ui.activeTab === "asignaciones") {
        renderAssignments();
      }
    });
    document.getElementById("assignmentEstado")?.addEventListener("change", (event) => {
      state.ui.assignmentEstado = event.target.value || "vigentes";
      if (state.ui.activeTab === "asignaciones") {
        renderAssignments();
      }
    });
    document.getElementById("refreshAsignaciones")?.addEventListener("click", () => {
      loadDietas();
    });
    document.querySelectorAll(".diet-tab").forEach((tab) => {
      tab.addEventListener("click", (event) => {
        const tabName = event.currentTarget.getAttribute("data-tab") || "catalogo";
        if (state.ui.activeTab === tabName) return;
        state.ui.activeTab = tabName;
        updateTabsVisibility();
      });
    });

    if (initialPacienteFilter) {
      const searchInput = document.getElementById("dietSearch");
      if (searchInput && !searchInput.value) {
        searchInput.value = initialPacienteFilter;
      }
      const asignacionSelect = document.getElementById("filterAsignacion");
      if (asignacionSelect) {
        asignacionSelect.value = "asignadas";
      }
    }

    document.getElementById("recetaSearch")?.addEventListener("input", (event) => {
      state.recetaSearch = event.target.value || "";
      renderRecetas();
    });
    document.getElementById("alimentoSearch")?.addEventListener("input", (event) => {
      state.alimentoSearch = event.target.value || "";
      renderAlimentos();
    });

    document.getElementById("refreshDietas")?.addEventListener("click", loadDietas);
    document.getElementById("refreshRecetas")?.addEventListener("click", loadRecetas);
    document.getElementById("refreshAlimentos")?.addEventListener("click", loadAlimentos);

    attachModalClose();

    await Promise.all([loadAlimentos(), loadRecetas(), loadDietas()]);
    loadPacientes().catch(() => {
      // El aviso ya se gestiono anteriormente si falla.
    });
  };

  document.addEventListener("DOMContentLoaded", init);
})();




