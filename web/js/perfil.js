"use strict";

const API_BASE_URL = (() => {
  const gatewayBase = "http://localhost:5000/gestion";

  if (window.location.protocol === "file:") {
    return gatewayBase;
  }

  const host = window.location.hostname || "localhost";

  if (host === "localhost" || host === "127.0.0.1") {
    return gatewayBase;
  }

  return `${window.location.protocol}//${window.location.host}/gestion`;
})();

const API_FALLBACK_URL = null;

const API_URL = `${API_BASE_URL}/api`;
const API_FALLBACK = null;
const LOGIN_PAGE = "login.html";
const DEFAULT_AVATAR_URL = "../images/avatar-default.svg";
const getAvatarFileName = (path = "") =>
  path ? path.replace(/\\/g, "/").split("/").pop() : "";
const getStoredAvatarName = () => localStorage.getItem("perfil_avatar_nombre") || "";

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
  const nombre = localStorage.getItem("perfil_nombre") ?? usuarioActual?.nombre ?? "";
  const apellidos =
    localStorage.getItem("perfil_apellidos") ?? usuarioActual?.apellidos ?? "";
  const telefono =
    localStorage.getItem("perfil_telefono") ?? usuarioActual?.telefono ?? "";
  const email = localStorage.getItem("perfil_email") ?? usuarioActual?.email ?? "";
  const nombreUsuario =
    localStorage.getItem("perfil_nombreUsuario") ?? usuarioActual?.nombreUsuario ?? "";
  const rol = localStorage.getItem("perfil_rol") ?? usuarioActual?.rol ?? "";

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
  const rol = document.getElementById("inputRol").value.trim();

  if (!nombre || !apellidos) {
    alert("Nombre y apellidos son obligatorios.");
    return;
  }

  localStorage.setItem("perfil_nombre", nombre);
  localStorage.setItem("perfil_apellidos", apellidos);
  localStorage.setItem("perfil_telefono", telefono);
  localStorage.setItem("perfil_email", email);
  localStorage.setItem("perfil_nombreUsuario", nombreUsuario);
  localStorage.setItem("perfil_rol", rol);

  actualizarUsuarioLocal({ nombre, apellidos, telefono, email, nombreUsuario, rol });
  try {
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
      const response = await fetch(endpoint, { method: "DELETE" });
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

    feedback.textContent = "Contraseña actualizada correctamente.";
    feedback.classList.add("success");

    setTimeout(() => {
      cerrarModal("modalContrasena");
      alert("Contraseña actualizada correctamente.");
    }, 700);
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

if (avatarInput) {
  avatarInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      avatarPreviewTemporal = e.target.result;
      setAvatarImage(avatarNode, avatarPreviewTemporal);
    };
    avatarArchivoPendiente = file;
    actualizarNombreArchivoAvatar(file.name);
    actualizarEstadoEliminarAvatar();
    reader.readAsDataURL(file);
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
