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

const API_FALLBACK_URL =
  window.location.protocol === "file:" || window.location.hostname === "localhost"
    ? "http://localhost:4002"
    : null;

const API_URL = `${API_BASE_URL}/api`;
const API_FALLBACK = API_FALLBACK_URL ? `${API_FALLBACK_URL}/api` : null;
const LOGIN_PAGE = "login.html";

let usuarioActual = null;

function abrirModal(id) {
  document.getElementById(id).style.display = "flex";
}

function cerrarModal(id) {
  document.getElementById(id).style.display = "none";
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

const actualizarPerfilUI = () => {
  const nombre = localStorage.getItem("perfil_nombre") ?? usuarioActual?.nombre ?? "";
  const apellidos =
    localStorage.getItem("perfil_apellidos") ?? usuarioActual?.apellidos ?? "";
  const telefono =
    localStorage.getItem("perfil_telefono") ?? usuarioActual?.telefono ?? "";

  if (nombre && apellidos) {
    document.getElementById("profileName").textContent = `${nombre} ${apellidos}`;
  } else if (usuarioActual?.nombreUsuario) {
    document.getElementById("profileName").textContent = usuarioActual.nombreUsuario;
  }

  document.getElementById("profileInfo").innerHTML = `
    <p><span class="label">Nombre:</span> <span class="value">${nombre || "-"}</span></p>
    <p><span class="label">Apellidos:</span> <span class="value">${apellidos || "-"}</span></p>
    <p><span class="label">Telefono:</span> <span class="value">${telefono || "-"}</span></p>
    <p><span class="label">Rol:</span> <span class="value">${usuarioActual?.rol || "-"}</span></p>
    <p><span class="label">Nombre de usuario:</span> <span class="value">${
      usuarioActual?.nombreUsuario || "-"
    }</span></p>
    <p><span class="label">Email:</span> <span class="value">${usuarioActual?.email || "-"}</span></p>
  `;

  document.getElementById("inputNombre").value = nombre;
  document.getElementById("inputApellidos").value = apellidos;
  document.getElementById("inputTelefono").value = telefono;
};

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

function guardarPerfil(event) {
  event.preventDefault();

  const nombre = document.getElementById("inputNombre").value.trim();
  const apellidos = document.getElementById("inputApellidos").value.trim();
  const telefono = document.getElementById("inputTelefono").value.trim();

  if (!nombre || !apellidos) {
    alert("Nombre y apellidos son obligatorios.");
    return;
  }

  localStorage.setItem("perfil_nombre", nombre);
  localStorage.setItem("perfil_apellidos", apellidos);
  localStorage.setItem("perfil_telefono", telefono);

  actualizarUsuarioLocal({ nombre, apellidos, telefono });
  actualizarPerfilUI();

  cerrarModal("modalEditar");
  alert("Perfil actualizado correctamente.");
}

async function guardarContrasena(event) {
  event.preventDefault();

  const current = document.getElementById("currentPassword").value.trim();
  const nueva = document.getElementById("newPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();
  const feedback = document.getElementById("passwordFeedback");

  feedback.textContent = "";
  feedback.classList.remove("success");

  if (!usuarioActual) {
    feedback.textContent = "Sesion no valida. Vuelve a iniciar sesion.";
    return;
  }

  if (!current || !nueva || !confirm) {
    feedback.textContent = "Completa todos los campos.";
    return;
  }

  if (nueva.length < 8) {
    feedback.textContent = "La nueva contrasena debe tener al menos 8 caracteres.";
    return;
  }

  if (nueva !== confirm) {
    feedback.textContent = "Las contrasenas no coinciden.";
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
      throw new Error(data.mensaje || "No se pudo cambiar la contrasena.");
    }

    actualizarUsuarioLocal({
      debeActualizarPassword: false,
      ultimoCambioPassword: new Date().toISOString()
    });

    feedback.textContent = "Contrasena actualizada correctamente.";
    feedback.classList.add("success");

    setTimeout(() => {
      cerrarModal("modalContrasena");
      alert("Contrasena actualizada correctamente.");
    }, 700);
  } catch (error) {
    console.warn("Error actualizando contrasena:", error);
    feedback.textContent = error.message || "No se pudo cambiar la contrasena.";
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

document.getElementById("avatarInput").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById("avatarImage").src = e.target.result;
    localStorage.setItem("perfil_avatar", e.target.result);
  };
  reader.readAsDataURL(file);
});

window.addEventListener("DOMContentLoaded", () => {
  const user = cargarUsuario();
  if (!user) {
    return;
  }

  const avatar = localStorage.getItem("perfil_avatar");
  if (avatar) {
    document.getElementById("avatarImage").src = avatar;
  }
});
