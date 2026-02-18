(function () {
  const resolveGatewayBase = () => {
    const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
    const hostname = (window.location.hostname || "localhost").toLowerCase() || "localhost";
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const targetHost = isLocal ? "localhost" : hostname;
    return `${protocol}//${targetHost}:5000`;
  };

  const resolveDirectBase = () => {
    const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
    const hostname = (window.location.hostname || "localhost").toLowerCase() || "localhost";
    return `${protocol}//${hostname}:5002`;
  };

  const resolveGestionDirectBase = () => {
    const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
    const hostname = (window.location.hostname || "localhost").toLowerCase() || "localhost";
    return `${protocol}//${hostname}:4001`;
  };

  const macroColors = {
    energia: "var(--macro-energy)",
    grasa: "var(--macro-fat)",
    carbohidratos: "var(--macro-carbs)",
    proteina: "var(--macro-protein)",
    fibra: "var(--macro-fiber)"
  };

  const REQUIRED_MEALS = ["Desayuno", "Comida", "Cena"];
  const OPTIONAL_MEALS = ["Almuerzo", "Merienda"];
  const DEFAULT_USER_ID = 1;

  const getStoredUser = () => {
    try {
      const raw = localStorage.getItem("bizihotzUsuario");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn("No se pudo leer el usuario almacenado", error);
      return null;
    }
  };

  const resolveCurrentUserId = () => {
    const stored = getStoredUser();
    const fromUserObj =
      stored?.idUsuario ||
      stored?.usuarioId ||
      stored?.id ||
      stored?._id ||
      stored?.usuario?.idUsuario ||
      stored?.usuario?.id ||
      stored?.usuario?._id;
    if (Number.isFinite(Number(fromUserObj))) {
      return Number(fromUserObj);
    }
    return DEFAULT_USER_ID;
  };

  const buildAuthHeaders = (base = {}) => {
    const headers = Object.assign({ Accept: "application/json" }, base || {});
    const stored = getStoredUser();
    const token =
      (stored && (stored.token || stored.accessToken || stored.authToken)) ||
      (stored && stored?.usuario && (stored.usuario.token || stored.usuario.accessToken));
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  const emptyMacros = () => ({
    energia: 0,
    grasa: 0,
    carbohidratos: 0,
    proteina: 0,
    fibra: 0
  });

  const cloneMacros = (macros) => ({
    energia: Number(macros?.energia) || 0,
    grasa: Number(macros?.grasa) || 0,
    carbohidratos: Number(macros?.carbohidratos) || 0,
    proteina: Number(macros?.proteina) || 0,
    fibra: Number(macros?.fibra) || 0,
  });

  const backendMacrosToEnergy = (macros) => ({
    energia: Number(macros?.calorias) || 0,
    grasa: Number(macros?.grasas) || 0,
    carbohidratos: Number(macros?.carbohidratos) || 0,
    proteina: Number(macros?.proteinas) || 0,
    fibra: Number(macros?.fibra) || 0,
  });

  const buildEmptyMeal = (nombre) => ({
    nombre,
    hora: "",
    items: [],
    macros: emptyMacros(),
    empty: true
  });

  const EMPTY_PLAN_TEMPLATE = {
    nombre: "Plantilla en blanco",
    id: null,
    objetivoCalorias: 0,
    objetivosMacros: emptyMacros(),
    resumen: emptyMacros(),
    notas: "",
    notasPaciente: "",
    comentarioInterno: "",
    esPlantilla: true,
    pacienteBase: null,
    fechaInicio: null,
    fechaFin: null,
    comidas: [...REQUIRED_MEALS, ...OPTIONAL_MEALS].map((nombre) => buildEmptyMeal(nombre))
  };

  const cloneEmptyPlan = () => JSON.parse(JSON.stringify(EMPTY_PLAN_TEMPLATE));
  const LAST_DIETA_KEY = "bizihotzLastDietaId";
  const LAST_DIETA_ASSIGNED_KEY = "bizihotzLastAssignedDietaId";
  const DIETA_INTRO_SEEN_KEY = "bizihotzDietaIntroSeen";
  const PACIENTE_PARAM = new URLSearchParams(window.location.search).get("pacienteId");
  let planState = cloneEmptyPlan();

  const setLastDietaId = (id) => {
    if (!id) {
      localStorage.removeItem(LAST_DIETA_KEY);
      return;
    }
    try {
      localStorage.setItem(LAST_DIETA_KEY, String(id));
    } catch (error) {
      console.warn("No se pudo guardar el ID de dieta reciente", error);
    }
  };

  const getLastDietaId = () => {
    try {
      return localStorage.getItem(LAST_DIETA_KEY);
    } catch {
      return null;
    }
  };
  const setLastAssignedId = (id) => {
    if (!id) {
      localStorage.removeItem(LAST_DIETA_ASSIGNED_KEY);
      return;
    }
    try {
      localStorage.setItem(LAST_DIETA_ASSIGNED_KEY, String(id));
    } catch (error) {
      console.warn("No se pudo guardar el ID de ultima dieta asignada", error);
    }
  };

  const getLastAssignedId = () => {
    try {
      return localStorage.getItem(LAST_DIETA_ASSIGNED_KEY);
    } catch {
      return null;
    }
  };

  const hasSeenIntro = () => {
    try {
      return sessionStorage.getItem(DIETA_INTRO_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  };

  const markIntroSeen = () => {
    try {
      sessionStorage.setItem(DIETA_INTRO_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const hideIntroOverlay = () => {
    if (selectors.introOverlay) {
      selectors.introOverlay.classList.remove("is-open");
      selectors.introOverlay.hidden = true;
    }
    document.body.classList.remove("intro-blur");
  };

  let API_BASE = `${resolveGatewayBase()}/nutricion/api`;
  const API_FALLBACK = `${resolveDirectBase()}/api`;
  let GESTION_API_BASE = `${resolveGatewayBase()}/gestion/api`;
  const GESTION_API_FALLBACK = `${resolveGestionDirectBase()}/api`;

  const sendJson = async (method, path, payload) => {
    const url = `${API_BASE}${path}`;
    const doFetch = async (fullUrl) => {
      const resp = await fetch(fullUrl, {
        method,
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: payload ? JSON.stringify(payload) : null,
      });
      if (!resp.ok) {
        const text = await resp.text();
        const err = new Error(text || `Error ${resp.status}`);
        err.status = resp.status;
        throw err;
      }
      if (resp.status === 204) return {};
      return resp.json().catch(() => ({}));
    };
    try {
      return await doFetch(url);
    } catch (error) {
      if (error?.status === 401) {
        throw error;
      }
      if (`${API_BASE}` !== `${API_FALLBACK}`) {
        const fallbackUrl = `${API_FALLBACK}${path}`;
        const data = await doFetch(fallbackUrl);
        API_BASE = API_FALLBACK;
        return data;
      }
      throw error;
    }
  };

  const postJson = (path, payload) => sendJson("POST", path, payload);
  const putJson = (path, payload) => sendJson("PUT", path, payload);
  const deleteJson = (path) => sendJson("DELETE", path);

  const selectors = {
    recetasList: document.getElementById("recetasList"),
    alimentosList: document.getElementById("alimentosList"),
    recetaSearch: document.getElementById("recetaSearch"),
    alimentoSearch: document.getElementById("alimentoSearch"),
    refreshRecetas: document.getElementById("refreshRecetas"),
    refreshAlimentos: document.getElementById("refreshAlimentos"),
    mealFoodModal: document.getElementById("mealFoodModal"),
    mealFoodSelect: document.getElementById("mealFoodSelect"),
    mealFoodCantidad: document.getElementById("mealFoodCantidad"),
    mealFoodUnidad: document.getElementById("mealFoodUnidad"),
    mealFoodPreview: document.getElementById("mealFoodPreview"),
    openNuevoAlimento: document.getElementById("openNuevoAlimento"),
    openEditarAlimento: document.getElementById("openEditarAlimento"),
    deleteAlimentoBtn: document.getElementById("deleteAlimentoBtn"),
    nuevoAlimentoModal: document.getElementById("nuevoAlimentoModal"),
    nuevoAlimentoForm: document.getElementById("nuevoAlimentoForm"),
    nuevoAlimentoNombre: document.getElementById("nuevoAlimentoNombre"),
    nuevoAlimentoUnidad: document.getElementById("nuevoAlimentoUnidad"),
    nuevoAlimentoCal: document.getElementById("nuevoAlimentoCal"),
    nuevoAlimentoProt: document.getElementById("nuevoAlimentoProt"),
    nuevoAlimentoGrasa: document.getElementById("nuevoAlimentoGrasa"),
    nuevoAlimentoCarb: document.getElementById("nuevoAlimentoCarb"),
    nuevoAlimentoFibra: document.getElementById("nuevoAlimentoFibra"),
    nuevoAlimentoFeedback: document.getElementById("nuevoAlimentoFeedback"),
    nuevoAlimentoTitle: document.querySelector("#nuevoAlimentoModal h3"),
    nuevoAlimentoSubmit: document.querySelector("#nuevoAlimentoForm button[type='submit']"),
    mealFoodForm: document.getElementById("mealFoodForm"),
    mealFoodFeedback: document.getElementById("mealFoodFeedback"),
    mealFoodNew: document.getElementById("mealFoodNew"),
    newDietaModal: document.getElementById("nuevaDietaModal"),
    newDietaForm: document.getElementById("nuevaDietaForm"),
    newDietaNombre: document.getElementById("nuevaDietaNombre"),
    newDietaFeedback: document.getElementById("nuevaDietaFeedback"),
    assignModal: document.getElementById("assignModal"),
    assignForm: document.getElementById("assignForm"),
    assignPacienteId: document.getElementById("assignPacienteId"),
    assignFechaInicio: document.getElementById("assignFechaInicio"),
    assignFechaFin: document.getElementById("assignFechaFin"),
    assignNotas: document.getElementById("assignNotas"),
    assignComentario: document.getElementById("assignComentario"),
    analysisModal: document.getElementById("analysisModal"),
    analysisContent: document.getElementById("dietPlanAnalysis"),
    mealDetailModal: document.getElementById("mealDetailModal"),
    mealDetailTitle: document.getElementById("mealDetailTitle"),
    mealDetailBody: document.getElementById("mealDetailBody"),
    savePlanBtn: document.getElementById("savePlanBtn"),
    newDietaBtn: document.getElementById("newDietaBtn"),
    deleteDietaBtn: document.getElementById("deleteDietaBtn"),
    deleteDietaModal: document.getElementById("deleteDietaModal"),
    deleteDietaText: document.getElementById("deleteDietaText"),
    confirmDeleteDietaBtn: document.getElementById("confirmDeleteDietaBtn"),
    dietaFechaInicio: document.getElementById("dietaFechaInicio"),
    dietaFechaFin: document.getElementById("dietaFechaFin"),
    dietaNotasPaciente: document.getElementById("dietaNotasPaciente"),
    dietaComentarioInterno: document.getElementById("dietaComentarioInterno"),
    saveMetaFechaInicio: document.getElementById("saveMetaFechaInicio"),
    saveMetaFechaFin: document.getElementById("saveMetaFechaFin"),
    saveMetaNotasPaciente: document.getElementById("saveMetaNotasPaciente"),
    saveMetaComentarioInterno: document.getElementById("saveMetaComentarioInterno"),
    saveMetaModal: document.getElementById("saveMetaModal"),
    saveMetaForm: document.getElementById("saveMetaForm"),
    saveMetaFeedback: document.getElementById("saveMetaFeedback"),
    assignPacienteWrapper: document.getElementById("assignPacienteId")
      ? document.getElementById("assignPacienteId").parentElement
      : null,
    templatePicker: document.getElementById("templatePicker"),
    notesBox: document.getElementById("planNotes"),
    dietList: document.getElementById("dietList"),
    dietDetail: document.getElementById("dietDetail"),
    refreshDietasBtn: document.getElementById("refreshDietasBtn"),
    statPlantillas: document.getElementById("statPlantillas"),
    statDietasActivas: document.getElementById("statDietasActivas"),
    statPacientes: document.getElementById("statPacientes"),
    introOverlay: document.getElementById("introOverlay"),
    introClose: document.getElementById("introClose"),
  };

  // Evita que el overlay se reabra dentro de la misma carga de página.
  let introShown = false;

  const cameFromEntryPage = () => {
    try {
      const ref = document.referrer || "";
      if (!ref) return false;
      const url = new URL(ref, window.location.origin);
      const path = (url.pathname || "").toLowerCase();
      return (
        path.endsWith("/principal.html") ||
        path.endsWith("/principal") ||
        path.endsWith("/historialclinico.html") ||
        path.endsWith("/historialclinico")
      );
    } catch {
      return false;
    }
  };

  const state = {
    recetasLoading: false,
    alimentosLoading: false,
    pacientesLoading: false,
    pacientesLoaded: false,
    recetas: [],
    bedcaSyncAttempted: false,
    alimentoEditId: null,
    alimentos: [],
    dietas: [],
    pacientes: [],
  };

  const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    const num = Number.parseFloat(value);
    if (Number.isNaN(num)) return "-";
    return num.toFixed(decimals);
  };

  const setPlaceholder = (element, message) => {
    if (!element) return;
    element.dataset.empty = message;
    element.innerHTML = `<div class="placeholder">${message}</div>`;
  };

  const safeParseJson = (text) => {
    if (!text || typeof text !== "string") return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  };

  const fetchJson = async (path) => {
    const url = `${API_BASE}${path}`;
    try {
      const response = await fetch(url, { headers: buildAuthHeaders() });
      if (!response.ok) {
        const text = await response.text();
        const err = new Error(text || `Error ${response.status}`);
        err.status = response.status;
        throw err;
      }
      return await response.json();
    } catch (error) {
      if (error?.status === 401) {
        throw error;
      }
      if (API_BASE !== `${API_FALLBACK}`) {
        const fallbackUrl = `${API_FALLBACK}${path}`;
        const resp = await fetch(fallbackUrl, { headers: buildAuthHeaders() });
        if (!resp.ok) {
          const text = await resp.text();
          const err = new Error(text || `Error ${resp.status}`);
          err.status = resp.status;
          throw err;
        }
        API_BASE = API_FALLBACK;
        return await resp.json();
      }
      throw error;
    }
  };

  const fetchGestionJson = async (path) => {
    const doFetch = async (fullUrl) => {
      const response = await fetch(fullUrl, { headers: buildAuthHeaders() });
      if (!response.ok) {
        const text = await response.text();
        const err = new Error(text || `Error ${response.status}`);
        err.status = response.status;
        throw err;
      }
      return await response.json();
    };
    const url = `${GESTION_API_BASE}${path}`;
    try {
      return await doFetch(url);
    } catch (error) {
      if (error?.status === 401) {
        throw error;
      }
      if (GESTION_API_BASE !== `${GESTION_API_FALLBACK}`) {
        const fallbackUrl = `${GESTION_API_FALLBACK}${path}`;
        const data = await doFetch(fallbackUrl);
        GESTION_API_BASE = GESTION_API_FALLBACK;
        return data;
      }
      throw error;
    }
  };

  const deserializeComidas = (input) => {
    if (!Array.isArray(input)) return [...REQUIRED_MEALS, ...OPTIONAL_MEALS].map((nombre) => buildEmptyMeal(nombre));
    return input.map((item) => {
      const meal = {
        nombre: item.nombre || "Comida",
        hora: item.hora || "",
        items: Array.isArray(item.items) ? item.items : [],
        macros: item.macros || emptyMacros(),
        empty: !item.items || item.items.length === 0,
      };
      return recalcMealMacros(meal);
    });
  };

  const hydratePlanFromDieta = (data) => {
    if (!data) return;
    const parsedDescripcion = safeParseJson(data.descripcion);
    const descFechaInicio = parsedDescripcion?.fecha_inicio ?? parsedDescripcion?.fechaInicio ?? null;
    const descFechaFin = parsedDescripcion?.fecha_fin ?? parsedDescripcion?.fechaFin ?? null;
    planState.id = data.id ?? planState.id;
    if (planState.id) setLastDietaId(planState.id);
    planState.nombre = data.nombre || planState.nombre || "Plantilla en blanco";
    planState.objetivoCalorias = data.calorias_objetivo || 0;
    planState.notas = data.notas || "";
    planState.notasPaciente = data.notas || "";
    planState.comentarioInterno = "";
    planState.esPlantilla = data.es_plantilla !== false;
    planState.pacienteBase = data.paciente_id || null;
    planState.fechaInicio = descFechaInicio ?? data.fecha_inicio ?? null;
    planState.fechaFin = descFechaFin ?? data.fecha_fin ?? null;
    if (selectors.dietaFechaInicio) selectors.dietaFechaInicio.value = planState.fechaInicio ? String(planState.fechaInicio).slice(0, 10) : "";
    if (selectors.dietaFechaFin) selectors.dietaFechaFin.value = planState.fechaFin ? String(planState.fechaFin).slice(0, 10) : "";
    planState.asignadoA = data.paciente_id || planState.asignadoA || null;
    planState.asignadoLabel = getPacienteLabel(planState.asignadoA) || planState.asignadoA || planState.asignadoLabel || "";
    if (Array.isArray(data.asignaciones) && data.asignaciones.length) {
      const asignacion = data.asignaciones[0];
      planState.asignadoA = asignacion.paciente_id || asignacion.pacienteId || null;
      planState.asignadoLabel = getPacienteLabel(planState.asignadoA) || planState.asignadoA || "";
    }
    if (planState.asignadoA) {
      setLastAssignedId(planState.id);
    }
    if (Array.isArray(data.recetas) && data.recetas.length) {
      planState.comidas = mapDietRecetasToMeals(data.recetas);
    } else {
      const parsed = safeParseJson(data.descripcion);
      if (parsed?.comidas) {
        planState.comidas = deserializeComidas(parsed.comidas);
      }
      if (parsed?.comentarioInterno) {
        planState.comentarioInterno = parsed.comentarioInterno;
      }
    }
    if (selectors.dietaNotasPaciente) selectors.dietaNotasPaciente.value = planState.notasPaciente || "";
    if (selectors.dietaComentarioInterno) selectors.dietaComentarioInterno.value = planState.comentarioInterno || "";
    renderPlan();
  };

  const buildDietaPayload = () => ({
    nombre: planState.nombre || "Plantilla rapida",
    es_plantilla: planState.esPlantilla !== false,
    usuario_id: resolveCurrentUserId(),
    actor_usuario_id: resolveCurrentUserId(),
    paciente_id: planState.esPlantilla === false ? planState.asignadoA || planState.pacienteBase || null : null,
    estado: planState.esPlantilla === false ? "publicada" : "borrador",
    activa: planState.esPlantilla === false ? true : undefined,
    notas: planState.notas || "",
    descripcion: JSON.stringify({
      comidas: planState.comidas || [],
      comentarioInterno: planState.comentarioInterno || "",
      fecha_inicio: planState.fechaInicio || null,
      fechaInicio: planState.fechaInicio || null,
      fecha_fin: planState.fechaFin || null,
      fechaFin: planState.fechaFin || null,
      notas_paciente: planState.notasPaciente || ""
    }),
    calorias_objetivo: planState.objetivoCalorias || 0,
    fecha_inicio: planState.fechaInicio || null,
    fechaInicio: planState.fechaInicio || null,
    fecha_fin: planState.fechaFin || null,
    fechaFin: planState.fechaFin || null,
    recetas: buildDietaRecetasPayload(planState.comidas || []),
  });

  const resetPlanState = () => {
    planState = cloneEmptyPlan();
    planState.asignadoA = null;
    planState.asignadoLabel = "";
    planState.esPlantilla = true;
    planState.pacienteBase = null;
    setLastDietaId(null);
    renderPlan();
  };

  const persistPlanChanges = async (reason = "") => {
    const ok = await ensureDietaId();
    if (!ok) {
      showToast("No se pudo obtener el ID de la dieta para guardar los cambios.");
      return false;
    }
    try {
      const recetasPayload = await syncMealsRecetas(planState.comidas || []);
      planState.recetasPayload = recetasPayload;
      const payload = buildDietaPayload();
      payload.recetas = recetasPayload;
      await putJson(`/dietas/${planState.id}`, payload);
      return true;
    } catch (error) {
      showToast(error.message || "No se pudieron guardar los cambios del plan.");
      return false;
    }
  };

  const sendGestionJson = async (method, path, payload) => {
    const doFetch = async (fullUrl) => {
      const resp = await fetch(fullUrl, {
        method,
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: payload ? JSON.stringify(payload) : null,
      });
      if (!resp.ok) {
        const text = await resp.text();
        const err = new Error(text || `Error ${resp.status}`);
        err.status = resp.status;
        throw err;
      }
      if (resp.status === 204) return {};
      return resp.json().catch(() => ({}));
    };
    const primary = `${GESTION_API_BASE}${path}`;
    const fallback = `${GESTION_API_FALLBACK}${path}`;
    try {
      return await doFetch(primary);
    } catch (error) {
      if (`${GESTION_API_BASE}` !== `${GESTION_API_FALLBACK}`) {
        return doFetch(fallback);
      }
      throw error;
    }
  };
  const saveTemplateCore = async () => {
    const normalizeDateInput = (raw) => {
      if (!raw) return null;
      const value = String(raw).trim();
      if (!value) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy;
        return `${yyyy}-${mm}-${dd}`;
      }
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
      return null;
    };
    const readValue = (primary, fallback = null) => {
      const raw = primary?.value ?? fallback?.value ?? "";
      return (raw || "").trim();
    };
    planState.fechaInicio = normalizeDateInput(readValue(selectors.saveMetaFechaInicio, selectors.dietaFechaInicio));
    planState.fechaFin = normalizeDateInput(readValue(selectors.saveMetaFechaFin, selectors.dietaFechaFin));
    const notasPaciente = readValue(selectors.saveMetaNotasPaciente, selectors.dietaNotasPaciente);
    planState.notas = notasPaciente;
    planState.notasPaciente = notasPaciente;
    planState.comentarioInterno = readValue(selectors.saveMetaComentarioInterno, selectors.dietaComentarioInterno);
    const recetasPayload = await syncMealsRecetas(planState.comidas || []);
    planState.recetasPayload = recetasPayload;
    const payload = buildDietaPayload();
    payload.recetas = recetasPayload;
    console.log("Guardando dieta con payload:", payload);
    const originalText = selectors.savePlanBtn ? selectors.savePlanBtn.textContent : null;
    if (selectors.savePlanBtn) {
      selectors.savePlanBtn.disabled = true;
      selectors.savePlanBtn.textContent = "Guardando...";
    }
    try {
      let saved;
      if (planState.id) {
        saved = await putJson(`/dietas/${planState.id}`, payload);
      } else {
        saved = await postJson("/dietas", payload);
      }
      if (saved?.id) {
        planState.id = saved.id;
        planState.nombre = saved.nombre || payload.nombre;
      }
      // Refresca desde backend para asegurar que las fechas/macros reflejen lo que persiste el servicio.
      await loadPlanFromBackend();
      showToast("Plantilla guardada en la base de datos.");
      loadDietas();
    } catch (error) {
      showToast(error.message || "No pudimos guardar la plantilla.");
    } finally {
      if (selectors.savePlanBtn) {
        selectors.savePlanBtn.disabled = false;
        selectors.savePlanBtn.textContent = originalText || "Guardar cambios";
      }
    }
  };

  const loadPlanFromBackend = async () => {
    if (!planState.id) return;
    try {
      const data = await fetchJson(`/dietas/${planState.id}`);
      hydratePlanFromDieta(data);
      if (data?.id) {
        setLastDietaId(data.id);
        if (data.es_plantilla === false || data.paciente_id) {
          setLastAssignedId(data.id);
        }
      }
    } catch (error) {
      const message = (error?.message || "").toLowerCase();
      if (error?.status === 404 || message.includes("no encontrada")) {
        planState = cloneEmptyPlan();
        setLastDietaId(null);
      } else {
        showToast(error.message || "No pudimos cargar la plantilla guardada.");
      }
      renderPlan();
    }
  };

  const dedupeDietas = (items) => {
    if (!Array.isArray(items)) return [];
    const map = new Map();
    items.forEach((item) => {
      if (!item) return;
      const idKey = item.id ?? item.dieta_id;
      const nameKey = (item.nombre || "").trim().toLowerCase();
      const pacienteKey = (item.paciente_id || "").trim().toLowerCase();
      const key = idKey !== undefined && idKey !== null ? `id:${idKey}` : `name:${nameKey}|pac:${pacienteKey}|tpl:${item.es_plantilla ? "1" : "0"}`;
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  };

  const dedupePlantillasByNombre = (items) => {
    if (!Array.isArray(items)) return [];
    const map = new Map();
    items.forEach((item) => {
      if (!item || item.es_plantilla === false) return;
      const key = (item.nombre || "").trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  };

  const collapseDietasByNombre = (items, currentId) => {
    if (!Array.isArray(items)) return [];
    const map = new Map();
    const normId = currentId ? String(currentId) : null;
    const priority = (item) => {
      if (normId && String(item?.id) === normId) return 0; 
      if (item && item.es_plantilla === false) return 1; 
      return 2; 
    };
    items.forEach((item) => {
      if (!item) return;
      const key = (item.nombre || "").trim().toLowerCase();
      if (!key) return;
      const current = map.get(key);
      if (!current || priority(item) < priority(current)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  };

  const includeExtraDieta = async (id) => {
    const key = String(id || "");
    if (!key) return;
    if (state.dietas.some((d) => String(d.id) === key)) return;
    try {
      const extra = await fetchJson(`/dietas/${key}`);
      if (extra?.id) {
        state.dietas.unshift(extra);
      }
    } catch (err) {
      console.warn("No se pudo recuperar la dieta adicional:", err);
    }
  };

  const loadPlanForPaciente = async (pacienteIdRaw) => {
    const pacienteId = (pacienteIdRaw || "").trim();
    if (!pacienteId) return false;
    try {
      const params = new URLSearchParams({ paciente_id: pacienteId, solo_actuales: "true" });
      const data = await fetchJson(`/dietas?${params.toString()}`);
      const dietas = Array.isArray(data) ? data : [];
      if (!dietas.length) {
        return false;
      }
      const dieta = dietas[0];
      planState.id = dieta.id;
      setLastDietaId(dieta.id);
      setLastAssignedId(dieta.id);
      hydratePlanFromDieta(dieta);
      return true;
    } catch (error) {
      console.warn("No se pudo cargar la dieta del paciente:", error);
      return false;
    }
  };

  const registerHistorialAsignacion = async (pacienteId, pacienteLabel, dietaId, dietaNombre, fechaInicio, fechaFin) => {
    if (!pacienteId) return null;
    const rango = fechaInicio || fechaFin ? ` (${fechaInicio || "sin inicio"} - ${fechaFin || "sin fin"})` : "";
    const observaciones = `Asignación de dieta "${dietaNombre || dietaId || ""}" a ${pacienteLabel || pacienteId}${rango}.`;
    const body = {
      idPaciente: pacienteId,
      idUsuario: resolveCurrentUserId(),
      idCita: null,
      observaciones,
      fechaActualizacion: new Date().toISOString(),
    };
    try {
      return await sendGestionJson("POST", "/historiales", body);
    } catch (error) {
      console.warn("No se pudo registrar el historial de asignación:", error);
      return null;
    }
  };
  const deleteCurrentDieta = async () => {
    const ok = await ensureDietaId();
    if (!ok || !planState.id) {
      showToast("No hay una dieta seleccionada para borrar.");
      return;
    }
    const dieta = state.dietas.find((d) => String(d.id) === String(planState.id));
    const nombre = dieta?.nombre || "dieta";
    if (selectors.deleteDietaText) selectors.deleteDietaText.textContent = `¿Borrar "${nombre}"? Esta acción no se puede deshacer.`;
    if (selectors.deleteDietaModal) {
      selectors.deleteDietaModal.hidden = false;
      selectors.deleteDietaModal.classList.add("is-open");
    }
  };

  const performDeleteDieta = async () => {
    if (!planState.id) return;
    const dieta = state.dietas.find((d) => String(d.id) === String(planState.id));
    const nombre = dieta?.nombre || "dieta";
    try {
      await sendJson("DELETE", `/dietas/${planState.id}`);
      state.dietas = state.dietas.filter((d) => String(d.id) !== String(planState.id));
      renderDietasList(state.dietas);
      if (state.dietas.length) {
        const next = state.dietas[0];
        planState = cloneEmptyPlan();
        planState.id = next.id;
        hydratePlanFromDieta(next);
      } else {
        resetPlanState();
        planState.id = null;
      }
      showToast(`Dieta borrada: ${nombre}.`);
      setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      showToast(error.message || "No se pudo borrar la dieta.");
    } finally {
      if (selectors.deleteDietaModal) {
        selectors.deleteDietaModal.classList.remove("is-open");
        selectors.deleteDietaModal.hidden = true;
      }
    }
  };

  const updateStats = () => {
    if (selectors.statPlantillas) {
      selectors.statPlantillas.textContent = state.dietas.filter((d) => d.es_plantilla).length || "0";
    }
    if (selectors.statDietasActivas) {
      // Dietas activas: planes asignados a paciente (no plantillas).
      selectors.statDietasActivas.textContent =
        state.dietas.filter((d) => !d.es_plantilla && d.paciente_id).length || "0";
    }
    if (selectors.statPacientes) {
      const unique = new Set(state.dietas.map((d) => d.paciente_id).filter(Boolean));
      selectors.statPacientes.textContent = unique.size || "0";
    }
  };

  const renderDietDetail = (dieta) => {
    if (!selectors.dietDetail) return;
    if (!dieta) {
      selectors.dietDetail.innerHTML = "";
      selectors.dietDetail.dataset.empty = "Selecciona una plantilla para ver el detalle.";
      return;
    }
    delete selectors.dietDetail.dataset.empty;
    const parsed = safeParseJson(dieta.descripcion);
    const comidas = parsed?.comidas || [];
    const asignaciones = dieta.asignaciones || [];
    selectors.dietDetail.innerHTML = `
      <div class="dieta-card__header">
        <div class="dieta-card__title-block">
          <h3>${dieta.nombre || "Plantilla sin nombre"}</h3>
          <div class="dieta-card__summary">
            <span><strong>${dieta.calorias_objetivo ?? 0}</strong> kcal objetivo</span>
            <span>${comidas.length} comidas</span>
            <span>Version ${dieta.version || 1}</span>
          </div>
        </div>
        <div class="dieta-card__badge-stack">
          ${dieta.es_plantilla ? '<span class="badge soft">Plantilla</span>' : ""}
          ${dieta.activa ? '<span class="badge success">Activa</span>' : '<span class="badge muted">Inactiva</span>'}
        </div>
      </div>
        ${dieta.objetivo ? `<p class="dieta-card__description">${dieta.objetivo}</p>` : ""}
        ${dieta.notas ? `<div class="dieta-card__note">${dieta.notas}</div>` : ""}
        <div class="dieta-card__totals">
          <span>${asignaciones.length} asignaciones</span>
          ${dieta.paciente_id ? `<span>Paciente base: ${dieta.paciente_id}</span>` : "<span>Sin paciente base</span>"}
        </div>
        <div class="dieta-card__actions">
          <button type="button" class="btn" data-action="save-current-template">Guardar cambios</button>
          <button type="button" class="btn" data-action="load-current-template">Cargar en plan</button>
        </div>
      `;
    };

  const renderDietasList = (dietas) => {
    const container = selectors.dietList;
    const picker = selectors.templatePicker;
    if (!container && !picker) return;
    if (container) container.innerHTML = "";
    if (picker) {
      picker.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = dietas && dietas.length ? "Selecciona una dieta" : "Añade una dieta";
      placeholder.selected = true;
      placeholder.disabled = false;
      picker.appendChild(placeholder);
    }
    if (!dietas || !dietas.length) {
      if (container) container.dataset.empty = "No hay dietas. Crea una nueva para empezar.";
      if (picker) {
        picker.dataset.empty = "true";
      }
      return;
    }
    if (container) delete container.dataset.empty;
    if (picker) {
      delete picker.dataset.empty;
    }
    dietas.forEach((dieta) => {
      if (container) {
        const card = document.createElement("article");
        card.className = "dieta-card";
        card.dataset.dietaId = dieta.id;
        card.innerHTML = `
          <div class="dieta-card__header">
            <div class="dieta-card__title-block">
              <h4>${dieta.nombre || "Plantilla sin nombre"}</h4>
              <div class="dieta-card__summary">
                <span><strong>${dieta.calorias_objetivo ?? 0}</strong> kcal</span>
                <span>V${dieta.version || 1}</span>
              </div>
            </div>
            <div class="dieta-card__badge-stack">
              ${dieta.activa ? '<span class="badge success">Activa</span>' : '<span class="badge muted">Inactiva</span>'}
            </div>
          </div>
          ${dieta.objetivo ? `<p class="dieta-card__description">${dieta.objetivo}</p>` : ""}
          ${dieta.notas ? `<p class="dieta-card__note">${dieta.notas}</p>` : ""}
        `;
        container.appendChild(card);
      }
      if (picker) {
        const opt = document.createElement("option");
        opt.value = dieta.id;
        opt.textContent = dieta.nombre || `Plantilla ${dieta.id}`;
        picker.appendChild(opt);
      }
    });
  };

  const loadDietas = async () => {
    try {
      // Trae todas las dietas (plantillas y asignadas) para que el selector muestre el listado completo.
      const data = await fetchJson("/dietas");
      const fetched = dedupeDietas(Array.isArray(data) ? data : []);
      // Mezcla plantillas y asignadas; luego se colapsan por nombre priorizando la seleccionada/asignadas.
      state.dietas = fetched;

      // Incluye la dieta activa o la última asignada aunque no sea plantilla (clon para paciente).
      await includeExtraDieta(planState.id);
      const lastAssignedId = getLastAssignedId();
      if (lastAssignedId && String(lastAssignedId) !== String(planState.id)) {
        await includeExtraDieta(lastAssignedId);
      }

      const currentId = planState.id;
      if (currentId && !state.dietas.some((d) => String(d.id) === String(currentId))) {
        try {
          const current = await fetchJson(`/dietas/${currentId}`);
          if (current && current.id) {
            state.dietas.unshift(current);
          }
        } catch (err) {
          console.warn("No se pudo recuperar la dieta actual desde el backend:", err);
        }
      }

      state.dietas = collapseDietasByNombre(dedupeDietas(state.dietas), planState.id);

      renderDietasList(state.dietas);
      updateStats();
      if (planState.id) {
        await selectDiet(planState.id, false);
      } else {
        renderDietDetail(null);
      }
    } catch (error) {
      renderDietasList([]);
      showToast(error.message || "No se pudieron cargar las dietas.");
    }
  };

  const selectDiet = async (dietaId, hydrate = true) => {
    const id = String(dietaId);
    const dieta = state.dietas.find((d) => String(d.id) === id);
    if (!dieta) {
      return;
    }
    planState.id = dieta.id;
    planState.esPlantilla = dieta.es_plantilla !== false;
    planState.pacienteBase = dieta.paciente_id || null;
    setLastDietaId(planState.id);
    markIntroSeen();
    hideIntroOverlay();
    if (dieta.es_plantilla === false || dieta.paciente_id) {
      setLastAssignedId(dieta.id);
    }
    if (selectors.dietList) {
      selectors.dietList.querySelectorAll(".dieta-card").forEach((card) => card.classList.remove("is-active"));
      const card = selectors.dietList.querySelector(`[data-dieta-id="${dieta.id}"]`);
      if (card) card.classList.add("is-active");
    }
    if (selectors.templatePicker) {
      selectors.templatePicker.value = String(dieta.id);
    }
    if (hydrate) {
      try {
        const fresh = await fetchJson(`/dietas/${planState.id}`);
        hydratePlanFromDieta(fresh);
      } catch (error) {
        hydratePlanFromDieta(dieta);
      }
    } else {
      renderDietDetail(dieta);
    }
  };

  const renderRecetas = (items) => {
    const container = selectors.recetasList;
    if (!container) return;
    container.innerHTML = "";
    if (!items || items.length === 0) {
      setPlaceholder(container, "No se encontraron recetas registradas.");
      return;
    }
    items.forEach((item) => {
      const macros = (item && item.totales && item.totales.macros) || {};
      const calorias = macros.calorias ?? item.calorias_objetivo;
      const card = document.createElement("article");
      card.className = "receta-card";
      card.innerHTML = `
        <div class="receta-card__header">
          <h3>${item.nombre || "Receta sin nombre"}</h3>
          ${calorias ? `<span class="pill">${formatNumber(calorias)} kcal</span>` : ""}
        </div>
        <p class="receta-card__desc">${item.descripcion || "Sin descripcion disponible"}</p>
        <div class="macro-grid">
          <div><strong>Proteinas:</strong> ${formatNumber(macros.proteinas)}</div>
          <div><strong>Grasas:</strong> ${formatNumber(macros.grasas)}</div>
          <div><strong>Carbohidratos:</strong> ${formatNumber(macros.carbohidratos)}</div>
          <div><strong>Fibra:</strong> ${formatNumber(macros.fibra)}</div>
        </div>
        ${item.instrucciones ? `<p class="receta-card__notes">${item.instrucciones}</p>` : ""}
      `;
      container.appendChild(card);
    });
  };

  const buildGradient = (segments) => {
    const total = segments.reduce((acc, seg) => acc + (Number(seg.value) || 0), 0);
    if (!total) return "conic-gradient(#eef3ef 0deg 360deg)";
    let current = 0;
    const parts = segments.map((seg) => {
      const portion = ((Number(seg.value) || 0) / total) * 360;
      const start = current;
      const end = current + portion;
      current = end;
      return `${seg.color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${parts.join(", ")})`;
  };

  const renderPlanMeals = (plan) => {
    const requiredContainer = document.getElementById("dietPlanMealsRequired");
    const optionalContainer = document.getElementById("dietPlanMealsOptional");
    const objetivoLabel = document.getElementById("planCaloriasObjetivo");
    const notesBox = document.getElementById("planNotes");
    if (objetivoLabel) {
      objetivoLabel.textContent = `${formatNumber(plan.objetivoCalorias, 0)} kcal objetivo`;
    }
    if (notesBox) {
      notesBox.textContent = plan.notas || "Plantilla sin notas. Escribe indicaciones generales aqui.";
    }
    if (!requiredContainer || !optionalContainer) return;
    requiredContainer.innerHTML = "";
    optionalContainer.innerHTML = "";
    const mealsByName = new Map();
    (plan.comidas || []).forEach((meal) => mealsByName.set(meal.nombre, recalcMealMacros(meal)));
    const orderedMeals = [
      ...REQUIRED_MEALS.map((name) => mealsByName.get(name) || buildEmptyMeal(name)),
      ...OPTIONAL_MEALS.map((name) => mealsByName.get(name) || buildEmptyMeal(name)),
      ...plan.comidas.filter(
        (meal) => !REQUIRED_MEALS.includes(meal.nombre) && !OPTIONAL_MEALS.includes(meal.nombre)
      ),
    ];

    orderedMeals.forEach((meal) => {
      const mealItems = meal.items && meal.items.length ? meal.items : ["Sin alimentos agregados"];
      const mealCard = document.createElement("article");
      mealCard.className = `meal-card collapsed${meal.empty ? " optional" : ""}${OPTIONAL_MEALS.includes(meal.nombre) ? " optional" : ""}`;
      const summaryChips = `
        <div class="meal-summary">
          <span class="macro-chip energy mini"><span class="dot"></span>${formatNumber(meal.macros.energia)} kcal</span>
          <span class="macro-chip fat mini"><span class="dot"></span>${formatNumber(meal.macros.grasa)} g</span>
          <span class="macro-chip carbs mini"><span class="dot"></span>${formatNumber(meal.macros.carbohidratos)} g</span>
          <span class="macro-chip protein mini"><span class="dot"></span>${formatNumber(meal.macros.proteina)} g</span>
          <span class="macro-chip fiber mini"><span class="dot"></span>${formatNumber(meal.macros.fibra)} g</span>
        </div>
      `;
      const macroHtml = `
        <div class="macro-chips">
          <div class="macro-chip energy"><span class="dot"></span> ${formatNumber(meal.macros.energia)} kcal</div>
          <div class="macro-chip fat"><span class="dot"></span> ${formatNumber(meal.macros.grasa)} g</div>
          <div class="macro-chip carbs"><span class="dot"></span> ${formatNumber(meal.macros.carbohidratos)} g</div>
          <div class="macro-chip protein"><span class="dot"></span> ${formatNumber(meal.macros.proteina)} g</div>
          <div class="macro-chip fiber"><span class="dot"></span> ${formatNumber(meal.macros.fibra)} g</div>
        </div>
      `;
      mealCard.innerHTML = `
        <div class="meal-card__header" data-action="toggle-card" data-meal="${meal.nombre}">
          <div class="meal-card__title">
            <h3>${meal.nombre}</h3>
          </div>
          <div class="meal-card__actions">
            <button type="button" class="toggle-details" data-action="toggle" data-meal="${meal.nombre}">Ver</button>
          </div>
        </div>
        ${summaryChips}
        <div class="meal-details">
        <div class="meal-items">
          ${mealItems
            .map((item) => {
              const label = formatMealItemLabel(item);
              return `
            <div class="meal-item">
              <span class="meal-item__handle" aria-hidden="true"></span>
              <p class="meal-item__name">${label}</p>
              <div class="meal-item__actions">
                <button type="button" data-action="add-food" data-meal="${meal.nombre}">+</button>
                <button type="button" data-action="remove-food" data-meal="${meal.nombre}">Quitar</button>
              </div>
            </div>`;
            })
            .join("")}
          <button class="plan-add" type="button" data-action="add-food" data-meal="${meal.nombre}">Agregar nuevo alimento +</button>
        </div>
        ${macroHtml}
        </div>
      `;
      if (REQUIRED_MEALS.includes(meal.nombre)) {
        requiredContainer.appendChild(mealCard);
      } else {
        optionalContainer.appendChild(mealCard);
      }
    });
  };

  const renderPlanAnalysis = (plan) => {
    const analysis = document.getElementById("dietPlanAnalysis");
    if (!analysis) return;
    const macroSegments = [
      { key: "grasa", value: plan.resumen.grasa, color: macroColors.grasa },
      { key: "carbohidratos", value: plan.resumen.carbohidratos, color: macroColors.carbohidratos },
      { key: "proteina", value: plan.resumen.proteina, color: macroColors.proteina },
      { key: "fibra", value: plan.resumen.fibra, color: macroColors.fibra }
    ];
    const mainDonut = buildGradient(macroSegments);
    const assignedLabel = plan.asignadoLabel || plan.asignadoA || "";

    const macroBar = (label, key, actual, target, unidad) => {
      const pct = target ? Math.min(100, (Number(actual || 0) / target) * 100) : 100;
      const color = macroColors[key] || "var(--color-primary)";
      const targetLabel = target ? ` / ${formatNumber(target, 0)} ${unidad}` : "";
      return `
        <div class="macro-bar">
          <div class="macro-bar__header">
            <div class="macro-bar__label">
              <span class="macro-bar__dot" style="background:${color}"></span>
              <span>${label}</span>
            </div>
            <div class="macro-bar__value">${formatNumber(actual, key === "energia" ? 0 : 1)} ${unidad}${targetLabel}</div>
          </div>
          <div class="macro-bar__track">
            <span class="macro-bar__fill" style="--pct:${pct}%; background:${color}"></span>
          </div>
        </div>
      `;
    };

    const miniDonuts = plan.comidas
      .map((meal) => {
        const gradient = buildGradient([
          { value: meal.macros.carbohidratos, color: macroColors.carbohidratos },
          { value: meal.macros.proteina, color: macroColors.proteina },
          { value: meal.macros.grasa, color: macroColors.grasa },
          { value: meal.macros.fibra, color: macroColors.fibra }
        ]);
        return `
          <div class="mini-donut">
            <div class="mini-donut__chart" style="background:${gradient}"></div>
            <div class="mini-donut__label">${meal.nombre}</div>
          </div>
        `;
      })
      .join("");

    analysis.innerHTML = `
      <h3>Analisis global</h3>
      ${assignedLabel ? `<div class="analysis-meta"><span class="chip chip--ghost">Paciente: ${assignedLabel}</span></div>` : ""}
      <div class="analysis-group">
        <div class="macro-donut" style="background:${mainDonut}">
          <div class="macro-donut__center">
            <span>Energia</span>
            <strong>${formatNumber(plan.resumen.energia)}</strong>
            <small>kcal</small>
          </div>
        </div>
        <div class="mini-donuts">${miniDonuts}</div>
      </div>
      <div class="analysis-group">
        ${macroBar("Energia", "energia", plan.resumen.energia, plan.objetivoCalorias, "kcal")}
        ${macroBar("Grasa", "grasa", plan.resumen.grasa, plan.objetivosMacros.grasa, "g")}
        ${macroBar("Hidratos de carbono", "carbohidratos", plan.resumen.carbohidratos, plan.objetivosMacros.carbohidratos, "g")}
        ${macroBar("Proteina", "proteina", plan.resumen.proteina, plan.objetivosMacros.proteina, "g")}
        ${macroBar("Fibra", "fibra", plan.resumen.fibra, plan.objetivosMacros.fibra, "g")}
      </div>
    `;
  };

  const openMealDetailModal = (mealName) => {
    let meal = (planState.comidas || []).find((item) => item.nombre === mealName);
    if (!meal) {
      meal = buildEmptyMeal(mealName);
      planState.comidas = [...(planState.comidas || []), meal];
    }
    if (!selectors.mealDetailModal || !selectors.mealDetailBody || !selectors.mealDetailTitle) return;
    selectors.mealDetailTitle.textContent = meal.nombre || "Comida";
    selectors.mealDetailModal.dataset.meal = meal.nombre;
    const items = meal.items && meal.items.length ? meal.items : ["Sin alimentos agregados"];
    selectors.mealDetailBody.innerHTML = `
      <div class="meal-detail__macros">
        <span class="pill soft">Energia: ${formatNumber(meal.macros.energia)} kcal</span>
        <span class="pill soft">Grasa: ${formatNumber(meal.macros.grasa)} g</span>
        <span class="pill soft">Carbohidratos: ${formatNumber(meal.macros.carbohidratos)} g</span>
        <span class="pill soft">Proteina: ${formatNumber(meal.macros.proteina)} g</span>
        <span class="pill soft">Fibra: ${formatNumber(meal.macros.fibra)} g</span>
      </div>
      <div>
        <h4>Alimentos</h4>
        <ul class="meal-detail__items">
          ${items.map((it) => `<li>${formatMealItemLabel(it)}</li>`).join("")}
        </ul>
      </div>
      <div class="meal-detail__recipes">
        <label for="mealRecetaSelect">Usar receta guardada</label>
        <div class="inline-select">
          <select id="mealRecetaSelect" name="mealRecetaSelect">
            <option value="">Selecciona una receta</option>
          </select>
          <button type="button" class="btn ghost" data-action="apply-recipe" data-meal="${meal.nombre}">Cargar receta</button>
        </div>
      </div>
      <div class="dieta-card__actions">
        <button type="button" class="btn" data-action="add-food-modal" data-meal="${meal.nombre}">Añadir alimento</button>
        <button type="button" class="btn ghost" data-action="save-recipe" data-meal="${meal.nombre}">Guardar como receta</button>
      </div>
    `;
    ensureRecetasLoaded().then(populateMealRecetaSelect).catch(() => {});
    selectors.mealDetailModal.hidden = false;
    selectors.mealDetailModal.classList.add("is-open");
  };

  const sumMacros = (meals) => {
    return meals.reduce(
      (acc, meal) => {
        const macros = meal.macros || {};
        acc.energia += Number(macros.energia) || 0;
        acc.grasa += Number(macros.grasa) || 0;
        acc.carbohidratos += Number(macros.carbohidratos) || 0;
        acc.proteina += Number(macros.proteina) || 0;
        acc.fibra += Number(macros.fibra) || 0;
        return acc;
      },
      { energia: 0, grasa: 0, carbohidratos: 0, proteina: 0, fibra: 0 }
    );
  };

  const renderPlan = (plan = planState) => {
    const resumen = sumMacros(plan.comidas || []);
    plan.resumen = resumen;
    renderPlanMeals(plan);
    renderPlanAnalysis(plan);
  };

  const addFoodToMeal = (mealName) => {
    let meal = (planState.comidas || []).find((item) => item.nombre === mealName);
    if (!meal) {
      meal = buildEmptyMeal(mealName);
      planState.comidas = [...(planState.comidas || []), meal];
    }
    if (selectors.mealFoodModal && selectors.mealFoodSelect) {
      // Cierra el modal de detalle para evitar superposiciones y abre directamente el formulario de alimento
      if (selectors.mealDetailModal) {
        selectors.mealDetailModal.classList.remove("is-open");
        selectors.mealDetailModal.hidden = true;
      }
      selectors.mealFoodModal.hidden = false;
      selectors.mealFoodModal.classList.add("is-open");
      selectors.mealFoodModal.dataset.meal = mealName;
      populateMealFoodSelect();
      selectors.mealFoodFeedback.textContent = "";
      selectors.mealFoodSelect.focus();
      if (selectors.mealFoodCantidad) selectors.mealFoodCantidad.value = "100";
      if (selectors.mealFoodUnidad) selectors.mealFoodUnidad.value = "g";
      updateMealFoodPreview();
      updateAlimentoActionsState();
    } else {
      meal.items = meal.items || [];
      meal.items.push("Nuevo alimento pendiente de definir");
      renderPlan();
    }
  };

  const applyRecetaToMeal = async (mealName, recetaId) => {
    if (!recetaId) {
      setGlobalAlert("Selecciona una receta para cargarla en la comida.", "error");
      return;
    }
    const meal = (planState.comidas || []).find((item) => item.nombre === mealName);
    if (!meal) return;
    try {
      const receta = await fetchJson(`/recetas/${recetaId}`);
      meal.receta_id = receta.id;
      meal.receta_nombre = receta.nombre;
      const ingredientes = Array.isArray(receta.ingredientes) ? receta.ingredientes : [];
      meal.items = ingredientes.map((ing) => {
        const alimento = ing.alimento || {};
        const macros = computeMacrosFromAlimento(alimento, ing.cantidad || 0);
        return {
          alimento_id: alimento.id || ing.alimento_id,
          nombre: alimento.nombre || "Alimento",
          cantidad: Number(ing.cantidad) || 0,
          unidad: ing.unidad || alimento.unidad_base || "g",
          macros,
        };
      });
      recalcMealMacros(meal);
      meal.empty = false;
      renderPlan();
      setGlobalAlert(`Receta "${receta.nombre}" aplicada a ${meal.nombre}.`, "success");
      if (selectors.mealDetailModal) {
        selectors.mealDetailModal.classList.remove("is-open");
        selectors.mealDetailModal.hidden = true;
      }
    } catch (error) {
      setGlobalAlert(error?.message || "No se pudo cargar la receta seleccionada.", "error");
    }
  };

  const saveMealAsReceta = async (mealName) => {
    const meal = (planState.comidas || []).find((item) => item.nombre === mealName);
    if (!meal || !meal.items || !meal.items.length) {
      setGlobalAlert("Agrega al menos un alimento antes de guardar como receta.", "error");
      return;
    }
    const nombre = window.prompt("Nombre para la nueva receta:", meal.receta_nombre || meal.nombre || "Receta");
    if (!nombre) return;

    const ingredientes = meal.items
      .filter((it) => it.alimento_id)
      .map((it) => ({
        alimento_id: it.alimento_id,
        cantidad: it.cantidad || 0,
        unidad: it.unidad || "g",
        observaciones: it.nombre || "",
      }));

    if (!ingredientes.length) {
      setGlobalAlert("No se pueden guardar recetas sin alimentos válidos.", "error");
      return;
    }

    const payload = {
      nombre: nombre.trim(),
      descripcion: `Receta creada desde el plan para ${meal.nombre}`,
      calorias_objetivo: meal.macros?.energia || null,
      instrucciones: "",
      ingredientes,
    };
    try {
      const receta = await postJson("/recetas", payload);
      state.recetas = [receta, ...(state.recetas || [])];
      meal.receta_id = receta.id;
      meal.receta_nombre = receta.nombre;
      setGlobalAlert(`Receta "${receta.nombre}" guardada y vinculada a ${meal.nombre}.`, "success");
      populateMealRecetaSelect(state.recetas);
    } catch (error) {
      setGlobalAlert(error?.message || "No se pudo guardar la receta.", "error");
    }
  };

  const removeFoodFromMeal = (mealName) => {
    const meal = (planState.comidas || []).find((item) => item.nombre === mealName);
    if (!meal || !meal.items || !meal.items.length) return;
    meal.items.pop();
    recalcMealMacros(meal);
    renderPlan();
  };

  const showToast = (message) => {
    alert(message);
  };

  let alertTimer;
  const setGlobalAlert = (message = "", variant = "info") => {
    const alertNode = document.getElementById("globalAlert");
    if (!alertNode) {
      if (message) showToast(message);
      return;
    }
    clearTimeout(alertTimer);
    if (!message) {
      alertNode.hidden = true;
      alertNode.textContent = "";
      alertNode.className = "global-alert";
      return;
    }
    alertNode.textContent = message;
    alertNode.className = `global-alert global-alert--${variant}`;
    alertNode.hidden = false;
    if (variant !== "error") {
      alertTimer = setTimeout(() => {
        alertNode.hidden = true;
        alertNode.textContent = "";
        alertNode.className = "global-alert";
      }, 4200);
    }
  };

  const normalizePaciente = (paciente) => {
    if (!paciente || typeof paciente !== "object") return null;
    const id =
      paciente.id ||
      paciente._id ||
      paciente.idPaciente ||
      paciente.paciente_id ||
      paciente.pacienteId ||
      paciente.id_paciente ||
      paciente.documento ||
      paciente.numeroDocumento;
    if (!id) return null;
    const nombre = (paciente.nombre || paciente.nombrePaciente || paciente.paciente_nombre || "").trim();
    const apellidos = (paciente.apellidos || paciente.apellidosPaciente || paciente.paciente_apellidos || "").trim();
    const label = [nombre, apellidos].filter(Boolean).join(" ").trim() || `${id}`;
    return { id: String(id), label };
  };

  const getPacienteLabel = (id) => {
    if (!id) return "";
    const match = (state.pacientes || []).find((p) => String(p.id) === String(id));
    return match ? match.label : "";
  };

  const populatePacientesSelect = (loading = false) => {
    if (!selectors.assignPacienteId) return;
    const select = selectors.assignPacienteId;
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    if (loading) {
      placeholder.textContent = "Cargando pacientes...";
    } else if (state.pacientesLoaded && !state.pacientes.length) {
      placeholder.textContent = "No hay pacientes registrados";
    } else {
      placeholder.textContent = "Selecciona un paciente";
    }
    select.appendChild(placeholder);
    state.pacientes.forEach((paciente) => {
      const opt = document.createElement("option");
      opt.value = paciente.id;
      opt.textContent = paciente.label;
      select.appendChild(opt);
    });
  };

  const loadPacientes = async () => {
    if (state.pacientesLoading) return state.pacientes;
    state.pacientesLoading = true;
    populatePacientesSelect(true);
    try {
      const data = await fetchGestionJson("/pacientes?sort=nombrePaciente:asc");
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const seen = new Set();
      const normalized = [];
      items.forEach((item) => {
        const parsed = normalizePaciente(item);
        if (!parsed || seen.has(parsed.id)) return;
        seen.add(parsed.id);
        normalized.push(parsed);
      });
      normalized.sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
      state.pacientes = normalized;
      state.pacientesLoaded = true;
      if (planState.asignadoA) {
        planState.asignadoLabel = getPacienteLabel(planState.asignadoA) || planState.asignadoA;
      }
    } catch (error) {
      state.pacientes = [];
      state.pacientesLoaded = false;
      if (error?.status === 401) {
        showToast("Inicia sesion para cargar pacientes (401).");
      } else {
        showToast(error.message || "No se pudieron cargar los pacientes.");
      }
    } finally {
      state.pacientesLoading = false;
      populatePacientesSelect(false);
    }
    return state.pacientes;
  };

  const ensureDietaId = async () => {
    if (planState.id) return true;
    const params = new URLSearchParams(window.location.search);
    const dietaId = params.get("dietaId");
    if (dietaId) {
      planState.id = dietaId;
      setLastDietaId(dietaId);
      return true;
    }
    // No seleccionamos automáticamente ninguna dieta al entrar si no hay parámetro.
    return false;
  };

  const createDieta = async (nombre) => {
    if (!nombre) return null;
    const payload = {
      nombre,
      es_plantilla: true,
      usuario_id: DEFAULT_USER_ID,
    };
    try {
      const creada = await postJson("/dietas", payload);
      if (creada?.id) {
        planState.id = creada.id;
        setLastDietaId(creada.id);
        state.dietas.unshift(creada);
        populatePacientesSelect();
        showToast(`Dieta creada: ${creada.nombre}`);
        setTimeout(() => window.location.reload(), 300);
      }
      return creada;
    } catch (err) {
      showToast(err.message || "No se pudo crear la dieta.");
      return null;
    }
  };

  const applyAssignment = async (payload) => {
    const paciente = typeof payload === "object" && payload !== null ? payload.paciente_id || payload.pacienteId || payload.paciente : payload;
    if (!paciente) {
      showToast("Selecciona un paciente para asignar.");
      return;
    }
    planState.asignadoA = paciente;
    const selectedLabel = selectors.assignPacienteId?.selectedOptions?.[0]?.textContent?.trim();
    planState.asignadoLabel = getPacienteLabel(paciente) || selectedLabel || paciente;

    // Se asigna sin guardar automáticamente; el usuario debe usar "Guardar cambios" si desea registrar versiones.
    if (!planState.id) {
      setGlobalAlert(`Dieta asignada a ${planState.asignadoLabel} (local, sin ID de dieta).`, "success");
      return;
    }
    try {
      const body = {
        paciente_id: paciente,
        usuario_id: resolveCurrentUserId(),
      };
      if (payload && typeof payload === "object") {
      if (payload.fecha_inicio) body.fecha_inicio = payload.fecha_inicio;
      if (payload.fecha_fin) body.fecha_fin = payload.fecha_fin;
      if (payload.notas) body.notas = payload.notas;
      if (payload.comentario) body.comentario = payload.comentario;
    }
      const asignada = await postJson(`/dietas/${planState.id}/asignaciones`, body);
      registerHistorialAsignacion(
        planState.asignadoA,
        planState.asignadoLabel,
        asignada?.id || planState.id,
        asignada?.nombre || planState.nombre,
        payload?.fecha_inicio,
        payload?.fecha_fin
      ).catch(() => {});
      if (asignada?.id) {
        planState.id = asignada.id;
        hydratePlanFromDieta(asignada);
        setLastDietaId(asignada.id);
        setLastAssignedId(asignada.id);
      } else {
        // Guarda el ID de la dieta (clon asignado o existente) para recargarlo luego.
        setLastDietaId(planState.id);
        setLastAssignedId(planState.id);
      }
      setGlobalAlert(`Dieta asignada a ${planState.asignadoLabel}.`, "success");
      setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      showToast(error.message || "No se pudo asignar el plan.");
    }
  };

  const populateMealFoodSelect = () => {
    if (!selectors.mealFoodSelect) return;
    selectors.mealFoodSelect.innerHTML = "";
    if (!state.alimentos.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No hay alimentos cargados";
      selectors.mealFoodSelect.appendChild(opt);
      return;
    }
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecciona un alimento";
    selectors.mealFoodSelect.appendChild(placeholder);
    state.alimentos.forEach((alimento) => {
      const opt = document.createElement("option");
      opt.value = alimento.id || alimento.alimento_id || alimento.nombre || "";
      opt.textContent = alimento.nombre || "Alimento sin nombre";
      selectors.mealFoodSelect.appendChild(opt);
    });
    updateMealFoodPreview();
    updateAlimentoActionsState();
  };

  const renderAlimentos = (items) => {
    const container = selectors.alimentosList;
    if (!container) return;
    container.innerHTML = "";
    if (!items || items.length === 0) {
      setPlaceholder(container, "No se encontraron alimentos registrados.");
      return;
    }
    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "alimento-card";
      card.innerHTML = `
        <div class="alimento-card__header">
          <h3>${item.nombre || "Alimento sin nombre"}</h3>
          ${item.unidad_base ? `<span class="pill soft">${item.unidad_base}</span>` : ""}
        </div>
        <p class="alimento-card__desc">${item.descripcion || "Sin descripcion disponible"}</p>
        <div class="macro-grid">
          <div><strong>Calorias:</strong> ${formatNumber(item.calorias)} kcal</div>
          <div><strong>Proteinas:</strong> ${formatNumber(item.proteinas)}</div>
          <div><strong>Grasas:</strong> ${formatNumber(item.grasas)}</div>
          <div><strong>Carbohidratos:</strong> ${formatNumber(item.carbohidratos)}</div>
          <div><strong>Fibra:</strong> ${formatNumber(item.fibra)}</div>
        </div>
      `;
      container.appendChild(card);
    });
  };

  const findAlimentoByValue = (value) => {
    if (!value) return null;
    return state.alimentos.find(
      (item) =>
        String(item.id) === String(value) ||
        String(item.alimento_id) === String(value) ||
        (item.nombre && item.nombre === value)
    );
  };

  const deleteAlimento = async () => {
    const value = selectors.mealFoodSelect?.value || "";
    if (!value) {
      showToast("Selecciona un alimento para borrar.");
      return;
    }
    const alimento = findAlimentoByValue(value);
    if (!alimento) {
      showToast("No encontramos el alimento seleccionado.");
      return;
    }
    const ok = window.confirm(`¿Borrar "${alimento.nombre}" del catálogo?`);
    if (!ok) return;
    try {
      await sendJson("DELETE", `/alimentos/${alimento.id}`);
      state.alimentos = state.alimentos.filter((item) => String(item.id) !== String(alimento.id));
      populateMealFoodSelect();
      if (selectors.mealFoodSelect) {
        selectors.mealFoodSelect.value = "";
        updateMealFoodPreview();
      }
      showToast("Alimento eliminado.");
    } catch (error) {
      showToast(error.message || "No se pudo borrar el alimento.");
    }
  };

  const computeMacrosFromAlimento = (alimento, cantidad) => {
    const factor = (Number(cantidad) || 0) / 100;
    return {
      energia: (Number(alimento.calorias) || 0) * factor,
      grasa: (Number(alimento.grasas) || 0) * factor,
      carbohidratos: (Number(alimento.carbohidratos) || 0) * factor,
      proteina: (Number(alimento.proteinas) || 0) * factor,
      fibra: (Number(alimento.fibra) || 0) * factor,
    };
  };

  const formatMealItemLabel = (item) => {
    if (!item) return "Sin alimentos agregados";
    if (typeof item === "string") return item;
    const cantidad = item.cantidad ? formatNumber(item.cantidad, 0) : "";
    const unidad = item.unidad ? ` ${item.unidad}` : "";
    return `${cantidad}${unidad} ${item.nombre || "Alimento"}`.trim();
  };

  const updateMealFoodPreview = () => {
    if (!selectors.mealFoodPreview || !selectors.mealFoodSelect) return;
    const value = selectors.mealFoodSelect.value;
    const cantidad = selectors.mealFoodCantidad?.value || 0;
    const alimento = findAlimentoByValue(value);
    if (!alimento) {
      selectors.mealFoodPreview.innerHTML = "<span class='pill soft'>Selecciona un alimento para ver macros</span>";
      return;
    }
    const macros = computeMacrosFromAlimento(alimento, cantidad);
    selectors.mealFoodPreview.innerHTML = `
      <div><strong>Energia:</strong> ${formatNumber(macros.energia)} kcal</div>
      <div><strong>Proteinas:</strong> ${formatNumber(macros.proteina, 1)} g</div>
      <div><strong>Grasas:</strong> ${formatNumber(macros.grasa, 1)} g</div>
      <div><strong>Carbohidratos:</strong> ${formatNumber(macros.carbohidratos, 1)} g</div>
      <div><strong>Fibra:</strong> ${formatNumber(macros.fibra, 1)} g</div>
    `;
    updateAlimentoActionsState();
  };

  const updateAlimentoActionsState = () => {
    const hasValue = Boolean(selectors.mealFoodSelect?.value);
    if (selectors.openEditarAlimento) selectors.openEditarAlimento.disabled = !hasValue;
    if (selectors.deleteAlimentoBtn) selectors.deleteAlimentoBtn.disabled = !hasValue;
  };

  const addToMealMacros = (meal, deltaMacros, sign = 1) => {
    if (!meal.macros) meal.macros = emptyMacros();
    const current = cloneMacros(meal.macros);
    meal.macros = {
      energia: current.energia + sign * (Number(deltaMacros.energia) || 0),
      grasa: current.grasa + sign * (Number(deltaMacros.grasa) || 0),
      carbohidratos: current.carbohidratos + sign * (Number(deltaMacros.carbohidratos) || 0),
      proteina: current.proteina + sign * (Number(deltaMacros.proteina) || 0),
      fibra: current.fibra + sign * (Number(deltaMacros.fibra) || 0),
    };
  };

  const recalcMealMacros = (meal) => {
    if (!meal) return meal;
    const totals = emptyMacros();
    (meal.items || []).forEach((item) => {
      if (item && typeof item === "object" && item.macros) {
        totals.energia += Number(item.macros.energia) || 0;
        totals.grasa += Number(item.macros.grasa) || 0;
        totals.carbohidratos += Number(item.macros.carbohidratos) || 0;
        totals.proteina += Number(item.macros.proteina) || 0;
        totals.fibra += Number(item.macros.fibra) || 0;
      }
    });
    meal.macros = totals;
    meal.empty = !(meal.items && meal.items.length);
    return meal;
  };

  const syncAlimentoInPlan = (alimento) => {
    if (!alimento || !planState?.comidas) return;
    let planUpdated = false;
    (planState.comidas || []).forEach((meal) => {
      if (!Array.isArray(meal.items) || !meal.items.length) return;
      let mealTouched = false;
      meal.items = meal.items.map((item) => {
        if (item && typeof item === "object" && String(item.alimento_id) === String(alimento.id || alimento.alimento_id)) {
          mealTouched = true;
          const cantidad = item.cantidad || 0;
          const unidad = item.unidad || alimento.unidad_base || "g";
          const macros = computeMacrosFromAlimento(alimento, cantidad);
          return { ...item, nombre: alimento.nombre || item.nombre, unidad, macros };
        }
        return item;
      });
      if (mealTouched) {
        planUpdated = true;
        recalcMealMacros(meal);
      }
    });
    if (planUpdated) {
      renderPlan();
    }
  };

  const mapDietRecetasToMeals = (dietaRecetas) => {
    return dietaRecetas.map((dr) => {
      const receta = dr.receta || {};
      const ingredientes = receta.ingredientes || [];
      const items = ingredientes.map((ing) => {
        const alimento = ing.alimento || {};
        const macros = computeMacrosFromAlimento(alimento, ing.cantidad);
        return {
          alimento_id: ing.alimento_id,
          nombre: alimento.nombre || `Alimento ${ing.alimento_id}`,
          cantidad: ing.cantidad,
          unidad: ing.unidad || alimento.unidad_base || "g",
          macros,
        };
      });
      const macros = receta.totales?.macros ? backendMacrosToEnergy(receta.totales.macros) : emptyMacros();
      const meal = {
        nombre: dr.momento || receta.nombre || "Comida",
        hora: "",
        items,
        macros,
        receta_id: receta.id || dr.receta_id,
      };
      return recalcMealMacros(meal);
    });
  };

  const createAlimento = async () => {
    if (!selectors.nuevoAlimentoNombre || !selectors.nuevoAlimentoCal || !selectors.nuevoAlimentoProt) return null;
    const nombre = selectors.nuevoAlimentoNombre.value.trim();
    const unidad_base = selectors.nuevoAlimentoUnidad?.value?.trim() || "g";
    const calorias = Number(selectors.nuevoAlimentoCal.value || 0);
    const proteinas = Number(selectors.nuevoAlimentoProt.value || 0);
    const grasas = Number(selectors.nuevoAlimentoGrasa?.value || 0);
    const carbohidratos = Number(selectors.nuevoAlimentoCarb?.value || 0);
    const fibra = Number(selectors.nuevoAlimentoFibra?.value || 0);
    const editingId = selectors.nuevoAlimentoForm?.dataset.editingId || state.alimentoEditId;
    const isEditing = Boolean(editingId);
    const existing = isEditing ? findAlimentoByValue(editingId) : null;
    if (!nombre || !calorias || !proteinas || !grasas || !carbohidratos) {
      if (selectors.nuevoAlimentoFeedback) selectors.nuevoAlimentoFeedback.textContent = "Completa nombre y macros base.";
      return null;
    }
    try {
      const payload = {
        nombre,
        unidad_base,
        calorias,
        proteinas,
        grasas,
        carbohidratos,
        fibra,
        descripcion: existing?.descripcion || "",
        micronutrientes: existing?.micronutrientes || {},
      };
      const saved = isEditing ? await putJson(`/alimentos/${editingId}`, payload) : await postJson("/alimentos", payload);
      if (saved?.id) {
        const idx = state.alimentos.findIndex((item) => String(item.id) === String(saved.id));
        if (idx >= 0) {
          state.alimentos[idx] = saved;
        } else {
          state.alimentos.unshift(saved);
        }
        if (selectors.alimentosList) {
          renderAlimentos(state.alimentos);
        }
        populateMealFoodSelect();
        if (selectors.mealFoodSelect) {
          selectors.mealFoodSelect.value = saved.id;
          updateMealFoodPreview();
        }
        syncAlimentoInPlan(saved);
        selectors.nuevoAlimentoModal?.classList.remove("is-open");
        if (selectors.nuevoAlimentoModal) selectors.nuevoAlimentoModal.hidden = true;
        if (selectors.nuevoAlimentoFeedback) selectors.nuevoAlimentoFeedback.textContent = "";
        if (selectors.nuevoAlimentoForm) {
          delete selectors.nuevoAlimentoForm.dataset.editingId;
        }
        state.alimentoEditId = null;
      }
      return saved;
    } catch (error) {
      if (selectors.nuevoAlimentoFeedback) {
        selectors.nuevoAlimentoFeedback.textContent =
          error.message || (isEditing ? "No se pudo actualizar el alimento." : "No se pudo crear el alimento.");
      }
      return null;
    }
  };

  const buildRecetaPayloadFromMeal = (meal) => {
    const ingredientesMap = new Map();
    (meal.items || [])
      .filter((item) => item && typeof item === "object" && item.alimento_id && item.cantidad)
      .forEach((item) => {
        const key = String(item.alimento_id);
        const cantidadNum = Number.parseFloat(item.cantidad);
        const cantidad = Number.isFinite(cantidadNum) ? cantidadNum : 0;
        if (!cantidad) return;
        const prev = ingredientesMap.get(key);
        const unidad = item.unidad || prev?.unidad || "g";
        if (prev) {
          prev.cantidad += cantidad;
          prev.unidad = prev.unidad || unidad;
        } else {
          ingredientesMap.set(key, {
            alimento_id: item.alimento_id,
            cantidad,
            unidad,
          });
        }
      });
    const ingredientes = Array.from(ingredientesMap.values()).filter((ing) => ing.cantidad > 0);
    if (!ingredientes.length) return null;
    return {
      nombre: meal.nombre || "Comida",
      descripcion: meal.notas || "",
      calorias_objetivo: meal.macros?.energia || null,
      ingredientes,
    };
  };

  const upsertRecetaForMeal = async (meal) => {
    const payload = buildRecetaPayloadFromMeal(meal);
    if (!payload) return null;
    try {
      if (meal.receta_id) {
        const updated = await putJson(`/recetas/${meal.receta_id}`, payload);
        return updated;
      }
      const created = await postJson("/recetas", payload);
      return created;
    } catch (error) {
      showToast(error.message || "No se pudo guardar la receta de la comida.");
      return null;
    }
  };

  const syncMealsRecetas = async (meals) => {
    const dietaRecetas = [];
    for (let index = 0; index < meals.length; index += 1) {
      const meal = meals[index];
      const receta = await upsertRecetaForMeal(meal);
      const recetaId = receta?.id || meal.receta_id;
      if (recetaId) {
        meal.receta_id = recetaId;
        dietaRecetas.push({
          receta_id: recetaId,
          momento: meal.nombre,
          orden: index,
          porciones: 1,
        });
      }
    }
    return dietaRecetas;
  };

  const buildDietaRecetasPayload = (meals) => {
    return meals
      .filter((meal) => meal && meal.receta_id)
      .map((meal, index) => ({
        receta_id: meal.receta_id,
        momento: meal.nombre,
        orden: index,
        porciones: 1,
      }));
  };

  const buildQuery = (basePath, query) => {
    const trimmed = (query || "").trim();
    if (!trimmed) return basePath;
    const encoded = encodeURIComponent(trimmed);
    return `${basePath}?buscar=${encoded}`;
  };

  const ensureRecetasLoaded = async () => {
    if (state.recetas && state.recetas.length) return state.recetas;
    const data = await fetchJson("/recetas");
    state.recetas = Array.isArray(data) ? data : [];
    return state.recetas;
  };

  const populateMealRecetaSelect = (recetas) => {
    const select = document.getElementById("mealRecetaSelect");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Selecciona una receta</option>`;
    recetas.forEach((receta) => {
      const opt = document.createElement("option");
      opt.value = receta.id || receta.receta_id || "";
      opt.textContent = receta.nombre || `Receta #${receta.id}`;
      select.appendChild(opt);
    });
    if (current) {
      select.value = current;
    }
  };

  const resolveAlimentoIdByName = async (name) => {
    const query = encodeURIComponent(name);
    const data = await fetchJson(`/alimentos?buscar=${query}`);
    const items = Array.isArray(data) ? data : [];
    const match = items.find(
      (a) => (a.nombre || "").toLowerCase().trim() === name.toLowerCase().trim()
    );
    return match ? match.id : items[0]?.id;
  };

  const ensureDefaultRecipes = async () => {
    if (!Array.isArray(state.recetas)) state.recetas = [];
    const existingNames = new Set(
      state.recetas.map((r) => (r.nombre || "").toLowerCase().trim())
    );
    const defaults = [
      {
        nombre: "Desayuno energetico",
        descripcion: "Avena con yogur y manzana fresca.",
        instrucciones: "Mezcla avena, yogur y agrega manzana en cubos.",
        ingredientes: [
          { alimento: "Avena integral", cantidad: 60, unidad: "g" },
          { alimento: "Yogur natural descremado", cantidad: 200, unidad: "g" },
          { alimento: "Manzana", cantidad: 120, unidad: "g" },
        ],
      },
      {
        nombre: "Bol de quinoa y pollo",
        descripcion: "Quinoa con pollo asado y ensalada verde.",
        instrucciones: "Quinoa base, pollo en tiras y ensalada verde encima.",
        ingredientes: [
          { alimento: "Quinoa cocida", cantidad: 180, unidad: "g" },
          { alimento: "Pechuga de pollo asada", cantidad: 130, unidad: "g" },
          { alimento: "Ensalada verde base", cantidad: 90, unidad: "g" },
        ],
      },
    ];

    const created = [];
    for (const rec of defaults) {
      if (existingNames.has(rec.nombre.toLowerCase())) continue;
      const ingredientes = [];
      let allResolved = true;
      for (const ing of rec.ingredientes) {
        const alimentoId = await resolveAlimentoIdByName(ing.alimento);
        if (!alimentoId) {
          allResolved = false;
          break;
        }
        ingredientes.push({
          alimento_id: alimentoId,
          cantidad: ing.cantidad,
          unidad: ing.unidad,
        });
      }
      if (!allResolved || !ingredientes.length) continue;
      try {
        const payload = {
          nombre: rec.nombre,
          descripcion: rec.descripcion,
          instrucciones: rec.instrucciones,
          ingredientes,
        };
        const nueva = await postJson("/recetas", payload);
        created.push(nueva);
      } catch {
        /* ignore */
      }
    }
    if (created.length) {
      state.recetas = [...created, ...state.recetas];
      populateMealRecetaSelect(state.recetas);
      renderRecetas(state.recetas);
    }
  };

  const loadRecetas = async () => {
    if (!selectors.recetasList) return;
    if (state.recetasLoading) return;
    state.recetasLoading = true;
    setPlaceholder(selectors.recetasList, "Cargando recetas...");
    const query = selectors.recetaSearch?.value || "";
    try {
      const data = await fetchJson(buildQuery("/recetas", query));
      const list = Array.isArray(data) ? data : [];
      const MEAL_NAMES = new Set(["desayuno", "comida", "cena", "almuerzo", "merienda"]);
      const empties = [];
      const valid = [];
      for (const rec of list) {
        const hasIngredientes = Array.isArray(rec.ingredientes) && rec.ingredientes.length > 0;
        const isMealName = MEAL_NAMES.has((rec.nombre || "").toLowerCase().trim());
        if (!hasIngredientes || isMealName) {
          if (rec.id) empties.push(rec);
          continue;
        }
        valid.push(rec);
      }
      // Limpia recetas vacías o con nombres de comida base
      for (const rec of empties) {
        deleteJson(`/recetas/${rec.id}`).catch(() => {});
      }
      state.recetas = valid;
      renderRecetas(valid);
      populateMealRecetaSelect(state.recetas);
      await ensureDefaultRecipes();
    } catch (error) {
      setPlaceholder(selectors.recetasList, error.message || "No pudimos cargar recetas.");
    } finally {
      state.recetasLoading = false;
    }
  };

  const loadAlimentos = async () => {
    if (state.alimentosLoading) return;
    state.alimentosLoading = true;
    if (selectors.alimentosList) {
      setPlaceholder(selectors.alimentosList, "Cargando alimentos...");
    }
    const query =
      selectors.alimentoSearch?.value ||
      "";
    try {
      const fetchAlimentos = () => fetchJson(buildQuery("/alimentos", query));
      let data = await fetchAlimentos();
      const shouldSyncBedca = (!data || data.length === 0) && !query.trim();

      if (shouldSyncBedca && !state.bedcaSyncAttempted) {
        state.bedcaSyncAttempted = true;
        if (selectors.alimentosList) {
          setPlaceholder(selectors.alimentosList, "Sincronizando catálogo de BEDCA...");
        }
        try {
          await postJson("/alimentos/bedca/sync");
          setGlobalAlert("Catálogo de alimentos actualizado desde BEDCA.", "success");
          data = await fetchAlimentos();
        } catch (syncError) {
          state.bedcaSyncAttempted = false;
          if (selectors.alimentosList) {
            setPlaceholder(selectors.alimentosList, syncError.message || "No pudimos sincronizar con BEDCA.");
          }
          throw syncError;
        }
      }

      state.alimentos = data || [];
      if (selectors.alimentosList) {
        renderAlimentos(data);
      }
      populateMealFoodSelect();
    } catch (error) {
      if (selectors.alimentosList) {
        setPlaceholder(selectors.alimentosList, error.message || "No pudimos cargar alimentos.");
      }
    } finally {
      state.alimentosLoading = false;
    }
  };


  const openNuevoAlimentoModal = (alimento = null) => {
    if (!selectors.nuevoAlimentoModal) return;
    const editingId = alimento?.id || alimento?.alimento_id || null;
    state.alimentoEditId = editingId || null;
    if (selectors.nuevoAlimentoForm) {
      if (editingId) {
        selectors.nuevoAlimentoForm.dataset.editingId = String(editingId);
      } else {
        delete selectors.nuevoAlimentoForm.dataset.editingId;
      }
    }
    const sourceAlimento = editingId ? findAlimentoByValue(editingId) || alimento : alimento;
    if (selectors.nuevoAlimentoTitle) selectors.nuevoAlimentoTitle.textContent = editingId ? "Editar alimento" : "Nuevo alimento";
    if (selectors.nuevoAlimentoSubmit) selectors.nuevoAlimentoSubmit.textContent = editingId ? "Actualizar alimento" : "Guardar alimento";
    if (selectors.nuevoAlimentoNombre) selectors.nuevoAlimentoNombre.value = sourceAlimento?.nombre || "";
    if (selectors.nuevoAlimentoUnidad) selectors.nuevoAlimentoUnidad.value = sourceAlimento?.unidad_base || "g";
    if (selectors.nuevoAlimentoCal) selectors.nuevoAlimentoCal.value = sourceAlimento?.calorias ?? "";
    if (selectors.nuevoAlimentoProt) selectors.nuevoAlimentoProt.value = sourceAlimento?.proteinas ?? "";
    if (selectors.nuevoAlimentoGrasa) selectors.nuevoAlimentoGrasa.value = sourceAlimento?.grasas ?? "";
    if (selectors.nuevoAlimentoCarb) selectors.nuevoAlimentoCarb.value = sourceAlimento?.carbohidratos ?? "";
    if (selectors.nuevoAlimentoFibra) selectors.nuevoAlimentoFibra.value = sourceAlimento?.fibra ?? "0";
    if (selectors.nuevoAlimentoFeedback) selectors.nuevoAlimentoFeedback.textContent = "";
    selectors.nuevoAlimentoModal.hidden = false;
    selectors.nuevoAlimentoModal.classList.add("is-open");
    selectors.nuevoAlimentoNombre?.focus();
  };

  const bindEvents = () => {
    const mealsContainer = document.querySelector(".diet-plan-grid");
    mealsContainer?.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      const mealName = target.dataset.meal;
      if (action === "add-food" && mealName) {
        addFoodToMeal(mealName);
      } else if (action === "remove-food" && mealName) {
        removeFoodFromMeal(mealName);
      } else if ((action === "toggle" || action === "toggle-card") && mealName) {
        openMealDetailModal(mealName);
      }
    });

    selectors.notesBox?.addEventListener("input", (e) => {
      planState.notas = e.target.textContent || "";
    });

    selectors.templatePicker?.addEventListener("change", async (e) => {
      const value = e.target.value;
      if (!value) return;
      await selectDiet(value, true);
    });

    selectors.refreshDietasBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      loadDietas();
    });

    selectors.dietList?.addEventListener("click", async (e) => {
      const card = e.target.closest("[data-dieta-id]");
      if (!card) return;
      const dietaId = card.dataset.dietaId;
      await selectDiet(dietaId, true);
    });

    selectors.dietDetail?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "save-current-template") {
        e.preventDefault();
        saveTemplate();
      } else if (action === "load-current-template") {
        e.preventDefault();
        if (planState.id) {
          await selectDiet(planState.id, true);
        }
      } else if (action === "add-food-modal") {
        e.preventDefault();
        const mealName = btn.dataset.meal || selectors.mealDetailModal?.dataset.meal;
        if (mealName) addFoodToMeal(mealName);
      }
    });

    selectors.mealDetailModal?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "add-food-modal") {
        e.preventDefault();
        const mealName = btn.dataset.meal || selectors.mealDetailModal?.dataset.meal;
        if (mealName) addFoodToMeal(mealName);
      } else if (action === "apply-recipe") {
        e.preventDefault();
        const mealName = btn.dataset.meal || selectors.mealDetailModal?.dataset.meal;
        const select = document.getElementById("mealRecetaSelect");
        const recetaId = select?.value || "";
        if (mealName) applyRecetaToMeal(mealName, recetaId);
      } else if (action === "save-recipe") {
        e.preventDefault();
        const mealName = btn.dataset.meal || selectors.mealDetailModal?.dataset.meal;
        if (mealName) saveMealAsReceta(mealName);
      }
    });

    selectors.mealFoodForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const mealName = selectors.mealFoodModal?.dataset.meal;
      const value = selectors.mealFoodSelect?.value || "";
      const cantidad = selectors.mealFoodCantidad?.value || "0";
      const unidad = selectors.mealFoodUnidad?.value || "g";
      if (!mealName || !value) {
        selectors.mealFoodFeedback.textContent = "Selecciona un alimento para agregar.";
        return;
      }
      const alimento = findAlimentoByValue(value);
      if (!alimento) {
        selectors.mealFoodFeedback.textContent = "No encontramos ese alimento. Intenta de nuevo.";
        return;
      }
      const meal = (planState.comidas || []).find((item) => item.nombre === mealName);
      if (!meal) return;
      meal.items = meal.items || [];
      const macros = computeMacrosFromAlimento(alimento, cantidad);
      meal.items.push({
        alimento_id: alimento.id || alimento.alimento_id,
        nombre: alimento.nombre || "Alimento",
        cantidad: Number(cantidad) || 0,
        unidad: unidad || alimento.unidad_base || "g",
        macros,
      });
      recalcMealMacros(meal);
      selectors.mealFoodModal.hidden = true;
      selectors.mealFoodModal.classList.remove("is-open");
      renderPlan();
    });

    selectors.mealFoodForm?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-alimento-action]");
      if (!btn) return;
      const action = btn.dataset.alimentoAction;
      if (action === "edit") {
        const value = selectors.mealFoodSelect?.value || "";
        const alimento = findAlimentoByValue(value);
        if (!alimento) {
          showToast("Selecciona un alimento para editar.");
          return;
        }
        openNuevoAlimentoModal(alimento);
      } else if (action === "delete") {
        deleteAlimento();
      }
    });

    selectors.mealFoodSelect?.addEventListener("change", updateMealFoodPreview);
    selectors.mealFoodCantidad?.addEventListener("input", updateMealFoodPreview);
    selectors.openNuevoAlimento?.addEventListener("click", (e) => {
      e.preventDefault();
      openNuevoAlimentoModal();
    });
    selectors.openEditarAlimento?.addEventListener("click", (e) => {
      e.preventDefault();
      const value = selectors.mealFoodSelect?.value || "";
      const alimento = findAlimentoByValue(value);
      if (!alimento) {
        showToast("Selecciona un alimento para editar.");
        return;
      }
      openNuevoAlimentoModal(alimento);
    });
    selectors.deleteAlimentoBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      deleteAlimento();
    });
    selectors.nuevoAlimentoForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await createAlimento();
    });

    document.querySelectorAll("[data-modal-close]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const targetId = e.currentTarget.getAttribute("data-modal-close");
        if (targetId) {
          const modal = document.getElementById(targetId);
          if (modal) {
            modal.classList.remove("is-open");
            modal.hidden = true;
          }
        }
      });
    });

  document.getElementById("assignPlanBtn")?.addEventListener("click", () => {
    ensureDietaId().then((ok) => {
      if (!ok) {
        showToast("No se pudo obtener el ID de la dieta para asignar.");
        return;
      }
      const openAssignModal = () => {
        if (selectors.assignModal) {
          selectors.assignModal.hidden = false;
          selectors.assignModal.classList.add("is-open");
          populatePacientesSelect();
          prepareAssignModal();
          // Oculta campos que ya se rellenan en "Guardar cambios"
          if (selectors.assignFechaInicio?.parentElement) selectors.assignFechaInicio.parentElement.style.display = "none";
          if (selectors.assignFechaFin?.parentElement) selectors.assignFechaFin.parentElement.style.display = "none";
          if (selectors.assignNotas) selectors.assignNotas.parentElement.style.display = "none";
          if (selectors.assignComentario) selectors.assignComentario.parentElement.style.display = "none";
        } else {
          const paciente = prompt("Introduce el ID o nombre del paciente a asignar:");
          if (paciente) applyAssignment({ paciente_id: paciente });
        }
      };
        loadPacientes().catch(() => {}).finally(openAssignModal);
      });
    });

    document.getElementById("analysisBtn")?.addEventListener("click", () => {
      if (selectors.analysisModal) {
    selectors.analysisModal.hidden = false;
    selectors.analysisModal.classList.add("is-open");
    renderPlanAnalysis(planState);
  }
});

selectors.savePlanBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  openSaveMetaModal();
});

    const openNuevaDietaModal = () => {
      if (!selectors.newDietaModal || !selectors.newDietaNombre) return;
      selectors.newDietaFeedback.textContent = "";
      selectors.newDietaNombre.value = "";
      selectors.newDietaModal.hidden = false;
      selectors.newDietaModal.classList.add("is-open");
      selectors.newDietaNombre.focus();
    };

    const closeNuevaDietaModal = () => {
      if (!selectors.newDietaModal) return;
      selectors.newDietaModal.classList.remove("is-open");
      selectors.newDietaModal.hidden = true;
    };

    selectors.newDietaBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      openNuevaDietaModal();
    });

    selectors.newDietaForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nombre = selectors.newDietaNombre?.value?.trim();
      if (!nombre) {
        if (selectors.newDietaFeedback) selectors.newDietaFeedback.textContent = "Introduce un nombre.";
        return;
      }
      createDieta(nombre);
      closeNuevaDietaModal();
    });

    selectors.newDietaModal?.addEventListener("click", (e) => {
      if (e.target.dataset?.modalClose === "nuevaDietaModal" || e.target === selectors.newDietaModal) {
        closeNuevaDietaModal();
      }
    });

    selectors.deleteDietaBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      deleteCurrentDieta();
    });
    selectors.confirmDeleteDietaBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      performDeleteDieta();
    });

    selectors.assignForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = selectors.assignPacienteId?.value || "";
      if (!value) {
        showToast("Selecciona un paciente para asignar.");
        return;
      }
      const payload = {
        paciente_id: value,
        fecha_inicio: selectors.assignFechaInicio?.value || undefined,
        fecha_fin: selectors.assignFechaFin?.value || undefined,
        notas: selectors.assignNotas?.value || undefined,
        comentario: selectors.assignComentario?.value || undefined,
      };
      if (payload.notas) {
        planState.notas = payload.notas;
        renderPlan();
      }
      planState.fechaInicio = payload.fecha_inicio || planState.fechaInicio;
      planState.fechaFin = payload.fecha_fin || planState.fechaFin;
      applyAssignment(payload);
      selectors.assignModal.classList.remove("is-open");
      selectors.assignModal.hidden = true;
    });

    selectors.refreshRecetas?.addEventListener("click", (e) => {
      e.preventDefault();
      loadRecetas();
    });
    selectors.refreshAlimentos?.addEventListener("click", (e) => {
      e.preventDefault();
      loadAlimentos();
    });
    selectors.recetaSearch?.addEventListener("change", loadRecetas);
    selectors.alimentoSearch?.addEventListener("change", loadAlimentos);

    const backBtn = document.getElementById("volverPanel");
    backBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "principal.html";
    });
  };


  const prepareAssignModal = () => {
    const pacienteSelect = selectors.assignPacienteId;
    if (!pacienteSelect) return;
    const wrapper = selectors.assignPacienteWrapper || pacienteSelect.parentElement;
    if (planState.asignadoA) {
      pacienteSelect.value = String(planState.asignadoA);
      pacienteSelect.disabled = true;
      if (wrapper) wrapper.style.display = "none";
    } else {
      pacienteSelect.disabled = false;
      pacienteSelect.value = "";
      if (wrapper) wrapper.style.display = "";
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const dietaId = params.get("dietaId");
    const pacienteId = params.get("pacienteId") || PACIENTE_PARAM;

    if (dietaId) {
      planState.id = dietaId;
    }

    const bootstrap = async () => {
      // Solo cargamos dieta si viene indicada por parámetro; no se autoselecciona ni por paciente.
      const ok = await ensureDietaId();
      if (ok) {
        await loadPlanFromBackend();
      }
    };

    bootstrap()
      .catch(() => {})
      .finally(() => {
        bindEvents();
        renderPlan();
        loadRecetas();
        loadAlimentos();
        loadPacientes();
        loadDietas();

        const shouldShowIntro =
          selectors.introOverlay && !introShown && !planState.id && cameFromEntryPage();
        if (shouldShowIntro) {
          document.body.classList.add("intro-blur");
          selectors.introOverlay.hidden = false;
          selectors.introOverlay.classList.add("is-open");
          introShown = true;
        } else {
          hideIntroOverlay();
        }
      });
  });

  selectors.introClose?.addEventListener("click", (e) => {
    e.preventDefault();
    if (selectors.introOverlay) {
      selectors.introOverlay.classList.remove("is-open");
      selectors.introOverlay.hidden = true;
    }
    introShown = true;
    document.body.classList.remove("intro-blur");
  });

  const openSaveMetaModal = () => {
    if (!selectors.saveMetaModal || !selectors.saveMetaForm) {
      // Fallback si no hay modal: guardar directamente.
      saveTemplateCore();
      return;
    }
    if (selectors.saveMetaFeedback) selectors.saveMetaFeedback.textContent = "";
    const fillValue = (input, value) => {
      if (input) input.value = value || "";
    };
    fillValue(selectors.saveMetaFechaInicio, planState.fechaInicio);
    fillValue(selectors.saveMetaFechaFin, planState.fechaFin);
    fillValue(selectors.saveMetaNotasPaciente, planState.notasPaciente);
    fillValue(selectors.saveMetaComentarioInterno, planState.comentarioInterno);
    fillValue(selectors.dietaFechaInicio, planState.fechaInicio);
    fillValue(selectors.dietaFechaFin, planState.fechaFin);
    fillValue(selectors.dietaNotasPaciente, planState.notasPaciente);
    fillValue(selectors.dietaComentarioInterno, planState.comentarioInterno);
    selectors.saveMetaModal.hidden = false;
    selectors.saveMetaModal.classList.add("is-open");
  };

  selectors.saveMetaForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveTemplateCore().finally(() => {
      selectors.saveMetaModal.classList.remove("is-open");
      selectors.saveMetaModal.hidden = true;
    });
  });

  Array.from(document.querySelectorAll("[data-modal-close=\"saveMetaModal\"]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      selectors.saveMetaModal?.classList.remove("is-open");
      if (selectors.saveMetaModal) selectors.saveMetaModal.hidden = true;
    });
  });
})();
