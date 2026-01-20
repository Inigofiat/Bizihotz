"use strict";

(function () {
  const loginForm = document.getElementById("loginForm");
  const loginInput = document.getElementById("login");
  const passwordInput = document.getElementById("password");
  const loginMessage = document.getElementById("loginMessage");
  const loadingPagePath = "cargando.html";

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

  const resolveLoginEndpoints = () => {
    const bases = buildGestionBases();
    return bases.map((base) => `${base}/api/auth/login`);
  };

  const LOGIN_ENDPOINTS = resolveLoginEndpoints();

  if (!loginForm || !loginInput || !passwordInput || !loginMessage) {
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
