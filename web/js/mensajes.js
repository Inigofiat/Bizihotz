"use strict";

// Refresca solo al reentrar (volver a la pestaña o bfcache), no cada X segundos.
(() => {
  let shouldReload = false;

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });

  window.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      shouldReload = true;
    } else if (shouldReload) {
      shouldReload = false;
      window.location.reload();
    }
  });

  window.addEventListener("focus", () => {
    if (shouldReload) {
      shouldReload = false;
      window.location.reload();
    }
  });
})();

(function initMessaging() {
  const LOGIN_PAGE = "login.html";
  const USER_STORAGE_KEY = "bizihotzUsuario";
  const CONTACTS_STORAGE_KEY = "bizihotzContactos";
  const PROFESSIONALS_MIN_CHARS = 2;
  const DEFAULT_AVATAR_URL = "../images/avatar-default.svg";
  const MAX_ATTACHMENTS = 5;
  const MAX_ATTACHMENT_SIZE = 12 * 1024 * 1024;

  const dedupeCandidates = (items) => {
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

  const buildBaseCandidates = () => {
    const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
    const hostname = (window.location.hostname || "localhost").toLowerCase();
    const port = window.location.port;
    const isLocal = !hostname || hostname === "localhost" || hostname === "127.0.0.1";
    const targetHost = isLocal ? "localhost" : hostname;

    const gateway = [`${protocol}//${targetHost}:5000/comunicacion`];
    const direct = [`${protocol}//${targetHost}:4103`, `${protocol}//${targetHost}:4100`];

    const candidates = dedupeCandidates([...gateway, ...direct]);
    const sanitized = candidates.map((candidate) => {
      if (/:410(0|3)(?:$|\/)/.test(candidate)) {
        return candidate.replace(/\/comunicacion$/, "");
      }
      return candidate;
    });
    return dedupeCandidates(sanitized);
  };

  const buildGestionBaseCandidates = () => {
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
    return dedupeCandidates(candidates);
  };

  const BASE_CANDIDATES = buildBaseCandidates();
  const API_BASES = BASE_CANDIDATES.map((base) => `${base}/api`);
  const buildSocketCandidates = () => {
    const PORT_PREFERENCE = ["4103", "4100", "5000"];
    const ordered = [];
    const pushIfMatch = (match) => {
      if (match && !ordered.includes(match)) {
        ordered.push(match);
      }
    };
    PORT_PREFERENCE.forEach((port) => {
      BASE_CANDIDATES.forEach((candidate) => {
        if (candidate.includes(port)) {
          pushIfMatch(candidate);
        }
      });
    });
    BASE_CANDIDATES.forEach(pushIfMatch);
    return ordered.length ? ordered : ["http://localhost:4103"];
  };

  const SOCKET_CANDIDATES = buildSocketCandidates();
  const preferredSocketIndex = SOCKET_CANDIDATES.findIndex((candidate) => candidate.includes("4103"));
  let socketBaseIndex = preferredSocketIndex >= 0 ? preferredSocketIndex : 0;
  const getSocketBase = () => SOCKET_CANDIDATES[socketBaseIndex] || "http://localhost:4103";
  const advanceSocketCandidate = () => {
    if (SOCKET_CANDIDATES.length <= 1) {
      return;
    }
    socketBaseIndex = (socketBaseIndex + 1) % SOCKET_CANDIDATES.length;
  };
  const GESTION_BASES = buildGestionBaseCandidates();
  const GESTION_API_BASES = GESTION_BASES.map((base) => `${base}/api`);
  let resolvedApiBase = null;

  if (typeof window !== "undefined") {
    window.__BIZIHOTZ_API_BASES__ = API_BASES.slice();
    window.__BIZIHOTZ_SOCKET_CANDIDATES__ = SOCKET_CANDIDATES.slice();
  }

  let currentUser = null;
  let contacts = {};
  let conversations = [];
  let activeConversationId = null;
  let messagesCache = new Map();
  let socket = null;
  let socketConnected = false;
  let reconnectTimer = null;
  let currentUserId = null;
  let selectedProfessional = null;
  let professionalsCache = [];
  let isLoadingProfessionals = false;
  let isCreatingConversation = false;
  let contextMenuState = {
    type: null,
    messageId: null,
    conversationId: null
  };
  let openContextMenu = null;
  let pendingEditMessageId = null;
  let confirmResolver = null;
  const CONVERSATION_TARGET_KEY = "bizihotzConversationTarget";
  let pendingConversationId = null;
  let pendingAttachments = [];
  let isSendingMessage = false;

  const refs = {
    socketStatus: document.getElementById("socketStatus"),
    currentUserChip: document.getElementById("currentUserChip"),
    currentUserInitials: document.getElementById("currentUserInitials"),
    currentUserName: document.getElementById("currentUserName"),
    conversationList: document.getElementById("conversationList"),
    searchInput: document.getElementById("searchInput"),
    chatPlaceholder: document.getElementById("chatPlaceholder"),
    chatBrand: document.getElementById("chatBrand"),
    chatContent: document.getElementById("chatContent"),
    chatHeaderDetails: document.getElementById("chatHeaderDetails"),
    chatFeedback: document.getElementById("chatFeedback"),
    activeConversationName: document.getElementById("activeConversationName"),
    activeConversationMeta: document.getElementById("activeConversationMeta"),
    messageList: document.getElementById("messageList"),
    composerForm: document.getElementById("composerForm"),
    messageInput: document.getElementById("messageInput"),
    attachmentInput: document.getElementById("attachmentInput"),
    attachmentList: document.getElementById("attachmentList"),
    openAttachmentPicker: document.getElementById("openAttachmentPicker"),
    sendMessageButton: document.getElementById("sendMessageButton"),
    newChatModal: document.getElementById("newChatModal"),
    openNewChat: document.getElementById("openNewChat"),
    closeNewChat: document.getElementById("closeNewChat"),
    cancelNewChat: document.getElementById("cancelNewChat"),
    newChatForm: document.getElementById("newChatForm"),
    newChatSearch: document.getElementById("newChatSearch"),
    professionalGrid: document.getElementById("professionalGrid"),
    newChatHint: document.getElementById("newChatHint"),
    newChatFeedback: document.getElementById("newChatFeedback"),
    renameModal: document.getElementById("renameModal"),
    renameContactBtn: document.getElementById("renameContactBtn"),
    deleteConversationBtn: document.getElementById("deleteConversationBtn"),
    renameForm: document.getElementById("renameForm"),
    renameInput: document.getElementById("renameInput"),
    closeRenameModal: document.getElementById("closeRenameModal"),
    cancelRename: document.getElementById("cancelRename"),
    editMessageModal: document.getElementById("editMessageModal"),
    editMessageForm: document.getElementById("editMessageForm"),
    editMessageInput: document.getElementById("editMessageInput"),
    editMessageFeedback: document.getElementById("editMessageFeedback"),
    closeEditMessage: document.getElementById("closeEditMessage"),
    cancelEditMessage: document.getElementById("cancelEditMessage"),
    confirmModal: document.getElementById("confirmModal"),
    confirmTitle: document.getElementById("confirmTitle"),
    confirmMessage: document.getElementById("confirmMessage"),
    confirmAccept: document.getElementById("acceptConfirm"),
    confirmCancel: document.getElementById("cancelConfirm"),
    closeConfirmModal: document.getElementById("closeConfirmModal"),
    messageContextMenu: document.getElementById("messageContextMenu"),
    conversationContextMenu: document.getElementById("conversationContextMenu"),
    backButton: document.getElementById("volverPanel")
  };

  let chatFeedbackTimer = null;
  function hideChatFeedback() {
    if (chatFeedbackTimer) {
      clearTimeout(chatFeedbackTimer);
      chatFeedbackTimer = null;
    }
    if (refs.chatFeedback) {
      refs.chatFeedback.hidden = true;
      refs.chatFeedback.textContent = "";
      refs.chatFeedback.classList.remove("is-success", "is-error", "is-info");
    }
  }

  function showChatFeedback(message, variant = "info", timeout = 3500) {
    if (!refs.chatFeedback) {
      return;
    }
    refs.chatFeedback.textContent = message;
    refs.chatFeedback.classList.remove("is-success", "is-error", "is-info");
    refs.chatFeedback.classList.add(`is-${variant}`);
    refs.chatFeedback.hidden = false;
    if (chatFeedbackTimer) {
      clearTimeout(chatFeedbackTimer);
    }
    chatFeedbackTimer = setTimeout(() => {
      hideChatFeedback();
    }, timeout);
  }

  const showConversationPlaceholder = () => {
    refs.chatPlaceholder.hidden = false;
    refs.chatContent.hidden = true;
    if (refs.chatBrand) {
      refs.chatBrand.hidden = true;
    }
  };

  const showConversationWorkspace = () => {
    refs.chatPlaceholder.hidden = true;
    refs.chatContent.hidden = false;
    if (refs.chatBrand) {
      refs.chatBrand.hidden = false;
      refs.chatPlaceholder.hidden = true;
    }
  };

  const handleBackButtonClick = (event) => {
    if (event) {
      event.preventDefault();
    }
    window.location.href = "principal.html";
  };


  const updateConversationActionsState = () => {
    const enabled = Boolean(activeConversationId);
    if (refs.renameContactBtn) {
      refs.renameContactBtn.disabled = !enabled;
    }
    if (refs.deleteConversationBtn) {
      refs.deleteConversationBtn.disabled = !enabled;
    }
    if (!enabled) {
      if (refs.activeConversationName) {
        refs.activeConversationName.textContent = "";
      }
      if (refs.activeConversationMeta) {
        refs.activeConversationMeta.textContent = "";
      }
    }
    if (refs.chatHeaderDetails) {
      refs.chatHeaderDetails.dataset.empty = enabled ? "false" : "true";
    }
  };
  updateConversationActionsState();
  hideChatFeedback();

  const showModal = (modal) => {
    if (modal) {
      modal.classList.add("is-visible");
    }
  };

  const hideModal = (modal) => {
    if (modal) {
      modal.classList.remove("is-visible");
    }
  };

  const resolvePendingConfirm = (result) => {
    if (confirmResolver) {
      confirmResolver(result);
      confirmResolver = null;
    }
  };

  const openConfirmDialog = (options = {}) => {
    if (!refs.confirmModal) {
      return Promise.resolve(false);
    }
    resolvePendingConfirm(false);
    const { title = "Confirmar acción", message = "¿Deseas continuar?", confirmLabel = "Aceptar", variant = "danger" } = options;
    if (refs.confirmTitle) {
      refs.confirmTitle.textContent = title;
    }
    if (refs.confirmMessage) {
      refs.confirmMessage.textContent = message;
    }
    if (refs.confirmAccept) {
      refs.confirmAccept.textContent = confirmLabel;
      refs.confirmAccept.classList.toggle("primary-button--danger", variant === "danger");
    }
    showModal(refs.confirmModal);
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  };

  const closeConfirmDialog = () => {
    hideModal(refs.confirmModal);
    resolvePendingConfirm(false);
  };

  const openEditMessageDialog = (messageId) => {
    if (!messageId || !activeConversationId || !refs.editMessageModal) {
      return;
    }
    const message = getMessageFromCache(activeConversationId, messageId);
    if (!message || message.senderId !== currentUserId) {
      return;
    }
    pendingEditMessageId = messageId;
    if (refs.editMessageInput) {
      refs.editMessageInput.value = message.content || "";
    }
    if (refs.editMessageFeedback) {
      refs.editMessageFeedback.textContent = "";
    }
    showModal(refs.editMessageModal);
    requestAnimationFrame(() => {
      refs.editMessageInput?.focus();
      refs.editMessageInput?.setSelectionRange(refs.editMessageInput.value.length, refs.editMessageInput.value.length);
    });
  };

  const closeEditMessageDialog = () => {
    pendingEditMessageId = null;
    hideModal(refs.editMessageModal);
    if (refs.editMessageFeedback) {
      refs.editMessageFeedback.textContent = "";
    }
  };

  const hideContextMenus = () => {
    [refs.messageContextMenu, refs.conversationContextMenu].forEach((menu) => {
      if (!menu) {
        return;
      }
      menu.hidden = true;
      menu.style.left = "-9999px";
      menu.style.top = "-9999px";
      menu.style.visibility = "visible";
      menu.dataset.messageId = "";
      menu.dataset.conversationId = "";
    });
    openContextMenu = null;
    contextMenuState = {
      type: null,
      messageId: null,
      conversationId: null
    };
  };

  const setSocketStatus = (status, label) => {
    if (!refs.socketStatus) {
      return;
    }
    refs.socketStatus.textContent = label;
    refs.socketStatus.classList.remove("is-online", "is-offline");
    if (status === "online") {
      refs.socketStatus.classList.add("is-online");
    } else if (status === "offline") {
      refs.socketStatus.classList.add("is-offline");
    }
  };

  const resolveAuthToken = () => {
    try {
      const stored = currentUser || JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "null");
      return stored?.token || stored?.accessToken || stored?.authToken || "";
    } catch (_error) {
      return "";
    }
  };

  const buildAuthHeaders = (baseHeaders = {}) => {
    const headers = Object.assign({ Accept: "application/json" }, baseHeaders || {});
    const token = resolveAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  // Normaliza objetos de conversacion del API (castellano/ingles) al shape usado en el frontend.
  const normalizeConversation = (raw) => {
    if (!raw) return null;
    const participants = raw.participantes || raw.participants || [];
    const metadata = raw.metadatos || raw.metadata || {};
    const lastRaw = raw.ultimoMensaje || raw.lastMessage || null;
    const lastMessage = lastRaw
      ? {
          messageId: lastRaw.idMensaje || lastRaw.messageId,
          content: lastRaw.contenido || lastRaw.content,
          sentAt: lastRaw.enviadoEn || lastRaw.sentAt,
          senderId: lastRaw.remitenteId || lastRaw.senderId,
          attachments: lastRaw.adjuntos || lastRaw.attachments || []
        }
      : raw.lastMessage || null;
    return {
      id: raw.id || raw._id || raw.conversationId || null,
      participants,
      metadata,
      lastMessage,
      unreadCounts: raw.noLeidos || raw.unreadCounts || {},
      topic: raw.tema || raw.topic || "",
      createdAt: raw.creadoEn || raw.createdAt,
      updatedAt: raw.actualizadoEn || raw.updatedAt
    };
  };

  // Normaliza objetos de mensaje del API (castellano/ingles) al shape usado en el frontend.
  const normalizeMessage = (raw) => {
    if (!raw) return null;
    return {
      id: raw.id || raw._id || raw.messageId || null,
      conversationId: raw.conversacionId || raw.conversationId || raw.conversation_id || null,
      senderId: raw.remitenteId || raw.senderId,
      recipientId: raw.destinatarioId || raw.recipientId,
      content: raw.contenido || raw.content || "",
      attachments: raw.adjuntos || raw.attachments || [],
      metadata: raw.metadatos || raw.metadata || {},
      status: raw.estado || raw.status,
      readAt: raw.leidoEn || raw.readAt,
      editedAt: raw.editadoEn || raw.editedAt,
      editedBy: raw.editadoPor || raw.editedBy,
      sentAt: raw.enviadoEn || raw.sentAt,
      createdAt: raw.creadoEn || raw.createdAt,
      updatedAt: raw.actualizadoEn || raw.updatedAt
    };
  };

  const buildFallbackFetch = async (path, options = {}) => {
    let lastError = null;
    const orderedBases = resolvedApiBase
      ? [resolvedApiBase, ...API_BASES.filter((candidate) => candidate !== resolvedApiBase)]
      : API_BASES;

    for (const base of orderedBases) {
      try {
        const response = await fetch(`${base}${path}`, {
          ...options,
          headers: buildAuthHeaders(options.headers)
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || `Solicitud rechazada (${response.status})`);
        }
        resolvedApiBase = base;
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          return await response.json();
        }
        return await response.text();
      } catch (error) {
        lastError = error;
        if (resolvedApiBase === base) {
          resolvedApiBase = null;
        }
      }
    }
    throw lastError || new Error("No se pudo contactar con el microservicio de comunicación.");
  };

  const saveContacts = () => {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  };

  const loadContacts = () => {
    try {
      const stored = localStorage.getItem(CONTACTS_STORAGE_KEY);
      contacts = stored ? JSON.parse(stored) : {};
    } catch (_error) {
      contacts = {};
    }
  };

  const getCurrentUser = () => {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  };

  const resolveUserId = (user) =>
    user?._id || user?.id || user?.idUsuario || user?.usuarioId || user?.ID || null;

  const getCurrentUserDisplayName = () => {
    if (!currentUser) {
      return "Profesional";
    }
    return (
      currentUser.nombreUsuario ||
      `${currentUser.nombre || ""} ${currentUser.apellidos || ""}`.trim() ||
      currentUser.email ||
      "Profesional"
    );
  };

  const rememberContact = (id, alias, avatarSource = null) => {
    if (!id || !alias) {
      return;
    }
    const trimmed = alias.trim();
    if (!trimmed) {
      return;
    }
    const previous = contacts[id] || {};
    let resolvedAvatar = previous.avatar || null;
    let nextAvatarSource = previous.avatarSource ?? null;
    if (avatarSource !== null) {
      nextAvatarSource = avatarSource || null;
      resolvedAvatar = nextAvatarSource ? resolveMediaUrl(nextAvatarSource) : null;
    }
    const changed =
      previous.alias !== trimmed || previous.avatar !== resolvedAvatar || previous.avatarSource !== nextAvatarSource;

    contacts[id] = {
      alias: trimmed,
      avatar: resolvedAvatar,
      avatarSource: nextAvatarSource,
      storedAt: new Date().toISOString(),
    };
    if (changed) {
      saveContacts();
    }
  };

  const ensureUser = () => {
    currentUser = getCurrentUser();
    currentUserId = resolveUserId(currentUser);
    if (!currentUser || !currentUserId) {
      window.location.href = LOGIN_PAGE;
      return;
    }
    refs.currentUserName.textContent = currentUser.nombreUsuario || currentUser.nombre || "Profesional";
    refs.currentUserInitials.textContent = (currentUser.nombreUsuario || "YO")
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const resolveDisplayName = (participantId, conversation) => {
    if (!participantId) {
      return "Profesional";
    }
    if (participantId === currentUserId) {
      return "Tú";
    }
    const metaName =
      conversation?.metadata?.aliases?.[participantId] ||
      conversation?.metadata?.participants?.[participantId] ||
      null;
    if (metaName) {
      return metaName;
    }
    return contacts[participantId]?.alias || contacts[participantId]?.name || participantId;
  };

  const resolveParticipantAvatar = (participantId, conversation) => {
    if (!participantId) {
      return "";
    }
    const metadataAvatar =
      conversation?.metadata?.avatars?.[participantId] || conversation?.metadata?.fotos?.[participantId];
    if (metadataAvatar) {
      return resolveMediaUrl(metadataAvatar);
    }
    const stored = contacts[participantId]?.avatar;
    if (stored) {
      return stored;
    }
    return "";
  };

  const resolveInitials = (nameOrId) => {
    if (!nameOrId) {
      return "??";
    }
    return nameOrId
      .toString()
      .split(/\s+/)
      .map((word) => word.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getRecipientFromConversation = (conversation) => {
    return (conversation?.participants || []).find((participant) => participant !== currentUserId) || null;
  };

  const resetNewChatState = () => {
    selectedProfessional = null;
    if (refs.newChatForm) {
      refs.newChatForm.reset();
    } else if (refs.newChatSearch) {
      refs.newChatSearch.value = "";
    }
    if (refs.newChatFeedback) {
      refs.newChatFeedback.textContent = "";
    }
    highlightProfessionalCard(null);
    if (refs.newChatHint) {
      refs.newChatHint.textContent = "Selecciona un profesional disponible.";
    }
    renderProfessionalCards(professionalsCache);
  };

  const fetchProfessionals = async (term = "") => {
    const query = term.trim();
    const params = new URLSearchParams();
    const limit = query.length >= PROFESSIONALS_MIN_CHARS ? 16 : 60;

    if (query) {
      if (query.length < PROFESSIONALS_MIN_CHARS) {
        return [];
      }
      params.set("q", query);
    }
    params.set("limit", limit.toString());

    let lastError = null;

    for (const base of GESTION_API_BASES) {
      try {
        const response = await fetch(`${base}/usuarios?${params.toString()}`, {
          headers: buildAuthHeaders()
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Error ${response.status}`);
        }
        const payload = await response.json();
        return payload.data || payload || [];
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("No se pudo cargar la lista de profesionales.");
  };

  const resolveMediaUrl = (path) => {
    if (!path) {
      return DEFAULT_AVATAR_URL;
    }
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    const base = GESTION_BASES[0] || window.location.origin || "";
    const normalizedBase = base.replace(/\/$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  };

  const resolveAttachmentUrl = (path) => {
    if (!path) {
      return null;
    }
    if (/^(https?:|data:|blob:)/i.test(path)) {
      return path;
    }
    const base = (resolvedApiBase || API_BASES[0] || "").replace(/\/api$/, "");
    const normalizedBase = base.replace(/\/$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  };

  const formatBytes = (bytes = 0) => {
    if (!bytes || Number.isNaN(bytes)) {
      return "";
    }
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / 1024 ** exponent;
    const decimals = value >= 10 || exponent === 0 ? 0 : 1;
    return `${value.toFixed(decimals)} ${units[exponent]}`;
  };

  const renderAttachmentList = () => {
    if (!refs.attachmentList) {
      return;
    }
    refs.attachmentList.innerHTML = "";
    if (!pendingAttachments.length) {
      refs.attachmentList.hidden = true;
      return;
    }
    const fragment = document.createDocumentFragment();
    pendingAttachments.forEach((file, index) => {
      const chip = document.createElement("div");
      chip.className = "attachment-chip";

      const icon = document.createElement("span");
      icon.className = "attachment-chip__icon";
      icon.textContent = (file.type || "").startsWith("image/") ? "IMG" : "FILE";

      const info = document.createElement("div");
      info.className = "attachment-chip__info";
      const name = document.createElement("p");
      name.className = "attachment-chip__name";
      name.textContent = file.name || "Adjunto";
      const size = document.createElement("p");
      size.className = "attachment-chip__size";
      size.textContent = formatBytes(file.size);
      info.appendChild(name);
      info.appendChild(size);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "attachment-chip__remove";
      removeBtn.setAttribute("aria-label", `Eliminar ${file.name || "adjunto"}`);
      removeBtn.textContent = "x";
      removeBtn.addEventListener("click", () => removeAttachmentAt(index));

      chip.appendChild(icon);
      chip.appendChild(info);
      chip.appendChild(removeBtn);
      fragment.appendChild(chip);
    });

    refs.attachmentList.appendChild(fragment);
    refs.attachmentList.hidden = false;
  };

  const clearPendingAttachments = () => {
    pendingAttachments = [];
    renderAttachmentList();
  };

  const removeAttachmentAt = (index) => {
    if (index < 0 || index >= pendingAttachments.length) {
      return;
    }
    pendingAttachments.splice(index, 1);
    renderAttachmentList();
  };

  const handleAttachmentInputChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }
    let warned = false;
    files.forEach((file) => {
      if (pendingAttachments.length >= MAX_ATTACHMENTS) {
        if (!warned) {
          showChatFeedback(`Máximo ${MAX_ATTACHMENTS} adjuntos por mensaje.`, "error");
          warned = true;
        }
        return;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        showChatFeedback(
          `El archivo ${file.name || ""} supera ${formatBytes(MAX_ATTACHMENT_SIZE)}.`,
          "error"
        );
        warned = true;
        return;
      }
      pendingAttachments.push(file);
    });
    renderAttachmentList();
    if (refs.attachmentInput) {
      refs.attachmentInput.value = "";
    }
  };

  const requestAttachmentPicker = () => {
    refs.attachmentInput?.click();
  };

  const setComposerDisabled = (disabled) => {
    if (refs.messageInput) {
      refs.messageInput.disabled = disabled;
    }
    if (refs.sendMessageButton) {
      refs.sendMessageButton.disabled = disabled;
    }
    if (refs.openAttachmentPicker) {
      refs.openAttachmentPicker.disabled = disabled;
    }
    if (refs.attachmentInput) {
      refs.attachmentInput.disabled = disabled;
    }
  };

  const highlightProfessionalCard = (id) => {
    if (!refs.professionalGrid) {
      return;
    }
    refs.professionalGrid.querySelectorAll(".professional-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.id === id);
    });
  };

  const getProfessionalDisplayName = (item) => {
    return (
      item?.nombreCompleto?.trim() ||
      `${item?.nombre || ""} ${item?.apellidos || ""}`.trim() ||
      item?.nombreUsuario ||
      item?.email ||
      "Profesional"
    );
  };

  const rememberProfessional = (item) => {
    if (!item?.idUsuario) {
      return "Profesional";
    }
    const displayName = getProfessionalDisplayName(item);
    rememberContact(item.idUsuario, displayName, item.foto || null);
    return displayName;
  };

  const renderProfessionalCards = (items = []) => {
    if (!refs.professionalGrid) {
      return;
    }
    refs.professionalGrid.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "professional-grid__empty";
      empty.textContent = "Sin profesionales para mostrar.";
      refs.professionalGrid.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const displayName = rememberProfessional(item);
      const role = item.rol || "Profesional";
      const email = item.email || "Sin correo";
      const avatar = resolveMediaUrl(item.foto);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "professional-card";
      card.dataset.id = item.idUsuario;
      if (selectedProfessional?.id === item.idUsuario) {
        card.classList.add("is-selected");
      }

      card.innerHTML = `
        <img src="${avatar}" alt="${displayName}" onerror="this.src='${DEFAULT_AVATAR_URL}';this.onerror=null;" />
        <div class="professional-card__info">
          <strong>${displayName}</strong>
          <span>${role}</span>
          <small>${email}</small>
        </div>
      `;

      card.addEventListener("click", () => selectProfessional(item));
      fragment.appendChild(card);
    });

    refs.professionalGrid.appendChild(fragment);
  };

  const startConversationWithProfessional = async (professional) => {
    if (!professional || isCreatingConversation) {
      return;
    }
    isCreatingConversation = true;
    const participantId = professional.id;
    const senderName = getCurrentUserDisplayName();
    if (refs.newChatFeedback) {
      refs.newChatFeedback.textContent = `Abriendo conversación con ${professional.nombreCompleto}...`;
    }
    try {
      const response = await buildFallbackFetch("/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitanteId: currentUserId,
          participanteId: participantId,
          metadatos: {
            participants: {
              [currentUserId]: senderName,
              [participantId]: professional.nombreCompleto
            },
            avatars: {
              [currentUserId]: currentUser?.foto || null,
              [participantId]: professional.foto || null
            }
          }
        })
      });
      const payload = normalizeConversation(response?.data || response);
      const conversationId = payload?.id || payload?._id || null;
      hideModal(refs.newChatModal);
      resetNewChatState();
      await fetchConversations();
      let targetId = conversationId;
      if (!targetId) {
        targetId =
          conversations.find(
            (conversation) =>
              conversation.participants.includes(participantId) &&
              conversation.participants.includes(currentUserId)
          )?.id || null;
      }
      if (targetId) {
        await openConversation(targetId);
      }
      rememberContact(participantId, professional.nombreCompleto, professional.foto || null);
    } catch (error) {
      if (refs.newChatFeedback) {
        refs.newChatFeedback.textContent = error.message || "No se pudo abrir la conversación.";
      }
    } finally {
      isCreatingConversation = false;
    }
  };

  const selectProfessional = (item) => {
    if (!item?.idUsuario || !currentUserId || isCreatingConversation) {
      return;
    }

    const nombreCompleto =
      item.nombreCompleto?.trim() ||
      `${item.nombre || ""} ${item.apellidos || ""}`.trim() ||
      item.nombreUsuario ||
      item.email ||
      "Profesional";

    selectedProfessional = {
      id: item.idUsuario,
      nombreCompleto,
      email: item.email || "",
      rol: item.rol || "Profesional",
      foto: item.foto || ""
    };

    highlightProfessionalCard(selectedProfessional.id);
    rememberContact(selectedProfessional.id, selectedProfessional.nombreCompleto, item.foto || null);
    if (refs.newChatHint) {
      refs.newChatHint.textContent = `Abriendo conversación con ${selectedProfessional.nombreCompleto}...`;
    }
    startConversationWithProfessional(selectedProfessional);
  };

  const loadProfessionals = async (term = "") => {
    if (isLoadingProfessionals) {
      return;
    }
    isLoadingProfessionals = true;
    if (refs.newChatHint) {
      refs.newChatHint.textContent = term ? "Buscando profesionales..." : "Cargando profesionales...";
    }
    try {
      const items = await fetchProfessionals(term);
      if (!term) {
        professionalsCache = items;
      }
      renderProfessionalCards(items);
      if (refs.newChatHint) {
        refs.newChatHint.textContent = items.length
          ? "Selecciona un profesional de la lista."
          : term
            ? "Sin resultados. Intenta con otro nombre."
            : "No hay profesionales activos.";
      }
    } catch (error) {
      if (refs.newChatHint) {
        refs.newChatHint.textContent = error.message || "No se pudo cargar la lista.";
      }
      renderProfessionalCards([]);
    } finally {
      isLoadingProfessionals = false;
    }
  };

  const preloadProfessionalContacts = async () => {
    if (professionalsCache.length > 0) {
      return;
    }
    try {
      const items = await fetchProfessionals("");
      if (Array.isArray(items) && items.length > 0) {
        professionalsCache = items;
        items.forEach(rememberProfessional);
      }
    } catch (_error) {
      // Silent preload failure.
    }
  };

  const handleNewChatSearchInput = (event) => {
    const value = event.target.value || "";
    selectedProfessional = null;
    highlightProfessionalCard(null);

    if (!value.trim()) {
      renderProfessionalCards(professionalsCache);
      if (refs.newChatHint) {
        refs.newChatHint.textContent = "Selecciona un profesional de la lista.";
      }
      return;
    }

    if (value.trim().length < PROFESSIONALS_MIN_CHARS) {
      renderProfessionalCards([]);
      if (refs.newChatHint) {
        refs.newChatHint.textContent = "Introduce al menos 2 caracteres para buscar.";
      }
      return;
    }

    loadProfessionals(value.trim());
  };

  const renderConversationList = (filterText = "") => {
    if (!refs.conversationList) {
      return;
    }
    refs.conversationList.innerHTML = "";

    const normalizedFilter = filterText.trim().toLowerCase();
    const filtered = conversations.filter((conversation) => {
      const recipient = getRecipientFromConversation(conversation);
      const displayName = resolveDisplayName(recipient, conversation);
      return displayName.toLowerCase().includes(normalizedFilter);
    });

    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "conversation-list__empty";
      empty.innerHTML = "<p>No hay conversaciones.</p><p>Inicia una desde “Nuevo chat”.</p>";
      refs.conversationList.appendChild(empty);
      return;
    }

    filtered.forEach((conversation) => {
      const recipient = getRecipientFromConversation(conversation);
      const displayName = resolveDisplayName(recipient, conversation);
      const listItem = document.createElement("li");
      listItem.className = "conversation-item";
      listItem.dataset.conversationId = conversation.id;
      if (conversation.id === activeConversationId) {
        listItem.classList.add("is-active");
      }
      const initials = resolveInitials(displayName);

      const avatarWrapper = document.createElement("div");
      avatarWrapper.className = "conversation-item__avatar";
      avatarWrapper.textContent = initials;
      const avatarUrl = resolveParticipantAvatar(recipient, conversation);
      if (avatarUrl) {
        const img = document.createElement("img");
        img.src = avatarUrl;
        img.alt = displayName;
        img.addEventListener("error", () => {
          img.remove();
          avatarWrapper.classList.remove("has-image");
          avatarWrapper.textContent = initials;
        });
        avatarWrapper.classList.add("has-image");
        avatarWrapper.textContent = "";
        avatarWrapper.appendChild(img);
      }
      const body = document.createElement("div");
      body.className = "conversation-item__body";
      const title = document.createElement("h3");
      title.textContent = displayName;
      const preview = document.createElement("p");
      const lastMessage = conversation.lastMessage || {};
      const attachmentCount = lastMessage.attachments?.length || 0;
      const previewText =
        (lastMessage.content || "").trim() ||
        (attachmentCount ? `${attachmentCount} adjunto${attachmentCount > 1 ? "s" : ""}` : "Sin mensajes");
      preview.textContent = previewText;
      body.appendChild(title);
      body.appendChild(preview);

      const meta = document.createElement("div");
      meta.className = "conversation-item__meta";
      if (conversation.lastMessage?.sentAt) {
        const date = new Date(conversation.lastMessage.sentAt);
        meta.textContent = date.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      const unread = conversation.unreadCounts?.[currentUserId] || 0;
      if (unread > 0) {
        const badge = document.createElement("span");
        badge.className = "conversation-item__badge";
        badge.textContent = unread > 99 ? "99+" : unread;
        meta.appendChild(document.createElement("br"));
        meta.appendChild(badge);
      }

      listItem.appendChild(avatarWrapper);
      listItem.appendChild(body);
      listItem.appendChild(meta);
      listItem.addEventListener("click", () => openConversation(conversation.id));
      refs.conversationList.appendChild(listItem);
    });
  };

  const renderMessages = (conversationId) => {
    const messages = messagesCache.get(conversationId) || [];
    refs.messageList.innerHTML = "";
    if (messages.length === 0) {
      const empty = document.createElement("li");
      empty.className = "conversation-list__empty";
      empty.textContent = "Aún no hay mensajes.";
      refs.messageList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    const createAttachmentNode = (attachment) => {
      if (!attachment) {
        return null;
      }
      const url = resolveAttachmentUrl(attachment.url);
      const type = (attachment.tipo || attachment.type || "").toLowerCase();
      const name = attachment.nombre || attachment.name || "Adjunto";
      const sizeLabel = formatBytes(attachment.tamano || attachment.size);
      if (type === "image" && url) {
        const link = document.createElement("a");
        link.className = "message__attachment message__attachment--image";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const img = document.createElement("img");
        img.className = "message__attachment-thumb";
        img.src = url;
        img.alt = name;
        link.appendChild(img);
        if (name) {
          const caption = document.createElement("p");
          caption.className = "message__attachment-title";
          caption.textContent = name;
          link.appendChild(caption);
        }
        return link;
      }

      const wrapper = document.createElement(url ? "a" : "div");
      wrapper.className = "message__attachment";
      if (url) {
        wrapper.href = url;
        wrapper.target = "_blank";
        wrapper.rel = "noopener noreferrer";
      }
      const icon = document.createElement("span");
      icon.className = "message__attachment-icon";
      icon.textContent = type === "image" ? "IMG" : "FILE";

      const body = document.createElement("div");
      body.className = "message__attachment-body";
      const title = document.createElement("p");
      title.className = "message__attachment-title";
      title.textContent = name;
      const size = document.createElement("p");
      size.className = "message__attachment-size";
      size.textContent = sizeLabel || "";
      body.appendChild(title);
      if (size.textContent) {
        body.appendChild(size);
      }

      wrapper.appendChild(icon);
      wrapper.appendChild(body);
      return wrapper;
    };

    messages.forEach((message) => {
      const messageItem = document.createElement("li");
      const incoming = message.senderId !== currentUserId;
      messageItem.className = `message ${incoming ? "incoming" : "outgoing"}`;
      messageItem.dataset.messageId = message.id;
      messageItem.dataset.senderId = message.senderId;

      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      const textContent = (message.content || "").trim();
      if (textContent || attachments.length === 0) {
        const content = document.createElement("p");
        content.className = "message__content";
        content.textContent = textContent;
        messageItem.appendChild(content);
      }

      if (attachments.length) {
        const attachmentsContainer = document.createElement("div");
        attachmentsContainer.className = "message__attachments";
        attachments.forEach((attachment) => {
          const node = createAttachmentNode(attachment);
          if (node) {
            attachmentsContainer.appendChild(node);
          }
        });
        if (attachmentsContainer.childElementCount) {
          messageItem.appendChild(attachmentsContainer);
        }
      }

      const meta = document.createElement("div");
      meta.className = "message__meta";
      const sentAt = new Date(message.sentAt);
      const timeSpan = document.createElement("span");
      timeSpan.textContent = sentAt.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit"
      });
      meta.appendChild(timeSpan);
      if (!incoming) {
        const statusWrapper = document.createElement("span");
        statusWrapper.className = "message__status";
        if (message.status === "read") {
          statusWrapper.classList.add("is-read");
        }
        statusWrapper.innerHTML = '<span class="tick">&#10003;</span><span class="tick">&#10003;</span>';
        meta.appendChild(statusWrapper);
      }
      if (message.editedAt) {
        const editedTag = document.createElement("span");
        editedTag.className = "message__edited";
        editedTag.textContent = "Editado";
        meta.appendChild(editedTag);
      }
      if (message.status === "sending") {
        const sendingTag = document.createElement("span");
        sendingTag.className = "message__edited";
        sendingTag.textContent = "Enviando…";
        meta.appendChild(sendingTag);
      }

      messageItem.appendChild(meta);
      if (!incoming) {
        const actions = document.createElement("div");
        actions.className = "message__actions";
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "message__action";
        editButton.textContent = "Editar";
        editButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          promptEditMessage(message.id);
        });
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "message__action message__action--danger";
        deleteButton.textContent = "Eliminar";
        deleteButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          requestMessageDeletion(message.id);
        });
        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        messageItem.appendChild(actions);
      }
      fragment.appendChild(messageItem);
    });

    refs.messageList.appendChild(fragment);
    refs.messageList.scrollTop = refs.messageList.scrollHeight;
  };

  const getMessageFromCache = (conversationId, messageId) => {
    if (!conversationId || !messageId) {
      return null;
    }
    const cache = messagesCache.get(conversationId);
    if (!cache) {
      return null;
    }
    return cache.find((item) => item.id === messageId) || null;
  };

  const applyEditedMessage = (message) => {
    if (!message || !message.conversationId) {
      return;
    }
    const cache = messagesCache.get(message.conversationId);
    if (cache) {
      const index = cache.findIndex((item) => item.id === message.id);
      if (index !== -1) {
        cache[index] = {
          ...cache[index],
          ...message,
          editedAt: message.editedAt || cache[index].editedAt || new Date().toISOString()
        };
        messagesCache.set(message.conversationId, cache);
      }
    }
    if (activeConversationId === message.conversationId) {
      renderMessages(activeConversationId);
    }
    const conversation = conversations.find((item) => item.id === message.conversationId);
    if (conversation && conversation.lastMessage?.messageId === message.id) {
      conversation.lastMessage = {
        ...conversation.lastMessage,
        content: message.content,
        sentAt: message.sentAt,
        senderId: message.senderId,
        messageId: message.id
      };
      renderConversationList(refs.searchInput.value || "");
    }
  };

  const applyDeletedMessage = (payload) => {
    if (!payload || !payload.conversationId || (!payload.id && !payload.clientRequestId)) {
      return;
    }
    const cache = messagesCache.get(payload.conversationId);
    if (cache) {
      const index = cache.findIndex(
        (item) => item.id === payload.id || (payload.clientRequestId && item.clientRequestId === payload.clientRequestId)
      );
      if (index !== -1) {
        cache.splice(index, 1);
        messagesCache.set(payload.conversationId, cache);
      }
    }
    if (activeConversationId === payload.conversationId) {
      renderMessages(activeConversationId);
    }
    fetchConversations().catch(() => {});
  };

  const removeConversationLocally = (conversationId) => {
    if (!conversationId) {
      return;
    }
    hideContextMenus();
    conversations = conversations.filter((conversation) => conversation.id !== conversationId);
    messagesCache.delete(conversationId);
    if (activeConversationId === conversationId) {
      activeConversationId = null;
      showConversationPlaceholder();
      if (refs.messageList) {
        refs.messageList.innerHTML = "";
      }
      updateConversationActionsState();
      closeEditMessageDialog();
    }
    renderConversationList(refs.searchInput.value || "");
  };

  const removeOptimisticMessage = (conversationId, clientRequestId) => {
    if (!conversationId || !clientRequestId) {
      return;
    }
    const cache = messagesCache.get(conversationId);
    if (!cache) {
      return;
    }
    const index = cache.findIndex((item) => item.clientRequestId === clientRequestId);
    if (index !== -1) {
      cache.splice(index, 1);
      messagesCache.set(conversationId, cache);
      if (activeConversationId === conversationId) {
        renderMessages(conversationId);
      }
    }
  };

  const pruneDuplicateMessages = (conversationId, cache, messageId, skipIndex = -1) => {
    if (!conversationId || !cache || !messageId) {
      return false;
    }
    let removed = false;
    for (let i = cache.length - 1; i >= 0; i -= 1) {
      if (cache[i].id === messageId && i !== skipIndex) {
        cache.splice(i, 1);
        removed = true;
      }
    }
    if (removed) {
      messagesCache.set(conversationId, cache);
    }
    return removed;
  };

  const resolveOptimisticMessage = (conversationId, clientRequestId, realMessage) => {
    if (!conversationId || !clientRequestId || !realMessage) {
      return;
    }
    const cache = messagesCache.get(conversationId);
    if (!cache) {
      return;
    }
    const index = cache.findIndex((item) => item.clientRequestId === clientRequestId);
    if (index !== -1) {
      cache[index] = { ...realMessage, clientRequestId };
      messagesCache.set(conversationId, cache);
      pruneDuplicateMessages(conversationId, cache, realMessage.id, index);
      if (conversationId === activeConversationId) {
        renderMessages(conversationId);
      }
    }
  };

  const generateClientRequestId = () => {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const consumePendingConversation = () => {
    pendingConversationId = null;
    localStorage.removeItem(CONVERSATION_TARGET_KEY);
  };

  const dedupeDirectConversations = (items = []) => {
    const result = [];
    const seen = new Map();
    items.forEach((conversation) => {
      const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
      const others = participants.filter((id) => id && id !== currentUserId);
      const isDirect = others.length === 1;
      if (!isDirect) {
        result.push(conversation);
        return;
      }
      const key = others[0];
      const existingIndex = seen.get(key);
      if (existingIndex === undefined) {
        seen.set(key, result.length);
        result.push(conversation);
        return;
      }
      const existing = result[existingIndex];
      const prefer = conversation.id === activeConversationId ? conversation : existing;
      result[existingIndex] = prefer;
    });
    return result;
  };

  const updateLocalMessagesStatus = (conversationId, status = "read", recipientId = currentUserId) => {
    const cache = messagesCache.get(conversationId);
    if (!cache) {
      return;
    }
    let mutated = false;
    cache.forEach((message) => {
      if (message.recipientId === recipientId && message.status !== status) {
        message.status = status;
        if (status === "read") {
          message.readAt = message.readAt || new Date().toISOString();
        }
        mutated = true;
      }
    });
    if (mutated) {
      messagesCache.set(conversationId, cache);
      if (activeConversationId === conversationId) {
        renderMessages(activeConversationId);
      }
    }
  };

  const openConversation = async (conversationId) => {
    if (!conversationId) {
      return;
    }
    hideContextMenus();
    closeEditMessageDialog();
    activeConversationId = conversationId;
    hideChatFeedback();
    updateConversationActionsState();
    showConversationWorkspace();
    clearPendingAttachments();

    conversations = conversations.map((conversation) => {
      if (conversation.id === conversationId) {
        return { ...conversation, unreadCounts: { ...conversation.unreadCounts, [currentUserId]: 0 } };
      }
      return conversation;
    });

    const activeConversation = conversations.find((conversation) => conversation.id === conversationId);
    const recipient = getRecipientFromConversation(activeConversation);
    const displayName = resolveDisplayName(recipient, activeConversation);
    refs.activeConversationName.textContent = displayName;
    const lastUpdated = activeConversation?.updatedAt
      ? new Date(activeConversation.updatedAt).toLocaleString("es-ES")
      : "Sin actividad";
    refs.activeConversationMeta.textContent = `Último movimiento: ${lastUpdated}`;

    renderConversationList(refs.searchInput.value || "");

    if (!messagesCache.has(conversationId)) {
      const response = await buildFallbackFetch(
        `/conversations/${conversationId}/messages?limit=50&order=asc`
      );
      messagesCache.set(
        conversationId,
        (response.items || []).map(normalizeMessage).filter(Boolean)
      );
    }
    renderMessages(conversationId);
    await markConversationAsRead(conversationId);
  };

  const fetchConversations = async () => {
    const response = await buildFallbackFetch(`/conversations?usuarioId=${currentUserId}`);
    conversations = (response.data || response || [])
      .map(normalizeConversation)
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || 0).getTime();
        const bTime = new Date(b.updatedAt || 0).getTime();
        return bTime - aTime;
      });
    conversations = dedupeDirectConversations(conversations);
    conversations.forEach((conversation) => {
      const participantMeta = conversation.metadata?.participants || {};
      const avatarMeta = conversation.metadata?.avatars || {};
      Object.entries(participantMeta).forEach(([id, name]) => rememberContact(id, name, avatarMeta[id] ?? null));
    });
    renderConversationList(refs.searchInput.value || "");
    if (activeConversationId) {
      const stillExists = conversations.some((conversation) => conversation.id === activeConversationId);
      if (!stillExists) {
        activeConversationId = null;
        showConversationPlaceholder();
        updateConversationActionsState();
        hideChatFeedback();
      }
    }
    if (!activeConversationId && pendingConversationId) {
      const pending = conversations.find((conversation) => conversation.id === pendingConversationId);
      if (pending) {
        openConversation(pendingConversationId);
        consumePendingConversation();
      } else {
        consumePendingConversation();
      }
    }
  };

  const markConversationAsRead = async (conversationId) => {
    try {
      await buildFallbackFetch(`/conversations/${conversationId}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectorId: currentUserId })
      });
      updateLocalMessagesStatus(conversationId, "read", currentUserId);
    } catch (_error) {
      // El microservicio ya hará retry cuando llegue un nuevo mensaje.
    }
  };

  const clearComposer = () => {
    if (refs.messageInput) {
      refs.messageInput.value = "";
    }
    clearPendingAttachments();
  };

  const uploadPendingAttachments = async () => {
    if (!pendingAttachments.length) {
      return [];
    }
    const formData = new FormData();
    pendingAttachments.forEach((file) => formData.append("files", file, file.name));
    const response = await buildFallbackFetch("/uploads/attachments", {
      method: "POST",
      body: formData
    });
    const payload = response?.data || response?.attachments || response;
    if (!Array.isArray(payload)) {
      throw new Error("No se pudieron subir los adjuntos.");
    }
    return payload;
  };

  const sendMessage = async (content, attachments = []) => {
    const conversation = conversations.find((item) => item.id === activeConversationId);
    if (!conversation) {
      return;
    }
    const recipientId = getRecipientFromConversation(conversation);
    if (!recipientId) {
      return;
    }

    const clientRequestId = generateClientRequestId();
    const senderAlias = getCurrentUserDisplayName();
    const recipientAlias = resolveDisplayName(recipientId, conversation);
    const senderAvatarSource = currentUser?.foto || contacts[currentUserId]?.avatarSource || null;
    const recipientAvatarSource =
      conversation?.metadata?.avatars?.[recipientId] || contacts[recipientId]?.avatarSource || null;
    const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
    const trimmedContent = (content || "").trim();

    const payload = {
      remitenteId: currentUserId,
      destinatarioId: recipientId,
      conversacionId: conversation.id,
      adjuntos: normalizedAttachments,
      metadatos: {
        participants: {
          [currentUserId]: senderAlias,
          [recipientId]: recipientAlias || contacts[recipientId]?.alias || recipientId,
        },
        avatars: {
          [currentUserId]: senderAvatarSource,
          [recipientId]: recipientAvatarSource,
        },
        clientRequestId
      },
    };
    if (trimmedContent) {
      payload.contenido = trimmedContent;
    }

    const optimisticMessage = {
      id: clientRequestId,
      clientRequestId,
      conversationId: conversation.id,
      senderId: currentUserId,
      recipientId,
      content: trimmedContent,
      attachments: normalizedAttachments,
      status: "sending",
      sentAt: new Date().toISOString(),
      metadata: { clientRequestId }
    };
    const existing = messagesCache.get(conversation.id) || [];
    existing.push(optimisticMessage);
    messagesCache.set(conversation.id, existing);
    renderMessages(conversation.id);

    try {
      const response = await buildFallbackFetch("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response?.data) {
        resolveOptimisticMessage(conversation.id, clientRequestId, normalizeMessage(response.data));
        rememberContact(recipientId, recipientAlias || selectedProfessional?.nombreCompleto, recipientAvatarSource);
      }
    } catch (error) {
      removeOptimisticMessage(conversation.id, clientRequestId);
      showChatFeedback(error.message || "No se pudo enviar el mensaje.", "error");
    }
  };

  const handleComposerSubmit = async (event) => {
    if (event) {
      event.preventDefault();
    }
    if (isSendingMessage) {
      return;
    }
    const content = (refs.messageInput?.value || "").trim();
    const hasAttachments = pendingAttachments.length > 0;
    if (!content && !hasAttachments) {
      return;
    }
    isSendingMessage = true;
    setComposerDisabled(true);
    try {
      let uploaded = [];
      if (hasAttachments) {
        showChatFeedback("Subiendo adjuntos...", "info", 2200);
        uploaded = await uploadPendingAttachments();
      }
      await sendMessage(content, uploaded);
      clearComposer();
    } catch (error) {
      showChatFeedback(error.message || "No se pudo enviar el mensaje.", "error");
    } finally {
      isSendingMessage = false;
      setComposerDisabled(false);
    }
  };

  const deleteMessageFromConversation = async (messageId) => {
    if (!messageId) {
      return;
    }
    try {
      const response = await buildFallbackFetch(`/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitanteId: currentUserId
        })
      });
      const payload = normalizeMessage(response?.data || response) || response?.data || response;
      applyDeletedMessage(payload);
      showChatFeedback("Mensaje eliminado.", "success");
    } catch (error) {
      showChatFeedback(error.message || "No se pudo borrar el mensaje.", "error");
    }
  };

  const deleteConversationRemote = async (conversationId) => {
    if (!conversationId) {
      return;
    }
    try {
      await buildFallbackFetch(`/conversations/${conversationId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitanteId: currentUserId
        })
      });
      removeConversationLocally(conversationId);
      showChatFeedback("Conversación eliminada.", "success");
    } catch (error) {
      showChatFeedback(error.message || "No se pudo borrar la conversación.", "error");
    }
  };

  const requestMessageDeletion = async (messageId) => {
    if (!messageId) {
      return;
    }
    const confirmed = await openConfirmDialog({
      title: "Eliminar mensaje",
      message: "El mensaje se eliminará para todos los participantes.",
      confirmLabel: "Eliminar",
      variant: "danger"
    });
    if (confirmed) {
      deleteMessageFromConversation(messageId);
    }
  };

  const requestConversationDeletion = async (conversationId) => {
    if (!conversationId) {
      return;
    }
    const confirmed = await openConfirmDialog({
      title: "Eliminar conversación",
      message: "Se eliminarán todos los mensajes de la conversación para ambos participantes.",
      confirmLabel: "Eliminar",
      variant: "danger"
    });
    if (confirmed) {
      deleteConversationRemote(conversationId);
    }
  };

  const promptEditMessage = (messageId) => {
    openEditMessageDialog(messageId);
  };

  const handleEditMessageSubmit = async (event) => {
    event.preventDefault();
    if (!pendingEditMessageId || !activeConversationId) {
      closeEditMessageDialog();
      return;
    }
    const value = refs.editMessageInput?.value || "";
    const trimmed = value.trim();
    if (!trimmed) {
      if (refs.editMessageFeedback) {
        refs.editMessageFeedback.textContent = "El mensaje no puede quedar vacío.";
      }
      refs.editMessageInput?.focus();
      return;
    }
    const original = getMessageFromCache(activeConversationId, pendingEditMessageId);
    if (original && original.content && original.content.trim() === trimmed) {
      closeEditMessageDialog();
      return;
    }
    try {
      const response = await buildFallbackFetch(`/messages/${pendingEditMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editorId: currentUserId,
          contenido: trimmed
        })
      });
      const updated = normalizeMessage(response?.data || response);
      applyEditedMessage(updated);
      showChatFeedback("Mensaje actualizado.", "success");
      closeEditMessageDialog();
    } catch (error) {
      if (refs.editMessageFeedback) {
        refs.editMessageFeedback.textContent = error.message || "No se pudo editar el mensaje.";
      }
    }
  };

  const handleMessageMenuClick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const messageId = contextMenuState.messageId || refs.messageContextMenu?.dataset.messageId;
    hideContextMenus();
    if (!messageId) {
      return;
    }
    if (action === "edit") {
      promptEditMessage(messageId);
    } else if (action === "delete") {
      requestMessageDeletion(messageId);
    }
  };

  const handleConversationMenuClick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    const conversationId = contextMenuState.conversationId || refs.conversationContextMenu?.dataset.conversationId;
    hideContextMenus();
    if (!conversationId) {
      return;
    }
    if (action === "delete") {
      requestConversationDeletion(conversationId);
    }
  };

  const handleGlobalKeydown = (event) => {
    if (event.key === "Escape") {
      if (openContextMenu) {
        hideContextMenus();
        event.preventDefault();
      }
    }
  };

  const handleMessageUpdated = (message) => {
    applyEditedMessage(message);
  };

  const handleMessageDeleted = (payload) => {
    if (!payload) {
      return;
    }
    const normalized = normalizeMessage(payload);
    applyDeletedMessage({
      id: normalized?.id || payload.id || payload.messageId,
      conversationId: normalized?.conversationId || payload.conversationId
    });
  };

  const handleConversationDeleted = (payload) => {
    if (!payload?.conversationId) {
      return;
    }
    removeConversationLocally(payload.conversationId);
  };

  const handleIncomingMessage = (message) => {
    const normalized = normalizeMessage(message);
    if (!normalized || !normalized.conversationId) {
      return;
    }
    const existingConversation = conversations.find(
      (conversation) => conversation.id === normalized.conversationId
    );
    if (!existingConversation) {
      fetchConversations();
    } else {
      existingConversation.lastMessage = normalized;
      existingConversation.updatedAt = normalized.sentAt;
      if (normalized.senderId !== currentUserId) {
        const currentUnread = existingConversation.unreadCounts?.[currentUserId] || 0;
        existingConversation.unreadCounts[currentUserId] = currentUnread + 1;
        if (activeConversationId === normalized.conversationId) {
          existingConversation.unreadCounts[currentUserId] = 0;
        }
      }
    }

    const cache = messagesCache.get(normalized.conversationId) || [];
    if (normalized.metadata?.clientRequestId) {
      const optimisticIndex = cache.findIndex(
        (item) => item.clientRequestId === normalized.metadata.clientRequestId
      );
      if (optimisticIndex !== -1) {
        cache.splice(optimisticIndex, 1);
      }
    }
    const existingIndex = cache.findIndex((item) => item.id === normalized.id);
    if (existingIndex === -1) {
      cache.push(normalized);
    } else {
      cache[existingIndex] = normalized;
    }
    messagesCache.set(normalized.conversationId, cache);
    if (normalized.senderId !== currentUserId) {
      const alias = existingConversation
        ? resolveDisplayName(normalized.senderId, existingConversation)
        : contacts[normalized.senderId]?.alias;
      if (alias) {
        const avatarHint =
          normalized.metadata?.avatars?.[normalized.senderId] ||
          existingConversation?.metadata?.avatars?.[normalized.senderId] ||
          contacts[normalized.senderId]?.avatarSource ||
          null;
        rememberContact(normalized.senderId, alias, avatarHint);
      }
    }

    if (activeConversationId === normalized.conversationId) {
      renderMessages(activeConversationId);
      if (normalized.senderId !== currentUserId) {
        markConversationAsRead(normalized.conversationId);
      }
    }

    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    renderConversationList(refs.searchInput.value || "");
  };

  const handleMessageRead = (message) => {
    if (!message) {
      return;
    }
    const cache = messagesCache.get(message.conversationId);
    if (!cache) {
      return;
    }
    const index = cache.findIndex((item) => item.id === message.id);
    if (index !== -1) {
      cache[index] = message;
      messagesCache.set(message.conversationId, cache);
      if (activeConversationId === message.conversationId) {
        renderMessages(activeConversationId);
      }
    }
  };

  const connectSocket = () => {
    if (!window.io) {
      setSocketStatus("offline", "Sin Socket.IO");
      return;
    }
    if (socket) {
      socket.disconnect();
    }

    const socketBase = getSocketBase();
    window.__BIZIHOTZ_SOCKET_BASE__ = socketBase;
    console.info(`[Bizihotz] Socket: intentando conectar a ${socketBase}`);

    socket = window.io(socketBase, {
      // Intentamos con polling primero para evitar bloqueos de WebSocket en la red.
      transports: ["polling", "websocket"],
      auth: {
        userId: currentUserId
      }
    });

    socket.on("connect", () => {
      socketConnected = true;
      setSocketStatus("online", "Conectado");
    });

    socket.on("disconnect", () => {
      socketConnected = false;
      setSocketStatus("offline", "Reconectando.");
      attemptReconnect();
    });

    socket.on("connect_error", (err) => {
      socketConnected = false;
      const msg = err?.message || err?.stack || String(err || "Error de socket");
      console.warn("[Bizihotz] connect_error:", msg);
      setSocketStatus("offline", "Cambiando servidor.");
      advanceSocketCandidate();
      attemptReconnect(2000);
    });

    socket.on("message:new", handleIncomingMessage);
    socket.on("message:read", handleMessageRead);
    socket.on("conversation:read", (payload) => {
      if (payload?.conversationId) {
        updateLocalMessagesStatus(payload.conversationId, "read", payload.readerId);
      }
      fetchConversations();
    });
    socket.on("message:updated", handleMessageUpdated);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("conversation:deleted", handleConversationDeleted);
  };
const attemptReconnect = (delay = 5000) => {
    if (reconnectTimer) {
      return;
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!socketConnected) {
        connectSocket();
      }
    }, delay);
  };

  const handleRenameContact = async (event) => {
    event.preventDefault();
    const conversation = conversations.find((item) => item.id === activeConversationId);
    if (!conversation) {
      hideModal(refs.renameModal);
      return;
    }
    const recipientId = getRecipientFromConversation(conversation);
    const alias = refs.renameInput.value.trim();
    if (alias) {
      contacts[recipientId] = {
        alias,
        storedAt: new Date().toISOString()
      };
    } else {
      delete contacts[recipientId];
    }
    saveContacts();
    hideModal(refs.renameModal);
    renderConversationList(refs.searchInput.value || "");
    if (activeConversationId) {
      openConversation(activeConversationId);
    }
  };

  const bindEvents = () => {
    refs.backButton?.addEventListener("click", handleBackButtonClick);
    refs.searchInput?.addEventListener("input", (event) => {
      renderConversationList(event.target.value);
    });

    refs.composerForm?.addEventListener("submit", handleComposerSubmit);
    refs.messageInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.isComposing) {
          return;
        }
        event.preventDefault();
        if (typeof refs.composerForm?.requestSubmit === "function") {
          refs.composerForm.requestSubmit();
        } else {
          refs.composerForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
      }
    });
    refs.openAttachmentPicker?.addEventListener("click", requestAttachmentPicker);
    refs.attachmentInput?.addEventListener("change", handleAttachmentInputChange);

    refs.openNewChat?.addEventListener("click", () => {
      refs.newChatForm?.reset();
      refs.newChatFeedback.textContent = "";
      resetNewChatState();
      showModal(refs.newChatModal);
      refs.newChatSearch?.focus();
      loadProfessionals();
    });
    [refs.closeNewChat, refs.cancelNewChat].forEach((button) =>
      button?.addEventListener("click", () => {
        hideModal(refs.newChatModal);
        resetNewChatState();
      })
    );
    refs.newChatSearch?.addEventListener("input", handleNewChatSearchInput);
    refs.newChatForm?.addEventListener("submit", (event) => event.preventDefault());

    refs.renameContactBtn?.addEventListener("click", () => {
      if (!activeConversationId) {
        return;
      }
      const conversation = conversations.find((item) => item.id === activeConversationId);
      const recipientId = getRecipientFromConversation(conversation);
      refs.renameInput.value = resolveDisplayName(recipientId, conversation);
      showModal(refs.renameModal);
      refs.renameInput.focus();
    });
    [refs.closeRenameModal, refs.cancelRename].forEach((button) =>
      button?.addEventListener("click", () => hideModal(refs.renameModal))
    );
    refs.deleteConversationBtn?.addEventListener("click", () => {
      if (!activeConversationId) {
        return;
      }
      requestConversationDeletion(activeConversationId);
    });
    refs.renameForm?.addEventListener("submit", handleRenameContact);
    [refs.closeEditMessage, refs.cancelEditMessage].forEach((button) =>
      button?.addEventListener("click", closeEditMessageDialog)
    );
    refs.editMessageForm?.addEventListener("submit", handleEditMessageSubmit);
    refs.confirmAccept?.addEventListener("click", () => {
      hideModal(refs.confirmModal);
      resolvePendingConfirm(true);
    });
    [refs.closeConfirmModal, refs.confirmCancel].forEach((button) =>
      button?.addEventListener("click", closeConfirmDialog)
    );
    refs.messageContextMenu?.addEventListener("click", handleMessageMenuClick);
    refs.conversationContextMenu?.addEventListener("click", handleConversationMenuClick);
    document.addEventListener("click", handleGlobalPointer);
    document.addEventListener("scroll", hideContextMenus, true);
    window.addEventListener("resize", hideContextMenus);
    document.addEventListener("keydown", handleGlobalKeydown);
  };

  const handleGlobalPointer = (event) => {
  if (!event.target.closest(".context-menu")) {
    hideContextMenus();
  }
};


  const boot = async () => {
    ensureUser();
    loadContacts();
    pendingConversationId = localStorage.getItem(CONVERSATION_TARGET_KEY);
    bindEvents();
    await fetchConversations();
    preloadProfessionalContacts();
    connectSocket();
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
