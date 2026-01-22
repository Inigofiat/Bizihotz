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
const DEFAULT_AVATAR_URL = "../images/avatar-default.svg";
const getAvatarFileName = (path = "") =>
  path ? path.replace(/\\/g, "/").split("/").pop() : "";
const getStoredAvatarName = () => localStorage.getItem("perfil_avatar_nombre") || "";
const logoutAndRedirect = async (mensaje) => {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", headers: buildAuthHeaders() }).catch(
      async () => {
        if (!API_FALLBACK) return undefined;
        return fetch(`${API_FALLBACK}/auth/logout`, { method: "POST", headers: buildAuthHeaders() });
      }
    );
  } catch (error) {
    console.warn("No se pudo notificar logout al servidor:", error);
  } finally {
    localStorage.removeItem("bizihotzUsuario");
    if (mensaje) {
      alert(mensaje);
    }
    window.location.href = LOGIN_PAGE;
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
    throw new Error("Sesion no valida. Inicia sesion de nuevo.");
  }
  return token;
};

const buildAuthHeaders = (baseHeaders = {}) => {
  const headers = Object.assign({ Accept: "application/json" }, baseHeaders || {});
  try {
    const token = resolveTokenOrRedirect();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn(error?.message || "Sesion no valida");
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

let usuarioActual = null;
let avatarArchivoPendiente = null;
let avatarPreviewTemporal = null;

function abrirModal(id) {
  document.getElementById(id).style.display = "flex";
}

function cerrarModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "none";
  }
  if (id === "modalEditar") {
    avatarArchivoPendiente = null;
    avatarPreviewTemporal = null;
    if (avatarInput) {
      avatarInput.value = "";
    }
    if (typeof closeCropModal === "function") {
      closeCropModal(false);
    }
    if (usuarioActual) {
      actualizarPerfilUI();
    }
  }
}

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

const actualizarUsuarioLocal = (parciales = {}) => {
  if (!usuarioActual) {
    return;
  }
  usuarioActual = { ...usuarioActual, ...parciales };
  localStorage.setItem("bizihotzUsuario", JSON.stringify(usuarioActual));
};

function actualizarPerfilUI() {
  const nombre = usuarioActual?.nombre ?? "";
  const apellidos = usuarioActual?.apellidos ?? "";
  const telefono = usuarioActual?.telefono ?? "";
  const email = usuarioActual?.email ?? "";
  const nombreUsuario = usuarioActual?.nombreUsuario ?? "";
  const rol = usuarioActual?.rol ?? "";

  const visibleName = [nombre, apellidos].filter(Boolean).join(" ").trim() || nombreUsuario;

  if (visibleName) {
    document.getElementById("profileName").textContent = visibleName;
  } else if (usuarioActual?.email) {
    document.getElementById("profileName").textContent = usuarioActual.email;
  } else {
    document.getElementById("profileName").textContent = "Usuario";
  }

  document.getElementById("profileInfo").innerHTML = `
    <p><span class="label">Nombre:</span> <span class="value">${nombre || "-"}</span></p>
    <p><span class="label">Apellidos:</span> <span class="value">${apellidos || "-"}</span></p>
    <p><span class="label">Telefono:</span> <span class="value">${telefono || "-"}</span></p>
    <p><span class="label">Rol:</span> <span class="value">${rol || "-"}</span></p>
    <p><span class="label">Nombre de usuario:</span> <span class="value">${
      nombreUsuario || "-"
    }</span></p>
    <p><span class="label">Email:</span> <span class="value">${email || "-"}</span></p>
  `;

  document.getElementById("inputNombre").value = nombre;
  document.getElementById("inputApellidos").value = apellidos;
  document.getElementById("inputTelefono").value = telefono;
  document.getElementById("inputEmail").value = email;
  document.getElementById("inputNombreUsuario").value = nombreUsuario;
  document.getElementById("inputRol").value = rol;
  document.getElementById("inputRol").setAttribute("disabled", "true");
  document.getElementById("inputRol").setAttribute("aria-disabled", "true");
  const avatarImageNode = document.getElementById("avatarImage");
  const fotoActual = usuarioActual?.foto ?? "";
  const avatarSrc = avatarPreviewTemporal ?? buildAvatarSrc(fotoActual);
  setAvatarImage(avatarImageNode, avatarSrc);
  const storedName =
    avatarArchivoPendiente?.name ??
    getStoredAvatarName() ??
    getAvatarFileName(fotoActual);
  actualizarNombreArchivoAvatar(storedName);
  actualizarEstadoEliminarAvatar();
}

const cargarUsuario = () => {
  const user = getStoredUser();
  if (!user) {
    window.location.href = LOGIN_PAGE;
    return null;
  }
  usuarioActual = user;
  actualizarPerfilUI();
  return user;
};

async function guardarPerfil(event) {
  event.preventDefault();

  const nombre = document.getElementById("inputNombre").value.trim();
  const apellidos = document.getElementById("inputApellidos").value.trim();
  const telefono = document.getElementById("inputTelefono").value.trim();
  const email = document.getElementById("inputEmail").value.trim().toLowerCase();
  const nombreUsuario = document.getElementById("inputNombreUsuario").value.trim();
  // El rol no se edita desde el perfil: se conserva el actual del usuario.
  const rol = usuarioActual?.rol ?? "";

  if (!nombre || !apellidos) {
    alert("Nombre y apellidos son obligatorios.");
    return;
  }

  try {
    const perfilActualizado = await actualizarPerfilRemoto({
      nombre,
      apellidos,
      telefono,
      email,
      nombreUsuario,
      // rol no se envía, el backend ignora cambios de rol
    });
    const usuarioDesdeServidor = perfilActualizado?.usuario;
    if (usuarioDesdeServidor) {
      actualizarUsuarioLocal(usuarioDesdeServidor);
    } else {
      actualizarUsuarioLocal({ nombre, apellidos, telefono, email, nombreUsuario });
    }

    if (avatarArchivoPendiente) {
      const resultado = await subirAvatar(avatarArchivoPendiente);
      const fotoUrl = resultado?.fotoUrl ?? resultado?.foto ?? "";
      if (fotoUrl) {
        actualizarUsuarioLocal({ foto: fotoUrl });
      }
      localStorage.setItem("perfil_avatar_nombre", avatarArchivoPendiente.name);
      avatarArchivoPendiente = null;
      avatarPreviewTemporal = null;
      if (avatarInput) {
        avatarInput.value = "";
      }
    }
  } catch (error) {
    console.error("Error subiendo avatar:", error);
    alert(error.message || "No se pudo actualizar la foto de perfil.");
    return;
  }

  actualizarPerfilUI();

  cerrarModal("modalEditar");
  alert("Perfil actualizado correctamente.");
}

const subirAvatar = async (file) => {
  const endpoints = [`${API_URL}/usuarios/${usuarioActual.idUsuario}/avatar`];
  if (API_FALLBACK) {
    endpoints.push(`${API_FALLBACK}/usuarios/${usuarioActual.idUsuario}/avatar`);
  }

  let lastError = null;

  for (const endpoint of endpoints) {
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: buildAuthHeaders(),
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.mensaje || `Error subiendo avatar (${response.status}).`);
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No se pudo subir la foto de perfil.");
};

const eliminarAvatar = async () => {
  const endpoints = [`${API_URL}/usuarios/${usuarioActual.idUsuario}/avatar`];
  if (API_FALLBACK) {
    endpoints.push(`${API_FALLBACK}/usuarios/${usuarioActual.idUsuario}/avatar`);
  }

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { method: "DELETE", headers: buildAuthHeaders() });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.mensaje || `Error eliminando avatar (${response.status}).`);
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No se pudo eliminar la foto de perfil.");
};

const actualizarPerfilRemoto = async (payload = {}) => {
  const endpoints = [`${API_URL}/usuarios/${usuarioActual.idUsuario}`];
  if (API_FALLBACK) {
    endpoints.push(`${API_FALLBACK}/usuarios/${usuarioActual.idUsuario}`);
  }

  const body = JSON.stringify(payload);
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.mensaje || `No se pudo actualizar el perfil (${response.status}).`);
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No se pudo actualizar el perfil.");
};

async function guardarContrasena(event) {
  event.preventDefault();

  const current = document.getElementById("currentPassword").value.trim();
  const nueva = document.getElementById("newPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();
  const feedback = document.getElementById("passwordFeedback");

  feedback.textContent = "";
  feedback.classList.remove("success");

  if (!usuarioActual) {
    feedback.textContent = "Sesión no valida. Vuelve a iniciar sesión.";
    return;
  }

  if (!current || !nueva || !confirm) {
    feedback.textContent = "Completa todos los campos.";
    return;
  }

  if (nueva.length < 8) {
    feedback.textContent = "La nueva contraseña debe tener al menos 8 caracteres.";
    return;
  }

  if (nueva !== confirm) {
    feedback.textContent = "Las contraseñas no coinciden.";
    return;
  }

  const requestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: usuarioActual.email,
      passwordActual: current,
      passwordNueva: nueva
    })
  };

  try {
    let response = await fetch(`${API_URL}/auth/cambiar-password`, requestInit);
    if (!response.ok && API_FALLBACK) {
      response = await fetch(`${API_FALLBACK}/auth/cambiar-password`, requestInit);
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.mensaje || "No se pudo cambiar la contraseña.");
    }

    actualizarUsuarioLocal({
      debeActualizarPassword: false,
      ultimoCambioPassword: new Date().toISOString()
    });

    feedback.textContent = "Contraseña actualizada correctamente. Cerrando sesión...";
    feedback.classList.add("success");
    await logoutAndRedirect("Contraseña actualizada. Vuelve a iniciar sesión.");
  } catch (error) {
    console.warn("Error actualizando contraseña:", error);
    feedback.textContent = error.message || "No se pudo cambiar la contraseña.";
    feedback.classList.remove("success");
  } finally {
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
  }
}

const eyePath = `
  <path d="M12 5C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 11
           a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
`;

function setEyeClosed(svg) {
  svg.innerHTML = eyePath;
}

function setEyeOpen(svg) {
  svg.innerHTML = `
    ${eyePath}
    <line x1="4" y1="4" x2="20" y2="20"
      stroke="#666" stroke-width="2" stroke-linecap="round"/>
  `;
}

document.querySelectorAll(".togglePassword").forEach((btn) => {
  const inputId = btn.getAttribute("data-input");
  const input = document.getElementById(inputId);
  const svg = btn.querySelector("svg");

  setEyeClosed(svg);

  btn.addEventListener("click", () => {
    const showing = input.type === "password";
    input.type = showing ? "text" : "password";
    showing ? setEyeOpen(svg) : setEyeClosed(svg);
  });
});

const avatarInput = document.getElementById("avatarInput");
const avatarButton = document.getElementById("btnSelectAvatar");
const avatarFilename = document.getElementById("avatarFilename");
const removeAvatarButton = document.getElementById("btnRemoveAvatar");
const avatarNode = document.getElementById("avatarImage");
const cropModal = document.getElementById("cropModal");
const cropImage = document.getElementById("cropImage");
const cropZoom = document.getElementById("cropZoom");
const cropViewport = document.getElementById("cropViewport");
const closeCropModalButton = document.getElementById("closeCropModal");
const cancelCropButton = document.getElementById("cancelCrop");
const applyCropButton = document.getElementById("applyCrop");

const CROP_CANVAS_SIZE = 480;
const cropState = {
  image: null,
  originalName: "",
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  minScale: 1,
  maxScale: 3,
  startX: 0,
  startY: 0,
  dragging: false,
  viewportSize: 260
};

function actualizarNombreArchivoAvatar(nombre) {
  if (avatarFilename) {
    avatarFilename.textContent = nombre || "Ningun archivo seleccionado";
  }
}

function actualizarEstadoEliminarAvatar() {
  if (!removeAvatarButton) {
    return;
  }
  const nombreAlmacenado = getStoredAvatarName();
  const tieneFotoGuardada = Boolean(usuarioActual?.foto);
  const hayPendiente = Boolean(
    avatarPreviewTemporal || avatarArchivoPendiente || nombreAlmacenado
  );
  removeAvatarButton.disabled = !(tieneFotoGuardada || hayPendiente);
}

if (avatarButton && avatarInput) {
  avatarButton.addEventListener("click", () => avatarInput.click());
}

const getViewportSize = () => {
  if (!cropViewport) {
    return cropState.viewportSize;
  }
  const rect = cropViewport.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  cropState.viewportSize = size || cropState.viewportSize;
  return cropState.viewportSize;
};

const clampCropOffsets = () => {
  if (!cropState.image) return;
  const size = getViewportSize();
  const scaledWidth = cropState.image.naturalWidth * cropState.scale;
  const scaledHeight = cropState.image.naturalHeight * cropState.scale;
  const maxOffsetX = Math.max(0, (scaledWidth - size) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - size) / 2);
  cropState.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, cropState.offsetX));
  cropState.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, cropState.offsetY));
};

const applyCropTransform = () => {
  if (!cropImage || !cropState.image) return;
  clampCropOffsets();
  cropImage.style.transform = `translate(calc(-50% + ${cropState.offsetX}px), calc(-50% + ${cropState.offsetY}px)) scale(${cropState.scale})`;
};

const closeCropModal = (resetInput = true) => {
  if (cropModal) {
    cropModal.style.display = "none";
  }
  cropState.image = null;
  cropState.dragging = false;
  if (resetInput && avatarInput) {
    avatarInput.value = "";
  }
  if (cropViewport) {
    cropViewport.classList.remove("is-dragging");
  }
};

const openCropModal = (dataUrl, fileName = "avatar.jpg") => {
  if (!cropModal || !cropImage || !cropZoom) {
    return;
  }
  const img = new Image();
  cropState.originalName = fileName;
  img.onload = () => {
    cropState.image = img;
    const size = getViewportSize();
    const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    cropState.minScale = baseScale;
    cropState.maxScale = baseScale * 3;
    cropState.scale = baseScale;
    cropState.offsetX = 0;
    cropState.offsetY = 0;
    cropZoom.min = cropState.minScale.toFixed(2);
    cropZoom.max = cropState.maxScale.toFixed(2);
    cropZoom.step = "0.01";
    cropZoom.value = cropState.scale.toFixed(2);
    applyCropTransform();
    cropModal.style.display = "flex";
  };
  img.src = dataUrl;
  cropImage.src = dataUrl;
};

const startCropDrag = (clientX, clientY) => {
  cropState.dragging = true;
  cropState.startX = clientX;
  cropState.startY = clientY;
  cropViewport?.classList.add("is-dragging");
};

const moveCropDrag = (clientX, clientY) => {
  if (!cropState.dragging) return;
  const dx = clientX - cropState.startX;
  const dy = clientY - cropState.startY;
  cropState.startX = clientX;
  cropState.startY = clientY;
  cropState.offsetX += dx;
  cropState.offsetY += dy;
  applyCropTransform();
};

const endCropDrag = () => {
  cropState.dragging = false;
  cropViewport?.classList.remove("is-dragging");
};

const producirAvatarRecortado = async () => {
  if (!cropState.image) {
    throw new Error("No hay ninguna imagen cargada para recortar.");
  }
  const viewportSize = getViewportSize();
  const scale = cropState.scale;
  const scaledWidth = cropState.image.naturalWidth * scale;
  const scaledHeight = cropState.image.naturalHeight * scale;
  const originX = (viewportSize - scaledWidth) / 2 + cropState.offsetX;
  const originY = (viewportSize - scaledHeight) / 2 + cropState.offsetY;
  const sx = Math.max(0, -originX / scale);
  const sy = Math.max(0, -originY / scale);
  const sWidth = viewportSize / scale;
  const sHeight = viewportSize / scale;

  const canvas = document.createElement("canvas");
  canvas.width = CROP_CANVAS_SIZE;
  canvas.height = CROP_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, CROP_CANVAS_SIZE, CROP_CANVAS_SIZE);
  ctx.drawImage(
    cropState.image,
    sx,
    sy,
    sWidth,
    sHeight,
    0,
    0,
    CROP_CANVAS_SIZE,
    CROP_CANVAS_SIZE
  );

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blobResult) => {
        if (blobResult) return resolve(blobResult);
        reject(new Error("No se pudo generar la imagen recortada."));
      },
      "image/jpeg",
      0.9
    );
  });

  const baseName = (cropState.originalName || "avatar").split(".")[0] || "avatar";
  const file = new File([blob], `${baseName}-recortado.jpg`, { type: "image/jpeg" });
  return { file, preview: dataUrl };
};

if (avatarInput) {
  avatarInput.addEventListener("change", function () {
    const file = this.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      if (!e?.target?.result) return;
      openCropModal(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
  });
}

if (cropViewport) {
  cropViewport.addEventListener("mousedown", (event) => {
    event.preventDefault();
    startCropDrag(event.clientX, event.clientY);
  });
  cropViewport.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    startCropDrag(touch.clientX, touch.clientY);
  });
  window.addEventListener("mousemove", (event) => moveCropDrag(event.clientX, event.clientY));
  window.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    moveCropDrag(touch.clientX, touch.clientY);
  });
  window.addEventListener("mouseup", endCropDrag);
  window.addEventListener("touchend", endCropDrag);
}

if (cropZoom) {
  cropZoom.addEventListener("input", () => {
    const value = Number(cropZoom.value);
    if (Number.isNaN(value)) return;
    cropState.scale = Math.min(cropState.maxScale, Math.max(cropState.minScale, value));
    applyCropTransform();
  });
}

if (closeCropModalButton) {
  closeCropModalButton.addEventListener("click", () => closeCropModal());
}

if (cancelCropButton) {
  cancelCropButton.addEventListener("click", () => closeCropModal());
}

if (applyCropButton) {
  applyCropButton.addEventListener("click", async () => {
    try {
      const resultado = await producirAvatarRecortado();
      avatarArchivoPendiente = resultado.file;
      avatarPreviewTemporal = resultado.preview;
      setAvatarImage(avatarNode, avatarPreviewTemporal);
      actualizarNombreArchivoAvatar(resultado.file.name);
      actualizarEstadoEliminarAvatar();
      closeCropModal(false);
      if (avatarInput) {
        avatarInput.value = "";
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "No se pudo aplicar el recorte.");
    }
  });
}

if (removeAvatarButton) {
  removeAvatarButton.addEventListener("click", async () => {
    if (!usuarioActual) {
      alert("Inicia sesion de nuevo para modificar tu foto de perfil.");
      return;
    }

    if (avatarArchivoPendiente || avatarPreviewTemporal) {
      avatarArchivoPendiente = null;
      avatarPreviewTemporal = null;
      if (avatarInput) {
        avatarInput.value = "";
      }
      const fotoActual = usuarioActual?.foto ?? "";
      setAvatarImage(avatarNode, buildAvatarSrc(fotoActual));
      const nombreArchivo = getStoredAvatarName() || getAvatarFileName(fotoActual);
      actualizarNombreArchivoAvatar(nombreArchivo);
      actualizarEstadoEliminarAvatar();
      return;
    }

    const nombreAlmacenado = getStoredAvatarName();
    const tieneFotoEnServidor = Boolean(usuarioActual.foto);

    if (!tieneFotoEnServidor && !nombreAlmacenado) {
      actualizarEstadoEliminarAvatar();
      return;
    }

    const confirmar = window.confirm(
      "¿Quieres quitar tu foto de perfil y volver al avatar por defecto?"
    );
    if (!confirmar) return;

    const previousLabel = removeAvatarButton.textContent;
    removeAvatarButton.disabled = true;
    removeAvatarButton.textContent = "Quitando...";

    try {
      if (tieneFotoEnServidor) {
        await eliminarAvatar();
      } else {
        // No hay foto en servidor: limpia estado local igualmente
        localStorage.removeItem("perfil_avatar_nombre");
      }
      avatarArchivoPendiente = null;
      avatarPreviewTemporal = null;
      if (avatarInput) {
        avatarInput.value = "";
      }
      actualizarUsuarioLocal({ foto: "" });
      localStorage.removeItem("perfil_avatar_nombre");
      setAvatarImage(avatarNode, DEFAULT_AVATAR_URL);
      actualizarNombreArchivoAvatar("");
      actualizarEstadoEliminarAvatar();
      alert("Foto de perfil eliminada.");
    } catch (error) {
      alert(error.message || "No se pudo eliminar la foto de perfil.");
    } finally {
      removeAvatarButton.disabled = false;
      removeAvatarButton.textContent = previousLabel || "Quitar foto";
      actualizarEstadoEliminarAvatar();
    }
  });
}


const closePerfilPageButton = document.getElementById("closePerfilPage");

if (closePerfilPageButton) {
  closePerfilPageButton.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "principal.html";
    }
  });
}

const openEditProfileButton = document.getElementById("openEditProfile");
if (openEditProfileButton) {
  openEditProfileButton.addEventListener("click", () => abrirModal("modalEditar"));
}

const openPasswordModalButton = document.getElementById("openPasswordModal");
if (openPasswordModalButton) {
  openPasswordModalButton.addEventListener("click", () => abrirModal("modalContrasena"));
}

const closeModalEditarButton = document.getElementById("closeModalEditar");
if (closeModalEditarButton) {
  closeModalEditarButton.addEventListener("click", () => cerrarModal("modalEditar"));
}

const closeModalContrasenaButton = document.getElementById("closeModalContrasena");
if (closeModalContrasenaButton) {
  closeModalContrasenaButton.addEventListener("click", () => cerrarModal("modalContrasena"));
}

const formEditarPerfil = document.getElementById("formEditarPerfil");
if (formEditarPerfil) {
  formEditarPerfil.addEventListener("submit", (event) => {
    guardarPerfil(event);
  });
}

const formCambiarContrasena = document.getElementById("formCambiarContrasena");
if (formCambiarContrasena) {
  formCambiarContrasena.addEventListener("submit", (event) => {
    guardarContrasena(event);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const user = cargarUsuario();
  if (!user) {
    return;
  }

  avatarArchivoPendiente = null;
  avatarPreviewTemporal = null;

  const fotoActual = usuarioActual?.foto ?? "";
  const avatarNode = document.getElementById("avatarImage");
  setAvatarImage(avatarNode, buildAvatarSrc(fotoActual));

  const avatarNombre =
    getStoredAvatarName() || getAvatarFileName(fotoActual);
  actualizarNombreArchivoAvatar(avatarNombre);
  actualizarEstadoEliminarAvatar();
});
