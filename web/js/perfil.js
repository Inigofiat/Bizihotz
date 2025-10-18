"use strict";

function abrirModal(id) {
  document.getElementById(id).style.display = "flex";
}

function cerrarModal(id) {
  document.getElementById(id).style.display = "none";
}

function guardarPerfil(e) {
  e.preventDefault();
  const nombre = document.getElementById("inputNombre").value.trim();
  const apellidos = document.getElementById("inputApellidos").value.trim();
  const telefono = document.getElementById("inputTelefono").value.trim();

  document.getElementById("profileName").textContent = `${nombre} ${apellidos}`;
  document.getElementById("profileInfo").innerHTML = `
    <p><span class="label">Nombre:</span> <span class="value">${nombre}</span></p>
    <p><span class="label">Apellidos:</span> <span class="value">${apellidos}</span></p>
    <p><span class="label">Teléfono:</span> <span class="value">${telefono}</span></p>
    <p><span class="label">Rol:</span> <span class="value">nutricionista</span></p>
    <p><span class="label">Nombre de usuario:</span> <span class="value">inigofiat</span></p>
  `;

  localStorage.setItem("perfil_nombre", nombre);
  localStorage.setItem("perfil_apellidos", apellidos);
  localStorage.setItem("perfil_telefono", telefono);

  cerrarModal("modalEditar");
  alert("Perfil actualizado correctamente.");
}

function guardarContrasena(e) {
  e.preventDefault();
  const current = document.getElementById("currentPassword").value.trim();
  const nueva = document.getElementById("newPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();
  const feedback = document.getElementById("passwordFeedback");

  if (current !== "123456") {
    feedback.textContent = "La contraseña actual es incorrecta.";
    feedback.classList.remove("success");
    return;
  }
  if (nueva.length < 6) {
    feedback.textContent = "La nueva contraseña debe tener al menos 6 caracteres.";
    feedback.classList.remove("success");
    return;
  }
  if (nueva !== confirm) {
    feedback.textContent = "Las contraseñas no coinciden.";
    feedback.classList.remove("success");
    return;
  }

  feedback.textContent = "Contraseña actualizada correctamente.";
  feedback.classList.add("success");
  setTimeout(() => {
    cerrarModal("modalContrasena");
    alert("¡Contraseña cambiada! 🔐");
  }, 800);
}

// SVG del ojo
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

// Asociar toggles
document.querySelectorAll('.togglePassword').forEach(btn => {
  const inputId = btn.getAttribute('data-input');
  const input = document.getElementById(inputId);
  const svg = btn.querySelector('svg');

  setEyeClosed(svg);

  btn.addEventListener('click', () => {
    const showing = input.type === 'password';
    input.type = showing ? 'text' : 'password';
    showing ? setEyeOpen(svg) : setEyeClosed(svg);
  });
});

// Avatar upload
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

// Cargar datos almacenados
window.addEventListener("DOMContentLoaded", () => {
  const nombre = localStorage.getItem("perfil_nombre");
  const apellidos = localStorage.getItem("perfil_apellidos");
  const telefono = localStorage.getItem("perfil_telefono");
  const avatar = localStorage.getItem("perfil_avatar");

  if (nombre && apellidos) {
    document.getElementById("profileName").textContent = `${nombre} ${apellidos}`;
    document.getElementById("profileInfo").innerHTML = `
      <p><span class="label">Nombre:</span> <span class="value">${nombre}</span></p>
      <p><span class="label">Apellidos:</span> <span class="value">${apellidos}</span></p>
      <p><span class="label">Teléfono:</span> <span class="value">${telefono}</span></p>
      <p><span class="label">Rol:</span> <span class="value">nutricionista</span></p>
      <p><span class="label">Nombre de usuario:</span> <span class="value">inigofiat</span></p>
    `;
    document.getElementById("inputNombre").value = nombre;
    document.getElementById("inputApellidos").value = apellidos;
    document.getElementById("inputTelefono").value = telefono;
  }

  if (avatar) {
    document.getElementById("avatarImage").src = avatar;
  }
});
