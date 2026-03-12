"use strict";

(function () {
  const LOGIN_PAGE = "login.html";
  const usersTable = document.getElementById("usersTable");
  const listFeedback = document.getElementById("listFeedback");
  const form = document.getElementById("createForm");
  const formFeedback = document.getElementById("formFeedback");
  const logoutBtn = document.getElementById("logoutBtn");
  const confirmOverlay = document.getElementById("confirmOverlay");
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmAccept = document.getElementById("confirmAccept");
  const confirmCancel = document.getElementById("confirmCancel");

  const hideConfirm = () => {
    if (confirmOverlay) {
      confirmOverlay.hidden = true;
      confirmOverlay.setAttribute("aria-hidden", "true");
    }
    if (confirmAccept) confirmAccept.onclick = null;
    if (confirmCancel) confirmCancel.onclick = null;
  };

  const showConfirm = (message, acceptLabel = "Aceptar") => {
    return new Promise((resolve) => {
      if (!confirmOverlay || !confirmMessage || !confirmAccept || !confirmCancel) {
        const fallback = window.confirm(message);
        resolve(fallback);
        return;
      }
      confirmMessage.textContent = message;
      confirmAccept.textContent = acceptLabel;
      confirmOverlay.hidden = false;
      confirmOverlay.setAttribute("aria-hidden", "false");

      const cleanup = (result) => {
        hideConfirm();
        resolve(result);
      };

      confirmAccept.onclick = () => cleanup(true);
      confirmCancel.onclick = () => cleanup(false);
    });
  };

  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem("bizihotzUsuario") || "null");
    } catch (_e) {
      return null;
    }
  };

  const ensureAdmin = () => {
    const user = getStoredUser();
    if (!user || !user.token) {
      window.location.href = LOGIN_PAGE;
      return null;
    }
    if ((user.rolSistema || "").toLowerCase() !== "administrador") {
      window.location.href = "principal.html";
      return null;
    }
    return user;
  };

  const currentUser = ensureAdmin();
  if (!currentUser) return;

  const buildGestionBase = () => {
    const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
    const hostname = (window.location.hostname || "localhost").toLowerCase();
    const port = window.location.port;
    const isLocal = !hostname || hostname === "localhost" || hostname === "127.0.0.1";
    const targetHost = isLocal ? "localhost" : hostname;
    if (port && (port === "5000" || port === "4002")) {
      return `${protocol}//${targetHost}:${port}`;
    }
    return `${protocol}//${targetHost}:4002`;
  };

  const API_BASE = `${buildGestionBase()}/api`;

  const setFeedback = (node, msg, isError = true) => {
    if (!node) return;
    node.textContent = msg || "";
    node.style.color = isError ? "#dc2626" : "#16a34a";
  };

  const badgeFor = (rolSistema = "") => {
    const val = rolSistema.toLowerCase();
    if (val === "administrador") return `<span class="badge badge-admin">Administrador</span>`;
    if (val === "recepcionista") return `<span class="badge badge-recep">Recepcionista</span>`;
    return `<span class="badge badge-prof">Profesional</span>`;
  };

  const renderUsers = (users = []) => {
    const sorted = [...users].sort((a, b) => {
      const aKey = (a.nombreUsuario || a.email || "").toLowerCase();
      const bKey = (b.nombreUsuario || b.email || "").toLowerCase();
      return aKey.localeCompare(bKey, "es", { sensitivity: "base" });
    });
    if (!usersTable) return;
    usersTable.innerHTML = sorted
      .map((u) => {
        const activo = u.activo !== false;
        const btnClass = activo ? "btn btn-outline btn-danger" : "btn btn-primary";
        const btnLabel = activo ? "Desactivar" : "Activar";
        return `<tr>
          <td>${u.nombreUsuario || ""}</td>
          <td>${u.email || ""}</td>
          <td>${badgeFor(u.rolSistema)}</td>
          <td>${u.rol || ""}</td>
          <td>${activo ? "Activo" : "Baja"}</td>
          <td class="actions">
            <button class="${btnClass}" data-id="${u.idUsuario}" data-action="toggle">${btnLabel}</button>
          </td>
        </tr>`;
      })
      .join("");
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/usuarios?limit=50`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      const data = await res.json();
      renderUsers(data.data || data || []);
      setFeedback(listFeedback, "");
    } catch (err) {
      setFeedback(listFeedback, err.message || "No se pudieron cargar los profesionales");
    }
  };

  const toggleUser = async (id, currentLabel) => {
    const activar = currentLabel === "Activar";
    const confirmed = await showConfirm(
      `¿Estas seguro de que deseas ${activar ? "activar" : "desactivar"} este usuario?`,
      activar ? "Sí, activar" : "Sí, desactivar"
    );
    if (!confirmed) return;
    await fetch(`${API_BASE}/usuarios/${id}/estado`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({ activo: activar })
    });
    fetchUsers();
  };

  if (usersTable) {
    usersTable.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { id, action } = btn.dataset;
      if (action === "toggle") {
        toggleUser(id, btn.textContent.trim()).catch((err) =>
          setFeedback(listFeedback, err.message || "Error actualizando estado")
        );
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setFeedback(formFeedback, "");
      const payload = {
        nombreUsuario: document.getElementById("nombreUsuario").value.trim(),
        email: document.getElementById("email").value.trim().toLowerCase(),
        password: document.getElementById("password").value,
        rol: document.getElementById("rol").value.trim() || "Nutricionista",
        rolSistema: document.getElementById("rolSistema").value.trim()
      };
      if (!payload.nombreUsuario || !payload.email || !payload.password) {
        setFeedback(formFeedback, "Completa usuario, email y contraseña.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/usuarios`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentUser.token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback(formFeedback, data?.mensaje || "No se pudo crear.");
          return;
        }
        setFeedback(formFeedback, "Usuario creado correctamente.", false);
        form.reset();
        fetchUsers();
      } catch (err) {
        setFeedback(formFeedback, err.message || "Error al crear usuario.");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      const confirmed = await showConfirm("¿Estas seguro de que deseas cerrar sesión?", "Sí, cerrar sesión");
      if (!confirmed) return;
      localStorage.removeItem("bizihotzUsuario");
      window.location.href = LOGIN_PAGE;
    });
  }

  if (confirmOverlay) {
    // Ocultamos explícitamente en la carga inicial.
    confirmOverlay.hidden = true;
    confirmOverlay.setAttribute("aria-hidden", "true");
    confirmOverlay.addEventListener("click", (e) => {
      if (e.target === confirmOverlay) {
        hideConfirm();
      }
    });
  }

  fetchUsers();
})();
