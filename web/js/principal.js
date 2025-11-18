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
const DEFAULT_AVATAR_URL = "../images/avatar-default.svg";

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

let statusMenu = null;
let statusMenuTrigger = null;

let usuarioActual = null;

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
        headers: {
          "Content-Type": "application/json"
        },
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
};

const handleGlobalKeydown = (event) => {
  if (event.key === "Escape") {
    const trigger = statusMenuTrigger;
    closeStatusMenu();
    trigger?.focus();
  }
};

const handleGlobalScroll = () => {
  closeStatusMenu();
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

  try {
    const res = await fetch(primaryUrl).catch((error) => {
      if (fallbackUrl) {
        return fetch(fallbackUrl);
      }
      throw error;
    });
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
            const respuestaAlternativa = await fetch(url);
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
      if (citaId) {
        fila.dataset.citaId = citaId;
      }

      const horaCell = document.createElement("td");
      horaCell.textContent = cita.hora ? String(cita.hora) : "--:--";
      fila.appendChild(horaCell);

      const pacienteCell = document.createElement("td");
      pacienteCell.textContent = cita.paciente ? String(cita.paciente) : "Sin nombre";
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
      method: "POST"
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


  PerfilModal.prepararModalPerfil(handleLogout, {
    getUsuarioActual: () => usuarioActual,
    actualizarUsuarioLocal,
    obtenerNombreVisible,
    apiUrl: API_URL,
    apiFallback: API_FALLBACK
  });

  if (user?.debeActualizarPassword) {
    window.location.href = "perfil.html?force=1";
    return;
  }
});
