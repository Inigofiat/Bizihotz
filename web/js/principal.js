"use strict";

// Siempre a través del gateway (/gestion), tanto en local como desplegado.
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
const DEFAULT_AVATAR_URL = "../images/avatar-default.svg";
const CONVERSATION_TARGET_KEY = "bizihotzConversationTarget";

const dedupeValues = (items) => {
  const seen = new Set();
  return items
    .filter(Boolean)
    .map((item) => item.replace(/\/+$/, ""))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
};

const buildComunicacionBases = () => {
  const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
  const hostname = (window.location.hostname || "localhost").toLowerCase();
  const port = window.location.port;
  const isLocal = !hostname || hostname === "localhost" || hostname === "127.0.0.1";
  const targetHost = isLocal ? "localhost" : hostname;

  const gateway = [`${protocol}//${targetHost}:5000/comunicacion`];
  const direct = [`${protocol}//${targetHost}:4103`, `${protocol}//${targetHost}:4100`];

  return dedupeValues([...gateway, ...direct]);
};

const COMUNICACION_API_BASES = buildComunicacionBases().map((base) => `${base}/api`);

const CITA_ESTADOS = [
  {
    value: "Pendiente",
    slug: "pendiente",
    description: "Cita programada aún no iniciada."
  },
  {
    value: "Atendida",
    slug: "atendida",
    description: "Consulta realizada y cerrada."
  },
  {
    value: "Cancelada",
    slug: "cancelada",
    description: "La cita no se llevará a cabo."
  }
];

const estadoToSlug = (estado) => {
  const normalized = (estado || "").toString().trim().toLowerCase();
  if (!normalized) {
    return "pendiente";
  }
  const match = CITA_ESTADOS.find((item) => item.value.toLowerCase() === normalized);
  return match ? match.slug : normalized.replace(/\s+/g, "-");
};

const resolveCitaId = (cita) => {
  if (!cita) {
    return "";
  }
  if (typeof cita === "string") {
    return cita;
  }
  if (typeof cita._id === "object" && typeof cita._id.toString === "function") {
    const objectId = cita._id.toString();
    if (objectId) {
      return objectId;
    }
  }
  return (
    cita._id ||
    cita.id ||
    cita.idCita ||
    ""
  );
};

const resolvePacienteId = (cita = {}) => {
  const ref = cita.idPaciente;
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object") {
    return ref.idPaciente || ref._id || ref.id || null;
  }
  return null;
};

let statusMenu = null;
let statusMenuTrigger = null;

let usuarioActual = null;
let notificationDropdownOpen = false;
let notificationConversations = [];
let appointmentsClickHandlerBound = false;
const notificationRefs = {
  toggle: null,
  badge: null,
  dropdown: null,
  list: null,
  empty: null
};

const fetchComunicacion = async (path, options = {}) => {
  let lastError = null;
  for (const base of COMUNICACION_API_BASES) {
    try {
      const response = await fetch(`${base}${path}`, options);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Solicitud rechazada (${response.status})`);
      }
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No se pudo contactar con el microservicio de comunicación.");
};

const getUsuarioId = () => {
  if (!usuarioActual) {
    usuarioActual = getStoredUser();
  }
  if (!usuarioActual) {
    return null;
  }
  return (
    usuarioActual._id ||
    usuarioActual.id ||
    usuarioActual.idUsuario ||
    usuarioActual.usuarioId ||
    usuarioActual.userId ||
    usuarioActual.uid ||
    usuarioActual.ID ||
    null
  );
};

const openConversationFromDashboard = (conversationId) => {
  if (!conversationId) {
    return;
  }
  localStorage.setItem(CONVERSATION_TARGET_KEY, conversationId);
  closeDashboardNotifications();
  window.location.href = "mensajes.html";
};

const obtenerRangoDiaUTC = (fechaReferencia = new Date()) => {
  const inicio = new Date(
    fechaReferencia.getFullYear(),
    fechaReferencia.getMonth(),
    fechaReferencia.getDate(),
    0,
    0,
    0,
    0
  );
  const fin = new Date(
    fechaReferencia.getFullYear(),
    fechaReferencia.getMonth(),
    fechaReferencia.getDate(),
    23,
    59,
    59,
    999
  );
  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString()
  };
};

const updateDateTime = () => {
  const now = new Date();
  const dateNode = document.getElementById("date");
  const timeNode = document.getElementById("time");

  if (dateNode) {
    dateNode.textContent = now.toLocaleDateString("es-ES");
  }

  if (timeNode) {
    timeNode.textContent = now.toLocaleTimeString("es-ES", { hour12: false });
  }
};

setInterval(updateDateTime, 1000);
updateDateTime();

const actualizarUsuarioLocal = (parciales = {}) => {
  if (!usuarioActual) {
    return;
  }

  usuarioActual = { ...usuarioActual, ...parciales };
  localStorage.setItem("bizihotzUsuario", JSON.stringify(usuarioActual));
};

const getStoredUser = () => {
  const raw = localStorage.getItem("bizihotzUsuario");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("No se pudo interpretar el usuario guardado:", error);
    return null;
  }
};

const resolveTokenOrRedirect = () => {
  const stored = getStoredUser();
  const token =
    usuarioActual?.token ||
    usuarioActual?.accessToken ||
    usuarioActual?.authToken ||
    stored?.token ||
    stored?.accessToken ||
    stored?.authToken;
  if (!token) {
    localStorage.removeItem("bizihotzUsuario");
    window.location.href = LOGIN_PAGE;
    throw new Error("Sesion no valida. Necesitas iniciar sesion.");
  }
  return token;
};

const buildAuthHeaders = (baseHeaders = {}) => {
  const headers = Object.assign({ Accept: "application/json" }, baseHeaders || {});
  let token = null;
  try {
    token = resolveTokenOrRedirect();
  } catch (error) {
    console.warn(error?.message || "Sesion no valida");
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const buildAvatarSrc = (fotoPath) => {
  if (!fotoPath) {
    return DEFAULT_AVATAR_URL;
  }

  if (/^https?:\/\//i.test(fotoPath)) {
    return fotoPath;
  }

  const normalized = fotoPath.startsWith("/") ? fotoPath : `/${fotoPath}`;
  return `${API_BASE_URL}${normalized}`;
};

const ensureAvatarFallbackBinding = (imgNode) => {
  if (!imgNode || imgNode.dataset.avatarFallbackBound === "1") {
    return;
  }
  imgNode.dataset.avatarFallbackBound = "1";
  imgNode.addEventListener("error", () => {
    if (imgNode.dataset.avatarFallbackApplied === "1") {
      return;
    }
    imgNode.dataset.avatarFallbackApplied = "1";
    imgNode.src = DEFAULT_AVATAR_URL;
  });
};

const setAvatarImage = (imgNode, src) => {
  if (!imgNode) {
    return;
  }
  ensureAvatarFallbackBinding(imgNode);
  if (!src) {
    imgNode.dataset.avatarFallbackApplied = "1";
    imgNode.src = DEFAULT_AVATAR_URL;
    return;
  }
  if (imgNode.dataset.avatarFallbackApplied === "1" && src !== DEFAULT_AVATAR_URL) {
    delete imgNode.dataset.avatarFallbackApplied;
  }
  imgNode.src = src;
};

const removeStatusVariantClasses = (chip) => {
  if (!chip) {
    return;
  }
  Array.from(chip.classList)
    .filter((cls) => cls.startsWith("status-chip--"))
    .forEach((cls) => chip.classList.remove(cls));
};

const buildStatusChip = (citaId, estadoInicial) => {
  const estadoVisible = estadoInicial || "Pendiente";
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `status-chip status-chip--${estadoToSlug(estadoVisible)}`;
  chip.dataset.citaId = citaId || "";
  chip.dataset.status = estadoVisible;
  chip.setAttribute("aria-haspopup", "menu");
  chip.setAttribute("aria-expanded", "false");
  chip.setAttribute(
    "aria-label",
    `Estado de la cita: ${estadoVisible}. Selecciona para actualizar.`
  );
  chip.innerHTML = `
    <span class="status-chip__dot" aria-hidden="true"></span>
    <span class="status-chip__label">${estadoVisible}</span>
    <span class="status-chip__chevron" aria-hidden="true"></span>
  `;
  if (!citaId) {
    chip.disabled = true;
    chip.classList.add("status-chip--disabled");
    chip.removeAttribute("aria-haspopup");
    chip.removeAttribute("aria-expanded");
  }
  return chip;
};

const setStatusChipLoading = (chip, isLoading) => {
  if (!chip) {
    return;
  }
  if (isLoading) {
    chip.classList.add("is-loading");
    chip.setAttribute("aria-busy", "true");
    chip.disabled = true;
  } else {
    chip.classList.remove("is-loading");
    chip.removeAttribute("aria-busy");
    chip.disabled = false;
  }
};

const applyStatusChipState = (chip, estado) => {
  if (!chip) {
    return;
  }
  const visibleEstado = estado || "Pendiente";
  const slug = estadoToSlug(visibleEstado);
  removeStatusVariantClasses(chip);
  chip.classList.add("status-chip--" + slug);
  chip.dataset.status = visibleEstado;
  const label = chip.querySelector(".status-chip__label");
  if (label) {
    label.textContent = visibleEstado;
  }
  chip.setAttribute(
    "aria-label",
    `Estado de la cita: ${visibleEstado}. Selecciona para actualizar.`
  );
};

const ensureStatusMenu = () => {
  if (statusMenu) {
    return statusMenu;
  }
  const menu = document.createElement("div");
  menu.className = "status-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  menu.addEventListener("click", (event) => {
    const option = event.target.closest(".status-menu__option");
    if (!option) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const selectedValue = option.dataset.value;
    const trigger = statusMenuTrigger;
    const citaId = menu.dataset.citaId;
    closeStatusMenu();
    if (!trigger || !citaId) {
      return;
    }
    if (trigger.dataset.status === selectedValue) {
      trigger.focus();
      return;
    }
    updateAppointmentStatus(citaId, selectedValue, trigger);
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const trigger = statusMenuTrigger;
      closeStatusMenu();
      trigger?.focus();
    }
    if (event.key === "Tab") {
      closeStatusMenu();
    }
  });
  document.body.appendChild(menu);
  statusMenu = menu;
  return menu;
};

const positionStatusMenu = (menu, trigger) => {
  if (!menu || !trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const minWidth = Math.max(rect.width, 188);
  menu.style.minWidth = `${minWidth}px`;
  menu.hidden = false;
  menu.classList.add("is-open");
  const menuWidth = menu.offsetWidth;
  const viewportWidth = document.documentElement.clientWidth;
  const margin = 16;
  let left = scrollX + rect.left;
  const maxLeft = scrollX + viewportWidth - menuWidth - margin;
  if (left > maxLeft) {
    left = Math.max(maxLeft, margin + scrollX);
  }
  if (left < margin + scrollX) {
    left = margin + scrollX;
  }
  const top = scrollY + rect.bottom + 10;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  const arrowOffset = Math.min(
    Math.max(rect.left + rect.width / 2 - left, 12),
    menuWidth - 12
  );
  menu.style.setProperty("--status-menu-arrow-left", `${arrowOffset}px`);
};

const closeStatusMenu = () => {
  if (!statusMenu) {
    return;
  }
  statusMenu.classList.remove("is-open");
  statusMenu.hidden = true;
  statusMenu.removeAttribute("data-cita-id");
  statusMenu.removeAttribute("data-current-value");
  if (statusMenuTrigger) {
    statusMenuTrigger.setAttribute("aria-expanded", "false");
  }
  statusMenuTrigger = null;
};

const openStatusMenu = (trigger) => {
  if (!trigger || trigger.disabled || trigger.classList.contains("is-loading")) {
    return;
  }
  if (statusMenuTrigger && statusMenuTrigger !== trigger) {
    closeStatusMenu();
  }
  const menu = ensureStatusMenu();
  const currentValue = trigger.dataset.status || "Pendiente";
  const currentSlug = estadoToSlug(currentValue);
  menu.innerHTML = CITA_ESTADOS.map((estado) => {
    const isActive = estado.slug === currentSlug;
    return `
      <button type="button"
        class="status-menu__option${isActive ? " is-active" : ""}"
        data-value="${estado.value}"
        role="menuitemradio"
        aria-checked="${isActive ? "true" : "false"}">
        <span class="status-menu__label">${estado.value}</span>
        <span class="status-menu__hint">${estado.description}</span>
      </button>
    `;
  }).join("");
  menu.dataset.citaId = trigger.dataset.citaId || "";
  menu.dataset.currentValue = currentValue;
  statusMenuTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  positionStatusMenu(menu, trigger);
  requestAnimationFrame(() => {
    const activeOption =
      menu.querySelector(".status-menu__option.is-active") ||
      menu.querySelector(".status-menu__option");
    activeOption?.focus();
  });
};

const patchCitaEstado = async (citaId, nuevoEstado) => {
  const payload = { estado: nuevoEstado };
  const endpoints = [`${API_URL}/citas/${citaId}`];
  if (API_FALLBACK) {
    endpoints.push(`${API_FALLBACK}/citas/${citaId}`);
  }
  let lastError = null;
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: buildAuthHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.mensaje || `No se pudo actualizar la cita (HTTP ${response.status}).`;
        throw new Error(message);
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No se pudo actualizar la cita.");
};

const updateAppointmentStatus = async (citaId, nuevoEstado, trigger) => {
  if (!citaId || !trigger) {
    return;
  }
  const estadoAnterior = trigger.dataset.status || "Pendiente";
  if (estadoAnterior === nuevoEstado) {
    return;
  }
  setStatusChipLoading(trigger, true);
  try {
    const respuesta = await patchCitaEstado(citaId, nuevoEstado);
    const estadoFinal = respuesta?.estado || nuevoEstado;
    applyStatusChipState(trigger, estadoFinal);
  } catch (error) {
    console.error("No se pudo actualizar el estado de la cita:", error);
    applyStatusChipState(trigger, estadoAnterior);
    alert(error.message || "No se pudo actualizar el estado de la cita.");
  } finally {
    setStatusChipLoading(trigger, false);
    trigger.focus();
  }
};

const handleDocumentClick = (event) => {
  if (statusMenu && statusMenu.contains(event.target)) {
    return;
  }
  const trigger = event.target.closest(".status-chip");
  if (trigger) {
    event.preventDefault();
    if (statusMenuTrigger === trigger && statusMenu?.classList.contains("is-open")) {
      closeStatusMenu();
    } else {
      openStatusMenu(trigger);
    }
    return;
  }
  closeStatusMenu();

  if (notificationDropdownOpen && !event.target.closest(".notification-center")) {
    closeDashboardNotifications();
  }
};

const handleGlobalKeydown = (event) => {
  if (event.key === "Escape") {
    const trigger = statusMenuTrigger;
    closeStatusMenu();
    trigger?.focus();
    if (notificationDropdownOpen) {
      closeDashboardNotifications();
    }
  }
};

const handleGlobalScroll = () => {
  closeStatusMenu();
};

const getConversationRecipient = (conversation) => {
  if (!conversation || !Array.isArray(conversation.participants)) {
    const alt = conversation.participantes;
    if (!Array.isArray(alt)) return null;
    conversation.participants = alt;
  }
  const userId = getUsuarioId();
  if (!userId) {
    return conversation.participants[0] || null;
  }
  return (
    conversation.participants.find((participant) => participant !== userId) ||
    conversation.participants[0] ||
    null
  );
};

const renderDashboardNotifications = () => {
  const { badge, list, empty } = notificationRefs;
  if (!badge || !list || !empty) {
    return;
  }
  const userId = getUsuarioId();
  if (!userId) {
    badge.hidden = true;
    list.innerHTML = "";
    empty.hidden = false;
    empty.textContent = "Inicia sesión para ver mensajes.";
    return;
  }
  const unread = notificationConversations
    .filter((conversation) => (conversation.unreadCounts?.[userId] || 0) > 0)
    .sort((a, b) => new Date(b.updatedAt || b.actualizadoEn || 0) - new Date(a.updatedAt || a.actualizadoEn || 0));
  if (!unread.length) {
    badge.hidden = true;
    list.innerHTML = "";
    empty.hidden = false;
    empty.textContent = "Sin mensajes nuevos.";
    return;
  }
  badge.hidden = false;
  badge.textContent = unread.length > 99 ? "99+" : unread.length;
  empty.hidden = true;
  list.innerHTML = "";
  unread.forEach((conversation) => {
    const recipientId = getConversationRecipient(conversation);
    const displayName = resolveNombreConversacion(recipientId, conversation);
    const unreadCount = conversation.unreadCounts?.[userId] || 0;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "notification-list__item";
    const nameSpan = document.createElement("span");
    nameSpan.className = "notification-list__name";
    nameSpan.textContent = displayName;
    const countSpan = document.createElement("span");
    countSpan.className = "notification-list__count";
    countSpan.textContent = unreadCount > 99 ? "99+" : unreadCount;
    item.appendChild(nameSpan);
    item.appendChild(countSpan);
    item.addEventListener("click", () => openConversationFromDashboard(conversation.id));
    list.appendChild(item);
  });
};

const closeDashboardNotifications = () => {
  if (!notificationRefs.dropdown) {
    return;
  }
  notificationRefs.dropdown.hidden = true;
  notificationDropdownOpen = false;
  notificationRefs.toggle?.setAttribute("aria-expanded", "false");
};

const toggleDashboardNotifications = () => {
  if (!notificationRefs.dropdown || !notificationRefs.toggle) {
    return;
  }
  notificationDropdownOpen = !notificationDropdownOpen;
  notificationRefs.dropdown.hidden = !notificationDropdownOpen;
  notificationRefs.toggle.setAttribute("aria-expanded", notificationDropdownOpen ? "true" : "false");
  if (notificationDropdownOpen) {
    renderDashboardNotifications();
  }
};

const loadConversationNotifications = async () => {
  const userId = getUsuarioId();
  if (!userId) {
    notificationConversations = [];
    renderDashboardNotifications();
    return;
  }
  try {
    const response = await fetchComunicacion(`/conversations?usuarioId=${encodeURIComponent(userId)}`);
    const data = response?.data || response || [];
    // Normaliza campos cuando vienen en castellano
    notificationConversations = data.map((conv) => ({
      id: conv.id || conv._id || conv.conversationId,
      participants: conv.participants || conv.participantes || [],
      unreadCounts: conv.unreadCounts || conv.noLeidos || {},
      updatedAt: conv.updatedAt || conv.actualizadoEn || conv.creadoEn || null,
      metadata: conv.metadata || conv.metadatos || {},
    }));
    renderDashboardNotifications();
  } catch (error) {
    console.warn("No se pudieron cargar las notificaciones de mensajes:", error);
  }
};

const initNotificationCenter = () => {
  notificationRefs.toggle = document.getElementById("notificationToggle");
  notificationRefs.badge = document.getElementById("notificationBadge");
  notificationRefs.dropdown = document.getElementById("notificationDropdown");
  notificationRefs.list = document.getElementById("notificationList");
  notificationRefs.empty = document.getElementById("notificationEmpty");

  if (!notificationRefs.toggle) {
    return;
  }

  notificationRefs.toggle.addEventListener("click", (event) => {
    event.preventDefault();
    toggleDashboardNotifications();
  });
  notificationRefs.toggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDashboardNotifications();
    }
  });

  const startNotifications = () => loadConversationNotifications();
  startNotifications();
  if (window.LiveRefresh?.start) {
    LiveRefresh.start(loadConversationNotifications, {
      intervalMs: 12000,
      immediate: false,
      label: "dashboard-mensajes"
    });
  } else {
    window.addEventListener("focus", loadConversationNotifications);
    setInterval(loadConversationNotifications, 30000);
  }
};

const resolveNombreConversacion = (participantId, conversation) => {
  if (!participantId) {
    return "Contacto";
  }
  const metadataName =
    conversation?.metadata?.participants?.[participantId] ||
    conversation?.metadata?.aliases?.[participantId] ||
    null;
  if (metadataName) {
    return metadataName;
  }
  return participantId;
};

const obtenerNombreVisible = (usuario) => {
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

  const nombreCompleto = partes.join(" ").trim();
  return nombreCompleto || usuario.nombreUsuario || "";
};

const normalizarIdentificador = (valor = "") =>
  valor
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const obtenerSlugUsuarioActual = () =>
  normalizarIdentificador(
    usuarioActual?.nombreUsuario || usuarioActual?.email || usuarioActual?.nombre || ""
  );

const resolverProfesionalId = (cita = {}) => {
  const ref = cita?.idUsuario;
  if (!ref) {
    return null;
  }
  if (typeof ref === "string") {
    return ref;
  }
  if (typeof ref === "object") {
    return ref.idUsuario || ref._id || ref.id || null;
  }
  return null;
};

const resolverSlugProfesional = (cita = {}) => {
  const ref = cita?.idUsuario;
  if (!ref) {
    return "";
  }
  const candidatos = [
    ref.nombreUsuario,
    ref.email,
    `${ref.nombre ?? ""} ${ref.apellidos ?? ""}`,
    ref.nombre
  ];
  const slug = candidatos
    .map((valor) => normalizarIdentificador(valor))
    .find((valor) => valor.length > 0);
  return slug || "";
};

const cargarUsuario = () => {
  const user = getStoredUser();

  if (!user) {
    window.location.href = LOGIN_PAGE;
    return null;
  }

  usuarioActual = user;

  const nameNode = document.getElementById("userName");
  const locationNode = document.getElementById("userLocation");

  if (nameNode) {
    const visibleName = obtenerNombreVisible(user);
    nameNode.textContent = visibleName || "Usuario";
  }

  const avatarNode = document.querySelector(".avatar img");
  if (avatarNode) {
    setAvatarImage(avatarNode, buildAvatarSrc(user.foto));
    avatarNode.alt = obtenerNombreVisible(user) || "Avatar de usuario";
  }

  if (locationNode) {
    locationNode.textContent = user.rol || "-";
  }

  return user;
};

const cargarCitas = async () => {
  const tbody = document.querySelector("#appointmentsTable tbody");

  if (!tbody) {
    return;
  }

  closeStatusMenu();

  if (!usuarioActual?.idUsuario) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No se pudo determinar el usuario actual.</td></tr>`;
    return;
  }

  const { inicio, fin } = obtenerRangoDiaUTC(new Date());
  const params = new URLSearchParams({
    idUsuario: usuarioActual.idUsuario,
    fechaDesde: inicio,
    fechaHasta: fin
  });
  const primaryUrl = `${API_URL}/citas?${params.toString()}`;
  const fallbackUrl = API_FALLBACK ? `${API_FALLBACK}/citas?${params.toString()}` : null;
  const requestInit = { headers: buildAuthHeaders() };
  try {
    const res = await fetch(primaryUrl, requestInit).catch((error) => {
      if (fallbackUrl) {
        return fetch(fallbackUrl, requestInit);
      }
      throw error;
    });
    if (res.status === 401) {
      localStorage.removeItem("bizihotzUsuario");
      window.location.href = LOGIN_PAGE;
      return;
    }
    if (!res.ok) {
      throw new Error(`Estado inesperado ${res.status}`);
    }

    let citas = await res.json();
    if (!Array.isArray(citas)) {
      citas = [];
    }

    if (!citas.length && usuarioActual) {
      const slugBuscado = obtenerSlugUsuarioActual();
      if (slugBuscado) {
          const paramsSinId = new URLSearchParams({
            fechaDesde: inicio,
            fechaHasta: fin
          });
          const alternativas = [`${API_URL}/citas?${paramsSinId.toString()}`];
          if (API_FALLBACK) {
            alternativas.push(`${API_FALLBACK}/citas?${paramsSinId.toString()}`);
          }
          for (let index = 0; index < alternativas.length; index += 1) {
            const url = alternativas[index];
            try {
              const respuestaAlternativa = await fetch(url, requestInit);
            if (!respuestaAlternativa.ok) {
              throw new Error(`Estado inesperado ${respuestaAlternativa.status}`);
            }
            const datosAlternativos = await respuestaAlternativa.json();
            if (Array.isArray(datosAlternativos) && datosAlternativos.length) {
              const coincidencias = datosAlternativos.filter(
                (cita) => resolverSlugProfesional(cita) === slugBuscado
              );
              if (coincidencias.length) {
                const nuevoId = resolverProfesionalId(coincidencias[0]);
                if (nuevoId && nuevoId !== usuarioActual.idUsuario) {
                  actualizarUsuarioLocal({ idUsuario: nuevoId });
                  usuarioActual.idUsuario = nuevoId;
                }
                citas = coincidencias;
              }
            }
            if (citas.length) {
              break;
            }
          } catch (errorAlternativo) {
            if (index === alternativas.length - 1) {
              console.warn("No se pudo resolver el profesional desde los datos:", errorAlternativo);
            }
          }
        }
      }
    }

    tbody.innerHTML = "";

    if (!Array.isArray(citas) || citas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No hay citas disponibles</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    citas.forEach((cita) => {
      const fila = document.createElement("tr");
      const citaId = resolveCitaId(cita);
      const pacienteId = resolvePacienteId(cita);
      if (citaId) {
        fila.dataset.citaId = citaId;
      }

      const horaCell = document.createElement("td");
      horaCell.textContent = cita.hora ? String(cita.hora) : "--:--";
      fila.appendChild(horaCell);

      const pacienteCell = document.createElement("td");
      const nombrePaciente = cita.paciente ? String(cita.paciente) : "Sin nombre";
      if (pacienteId) {
        const pacienteLink = document.createElement("button");
        pacienteLink.type = "button";
        pacienteLink.className = "patient-link";
        pacienteLink.dataset.pacienteId = pacienteId;
        pacienteLink.textContent = nombrePaciente;
        pacienteCell.appendChild(pacienteLink);
      } else {
        pacienteCell.textContent = nombrePaciente;
      }
      fila.appendChild(pacienteCell);

      const motivoCell = document.createElement("td");
      motivoCell.textContent = cita.motivo ? String(cita.motivo) : "Sin motivo";
      fila.appendChild(motivoCell);

      const estadoCell = document.createElement("td");
      estadoCell.className = "status-cell";
      const estadoChip = buildStatusChip(citaId, cita.estado || "Pendiente");
      estadoCell.appendChild(estadoChip);
      fila.appendChild(estadoCell);

      fragment.appendChild(fila);
    });
    tbody.appendChild(fragment);
    if (!appointmentsClickHandlerBound) {
      tbody.addEventListener("click", (event) => {
        const link = event.target.closest(".patient-link");
        if (!link || !tbody.contains(link)) return;
        const pacienteId = link.dataset.pacienteId;
        if (!pacienteId) return;
        window.location.href = `pacienteDetalle.html?id=${encodeURIComponent(pacienteId)}`;
      });
      appointmentsClickHandlerBound = true;
    }
  } catch (error) {
    console.warn("No se pudieron cargar las citas:", error);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Error al cargar citas</td></tr>`;
  }
};

const prepararLogoutModal = () => {
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutModal = document.getElementById("logoutModal");
  const confirmLogout = document.getElementById("confirmLogout");
  const cancelLogout = document.getElementById("cancelLogout");

  const handleLogout = async () => {
    if (logoutModal) {
      logoutModal.style.display = "none";
    }
    localStorage.removeItem("bizihotzUsuario");

    const logoutInit = {
      method: "POST",
      headers: buildAuthHeaders()
    };

    try {
      await fetch(`${API_URL}/auth/logout`, logoutInit).catch(async () => {
        if (!API_FALLBACK) {
          return undefined;
        }
        return fetch(`${API_FALLBACK}/auth/logout`, logoutInit);
      });
    } finally {
      window.location.href = LOGIN_PAGE;
    }
  };

  if (!logoutBtn || !logoutModal || !confirmLogout || !cancelLogout) {
    return handleLogout;
  }

  logoutModal.style.display = "none";

  logoutBtn.addEventListener("click", () => {
    logoutModal.style.display = "flex";
  });

  cancelLogout.addEventListener("click", () => {
    logoutModal.style.display = "none";
  });

  confirmLogout.addEventListener("click", async () => {
    await handleLogout();
  });

  return handleLogout;
};

document.addEventListener("click", handleDocumentClick);
document.addEventListener("keydown", handleGlobalKeydown);
window.addEventListener("resize", closeStatusMenu);
window.addEventListener("scroll", handleGlobalScroll, true);


document.addEventListener("DOMContentLoaded", () => {
  const handleLogout = prepararLogoutModal();
  const user = cargarUsuario();
  cargarCitas();
  if (!user) {
    return;
  }
  initNotificationCenter();
  if (window.LiveRefresh?.start) {
    LiveRefresh.start(cargarCitas, {
      intervalMs: 12000,
      immediate: false,
      label: "dashboard-citas"
    });
  }

  const agendaButton = document.querySelector('.nav-button[data-nav="agenda"]');
  if (agendaButton) {
    agendaButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "agenda.html";
    });
  }

  const nuevoPacienteButton = document.querySelector('.nav-button[data-nav="nuevo-paciente"]');
  if (nuevoPacienteButton) {
    nuevoPacienteButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "nuevoPaciente.html";
    });
  }

  const historialButton = document.querySelector('.nav-button[data-nav="historial"]');
  if (historialButton) {
    historialButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "historialClinico.html";
    });
  }

  const dietasButton = document.querySelector('.nav-button[data-nav="dietas"]');
  if (dietasButton) {
    dietasButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "dietas.html";
    });
  }

  const mensajesButton = document.querySelector('.nav-button[data-nav="mensajes"]');
  if (mensajesButton) {
    mensajesButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "mensajes.html";
    });
  }

  const documentosButton = document.querySelector('.nav-button[data-nav="documentos"]');
  if (documentosButton) {
    documentosButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "documentos.html";
    });
  }

  // Limitamos el menú para recepcionistas: solo Agenda y Nuevo paciente.
  if ((usuarioActual?.rolSistema || "").toLowerCase() === "recepcionista") {
    const allowed = new Set(["agenda", "nuevo-paciente"]);
    document.querySelectorAll(".nav-button").forEach((btn) => {
      const nav = btn.dataset.nav;
      if (!allowed.has(nav)) {
        btn.style.display = "none";
      }
    });
    const currentPage = window.location.pathname.split("/").pop();
    if (!["agenda.html", "nuevoPaciente.html", "principal.html", ""].includes(currentPage)) {
      window.location.href = "agenda.html";
      return;
    }
  }


  PerfilModal.prepararModalPerfil(handleLogout, {
    getUsuarioActual: () => usuarioActual,
    actualizarUsuarioLocal,
    obtenerNombreVisible,
    apiUrl: API_URL,
    apiFallback: API_FALLBACK
  });

  // Antes se forzaba abrir perfil si debeActualizarPassword=true; lo desactivamos para no interrumpir el flujo inicial.
  // El usuario podrá actualizarla desde su perfil cuando lo decida.
});
