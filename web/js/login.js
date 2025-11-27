"use strict";

(function () {
  const loginForm = document.getElementById("loginForm");
  const loginInput = document.getElementById("login");
  const passwordInput = document.getElementById("password");
  const loginMessage = document.getElementById("loginMessage");
  const loadingPagePath = "cargando.html";

  const resolveLoginEndpoints = () => {
    const host = (window.location.hostname || "").toLowerCase();
    const gatewayBase =
      window.location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === ""
        ? "http://localhost:5000/gestion"
        : `${window.location.protocol}//${window.location.hostname}/gestion`;
    return [`${gatewayBase}/api/auth/login`];
  };

  const LOGIN_ENDPOINTS = resolveLoginEndpoints();

  if (!loginForm || !loginInput || !passwordInput || !loginMessage) {
    return;
  }

  if (!document.referrer && history.length <= 1) {
    window.location.replace(loadingPagePath);
    return;
  }

  const resetMessage = () => {
    loginMessage.textContent = "";
    loginMessage.classList.remove("is-error");
    loginMessage.classList.remove("is-success");
  };

  const showMessage = (text, isError = true) => {
    loginMessage.textContent = text;
    loginMessage.classList.toggle("is-error", isError);
    loginMessage.classList.toggle("is-success", !isError);
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const loginValueRaw = loginInput.value.trim();
    const password = passwordInput.value.trim();

    if (!loginValueRaw || !password) {
      showMessage("Indica email o nombre de usuario y contrasena.", true);
      return;
    }

    const isEmail = loginValueRaw.includes("@");
    const loginValue = isEmail ? loginValueRaw.toLowerCase() : loginValueRaw;
    const payload = isEmail
      ? { email: loginValue, password }
      : { identificador: loginValue, password };
    const payloadJson = JSON.stringify(payload);

    let lastNetworkError = null;
    let lastMessage = "No se pudo contactar con el servidor. Intentalo mas tarde.";

    for (let index = 0; index < LOGIN_ENDPOINTS.length; index += 1) {
      const endpoint = LOGIN_ENDPOINTS[index];
      const isLast = index === LOGIN_ENDPOINTS.length - 1;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: payloadJson
        });

        const rawText = await response.text();
        let data = null;
        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch (parseError) {
          if (!isLast) {
            continue;
          }
        }

        if (!response.ok) {
          const mensaje = data?.mensaje || lastMessage || "Credenciales incorrectas.";
          lastMessage = mensaje;
          if (!isLast) {
            continue;
          }
          showMessage(mensaje, true);
          return;
        }

        if (data?.usuario) {
          try {
            const userToStore = {
              ...data.usuario,
              token: data.token || data.usuario?.token || ""
            };
            localStorage.setItem("bizihotzUsuario", JSON.stringify(userToStore));
          } catch (storageError) {
            console.warn("No se pudo guardar la sesion en localStorage:", storageError);
          }
        }

        showMessage("Bienvenido, redirigiendo...", false);
        window.location.href = "principal.html";
        return;
      } catch (error) {
        lastNetworkError = error;
        if (isLast) {
          console.error("Error iniciando sesion:", error);
          showMessage(lastMessage, true);
          return;
        }
      }
    }

    if (lastNetworkError) {
      console.error("Error iniciando sesion:", lastNetworkError);
    }
    showMessage(lastMessage, true);
  });

  loginForm.addEventListener("input", () => {
    if (loginMessage.textContent) {
      resetMessage();
    }
  });
})();
