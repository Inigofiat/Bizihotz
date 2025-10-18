"use strict";

const API_BASE_URL = (() => {
  const gatewayBase = "http://localhost:5000/gestion";
  const localFallback = "http://localhost:4002";

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
    nameNode.textContent = user.nombreUsuario || user.nombre || "Usuario";
  }

  if (locationNode) {
    locationNode.textContent = user.rol ? `Rol: ${user.rol}` : "-";
  }

  return user;
};

const cargarCitas = async () => {
  const tbody = document.querySelector("#appointmentsTable tbody");

  if (!tbody) {
    return;
  }

  try {
    const res = await fetch(`${API_URL}/citas`).catch((error) => {
      if (API_FALLBACK) {
        return fetch(`${API_FALLBACK}/citas`);
      }
      throw error;
    });
    if (!res.ok) {
      throw new Error(`Estado inesperado ${res.status}`);
    }

    const citas = await res.json();
    tbody.innerHTML = "";

    if (!Array.isArray(citas) || citas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No hay citas disponibles</td></tr>`;
      return;
    }

    citas.forEach((cita) => {
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${cita.hora || "--:--"}</td>
        <td>${cita.paciente || "Sin nombre"}</td>
        <td>${cita.motivo || "Sin motivo"}</td>
        <td class="${(cita.estado || "pendiente").toLowerCase()}">${cita.estado || "Pendiente"}</td>
      `;
      tbody.appendChild(fila);
    });
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

const setupVisibilityToggle = (button) => {
  const target = document.getElementById(button.dataset.target);
  if (!target) {
    return;
  }

  button.addEventListener("click", () => {
    const showing = target.type === "text";
    target.type = showing ? "password" : "text";
    button.textContent = showing ? "Mostrar" : "Ocultar";
  });
};

const prepararModalPerfil = (handleLogout) => {
  const modal = document.getElementById("profileModal");
  const profileBtn = document.getElementById("profileBtn");
  const closeProfile = document.getElementById("closeProfile");
  const closeProfileModal = document.getElementById("closeProfileModal");
  const passwordForm = document.getElementById("passwordForm");
  const cancelPasswordChange = document.getElementById("cancelPasswordChange");
  const passwordFeedback = document.getElementById("passwordFeedback");
  const currentPassword = document.getElementById("currentPassword");
  const newPassword = document.getElementById("newPassword");
  const confirmPassword = document.getElementById("confirmPassword");
  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const profilePhone = document.getElementById("profilePhone");
  const profileRole = document.getElementById("profileRole");
  const profileStatus = document.getElementById("profilePasswordStatus");
  const startPasswordChange = document.getElementById("startPasswordChange");

  if (
    !modal ||
    !profileBtn ||
    !closeProfile ||
    !closeProfileModal ||
    !passwordForm ||
    !cancelPasswordChange ||
    !passwordFeedback ||
    !currentPassword ||
    !newPassword ||
    !confirmPassword ||
    !profileName ||
    !profileEmail ||
    !profilePhone ||
    !profileRole ||
    !profileStatus ||
    !startPasswordChange
  ) {
    return { mostrar: () => {}, ocultar: () => {} };
  }

  modal.querySelectorAll(".visibility-toggle").forEach(setupVisibilityToggle);
  passwordForm.hidden = true;

  const state = { forced: false };

  const resetForm = () => {
    passwordForm.reset();
    passwordFeedback.textContent = "";
    passwordFeedback.classList.remove("is-success");
  };

  const rellenarResumen = () => {
    if (!usuarioActual) {
      profileName.textContent = "-";
      profileEmail.textContent = "-";
      profilePhone.textContent = "-";
      profileRole.textContent = "-";
      profileStatus.textContent = "";
      return;
    }

    profileName.textContent = usuarioActual.nombreUsuario || "-";
    profileEmail.textContent = usuarioActual.email || "-";
    profilePhone.textContent = usuarioActual.telefono || "-";
    profileRole.textContent = usuarioActual.rol || "-";

    if (usuarioActual.debeActualizarPassword) {
      profileStatus.textContent = "Debes actualizar tu contraseña.";
    } else if (usuarioActual.ultimoCambioPassword) {
      profileStatus.textContent = `Ultimo cambio: ${new Date(
        usuarioActual.ultimoCambioPassword
      ).toLocaleDateString("es-ES")}`;
    } else {
      profileStatus.textContent = "Contraseña confirmada.";
    }
  };

  const mostrarFormulario = () => {
    passwordForm.hidden = false;
    currentPassword.focus();
  };

  const mostrar = (forzado = false) => {
    if (!usuarioActual) {
      return;
    }

    if (!forzado) {
      window.location.href = "perfil.html";
      return;
    }

    if (!modal) {
      window.location.href = "perfil.html?force=1";
      return;
    }

    state.forced = true;
    modal.dataset.forzado = "1";
    resetForm();
    rellenarResumen();

    passwordForm.hidden = false;
    cancelPasswordChange.style.display = "none";
    closeProfile.style.display = "none";

    modal.style.display = "flex";
    mostrarFormulario();
  };

  const ocultar = () => {
    modal.style.display = "none";
  };

  const cerrarModal = () => {
    if (state.forced) {
      handleLogout();
    } else {
      ocultar();
    }
  };

  profileBtn.addEventListener("click", () => mostrar(false));
  closeProfile.addEventListener("click", cerrarModal);
  closeProfileModal.addEventListener("click", cerrarModal);

  startPasswordChange.addEventListener("click", () => {
    mostrarFormulario();
  });

  cancelPasswordChange.addEventListener("click", () => {
    if (state.forced) {
      handleLogout();
    } else {
      passwordForm.hidden = true;
      passwordFeedback.textContent = "";
    }
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!usuarioActual) {
      passwordFeedback.textContent = "Sesión no valida. Vuelve a iniciar sesión.";
      return;
    }

    const actual = currentPassword.value.trim();
    const nueva = newPassword.value.trim();
    const confirmacion = confirmPassword.value.trim();

    if (!actual || !nueva || !confirmacion) {
      passwordFeedback.textContent = "Completa todos los campos.";
      return;
    }

    if (nueva.length < 8) {
      passwordFeedback.textContent = "La nueva contraseña debe tener al menos 8 caracteres.";
      return;
    }

    if (nueva !== confirmacion) {
      passwordFeedback.textContent = "Las contraseñas nuevas no coinciden.";
      return;
    }

    try {
      const requestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: usuarioActual.email,
          passwordActual: actual,
          passwordNueva: nueva
        })
      };

      const response = await fetch(`${API_URL}/auth/cambiar-password`, requestInit).catch(
        async (error) => {
          if (!API_FALLBACK) {
            throw error;
          }
          return fetch(`${API_FALLBACK}/auth/cambiar-password`, requestInit);
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.mensaje || "No se pudo cambiar la contraseña.");
      }

      actualizarUsuarioLocal({
        debeActualizarPassword: false,
        ultimoCambioPassword: new Date().toISOString()
      });

      passwordFeedback.textContent = "Contraseña actualizada correctamente.";
      passwordFeedback.classList.add("is-success");
      setTimeout(() => {
        ocultar();
        alert("Contraseña actualizada correctamente.");
      }, 800);
    } catch (error) {
      console.warn("Error actualizando contraseña:", error);
      passwordFeedback.textContent = error.message || "No se pudo cambiar la contraseña.";
      passwordFeedback.classList.remove("is-success");
    } finally {
      passwordForm.reset();
      passwordForm.hidden = true;
    }
  });

  return { mostrar, ocultar };
};

document.addEventListener("DOMContentLoaded", () => {
  const handleLogout = prepararLogoutModal();
  const user = cargarUsuario();
  cargarCitas();

  const profileModalControl = prepararModalPerfil(handleLogout);

  if (user?.debeActualizarPassword) {
    window.location.href = "perfil.html?force=1";
    return;
  }
});
