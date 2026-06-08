(function (global) {
  const noop = () => {};

  const setupVisibilityToggle = (button) => {
    const targetId = button?.dataset?.target;
    if (!targetId) {
      return;
    }
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    button.addEventListener("click", () => {
      const isPassword = target.type === "password";
      target.type = isPassword ? "text" : "password";
      button.classList.toggle("is-visible", isPassword);
    });
  };

  const prepararModalPerfil = (handleLogout, options = {}) => {
    const getUsuarioActual =
      typeof options.getUsuarioActual === "function" ? options.getUsuarioActual : () => null;
    const actualizarUsuarioLocal =
      typeof options.actualizarUsuarioLocal === "function" ? options.actualizarUsuarioLocal : noop;
    const obtenerNombreVisible =
      typeof options.obtenerNombreVisible === "function" ? options.obtenerNombreVisible : () => "";
    const apiUrl = options.apiUrl || "";
    const apiFallback = options.apiFallback || "";

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
      !profileRole ||
      !profileStatus ||
      !startPasswordChange
    ) {
      return { mostrar: noop, ocultar: noop };
    }

    modal.querySelectorAll(".visibility-toggle").forEach(setupVisibilityToggle);
    passwordForm.hidden = true;

    const state = { forced: false };
    const cleanUiMessage = (message, fallback = "") => {
      const raw = String(message || "").trim();
      if (!raw) {
        return fallback;
      }
      const cleaned = raw
        .replace(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s"']*)?/gi, "el servidor")
        .replace(/\b(?:localhost|127\.0\.0\.1)(?::\d+)?\b/gi, "el servidor")
        .replace(/\s+/g, " ")
        .trim();
      return cleaned || fallback;
    };

    const resetFeedback = () => {
      passwordFeedback.textContent = "";
      passwordFeedback.classList.remove("is-success", "is-error");
    };

    const resetForm = () => {
      passwordForm.reset();
      resetFeedback();
    };

    const rellenarResumen = () => {
      const usuario = getUsuarioActual();
      if (!usuario) {
        profileName.textContent = "-";
        profileEmail.textContent = "-";
        profilePhone.textContent = "-";
        profileRole.textContent = "-";
        profileStatus.textContent = "";
        return;
      }
      profileName.textContent = obtenerNombreVisible(usuario) || "-";
      profileEmail.textContent = usuario.email || "-";
      profilePhone.textContent = usuario.telefono || "-";
      profileRole.textContent = usuario.rol || "-";

      if (usuario.debeActualizarCont) {
        profileStatus.textContent = "Debes actualizar tu contraseña.";
      } else if (usuario.ultimoCambioCont) {
        const fecha = new Date(usuario.ultimoCambioCont);
        profileStatus.textContent = `Último cambio: ${fecha.toLocaleDateString("es-ES")}`;
      } else {
        profileStatus.textContent = "Contraseña revisada.";
      }
    };

    const mostrarFormulario = () => {
      passwordForm.hidden = false;
      currentPassword.focus();
    };

    const mostrar = (forzado = false) => {
      const usuario = getUsuarioActual();
      if (!usuario) return;
      if (!forzado) {
        window.location.href = "perfil.html";
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
      state.forced = false;
      modal.dataset.forzado = "0";
      cancelPasswordChange.style.display = "";
      closeProfile.style.display = "";
      resetForm();
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
      passwordForm.hidden = false;
      cancelPasswordChange.style.display = "";
      closeProfile.style.display = "";
      resetForm();
      mostrarFormulario();
    });

    cancelPasswordChange.addEventListener("click", () => {
      if (state.forced) {
        handleLogout();
      } else {
        passwordForm.hidden = true;
        resetFeedback();
      }
    });

    passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const usuario = getUsuarioActual();
      if (!usuario) {
        passwordFeedback.textContent = "Sesión no válida. Vuelve a iniciar sesión.";
        passwordFeedback.classList.add("is-error");
        return;
      }

      const actual = currentPassword.value.trim();
      const nueva = newPassword.value.trim();
      const confirmacion = confirmPassword.value.trim();

      resetFeedback();

      if (!actual || !nueva || !confirmacion) {
        passwordFeedback.textContent = "Completa todos los campos.";
        passwordFeedback.classList.add("is-error");
        return;
      }
      if (nueva.length < 8) {
        passwordFeedback.textContent = "La nueva contraseña debe tener al menos 8 caracteres.";
        passwordFeedback.classList.add("is-error");
        return;
      }
      if (nueva !== confirmacion) {
        passwordFeedback.textContent = "Las contraseñas nuevas no coinciden.";
        passwordFeedback.classList.add("is-error");
        return;
      }

      if (!apiUrl) {
        passwordFeedback.textContent = "No se pudo enviar la solicitud. Falta la configuración de API.";
        passwordFeedback.classList.add("is-error");
        return;
      }

      try {
        const requestInit = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: usuario.email,
            passwordActual: actual,
            passwordNueva: nueva
          })
        };

        let response = await fetch(`${apiUrl}/auth/cambiar-password`, requestInit);
        if (!response.ok && apiFallback) {
          response = await fetch(`${apiFallback}/auth/cambiar-password`, requestInit);
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.mensaje || "No se pudo cambiar la contraseña.");
        }

        actualizarUsuarioLocal({
          debeActualizarCont: false,
          ultimoCambioCont: new Date().toISOString()
        });

        passwordFeedback.textContent = "Contraseña actualizada correctamente.";
        passwordFeedback.classList.add("is-success");
        setTimeout(() => {
          ocultar();
        }, 800);
      } catch (error) {
        console.warn("Error actualizando contraseña:", error);
        passwordFeedback.textContent = cleanUiMessage(
          error?.message,
          "No se pudo cambiar la contraseña."
        );
        passwordFeedback.classList.add("is-error");
      } finally {
        passwordForm.reset();
        passwordForm.hidden = true;
      }
    });

    return { mostrar, ocultar };
  };

  global.PerfilModal = {
    prepararModalPerfil
  };
})(window);
