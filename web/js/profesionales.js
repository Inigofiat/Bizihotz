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
  const searchInput = document.getElementById("searchInput");
  const estadoFilter = document.getElementById("estadoFilter");
  const rolFilter = document.getElementById("rolFilter");
  const rolSistemaFilter = document.getElementById("rolSistemaFilter");
  const totalCount = document.getElementById("totalCount");
  const refreshBtn = document.getElementById("refreshBtn");

  // Edit modal
  const editOverlay = document.getElementById("editOverlay");
  const editForm = document.getElementById("editForm");
  const editCancel = document.getElementById("editCancel");
  const editFeedback = document.getElementById("editFeedback");
  const editNombreUsuario = document.getElementById("editNombreUsuario");
  const editEmail = document.getElementById("editEmail");
  const editRol = document.getElementById("editRol");
  const editRolSistema = document.getElementById("editRolSistema");
  const resetOverlay = document.getElementById("resetOverlay");
  const resetForm = document.getElementById("resetForm");
  const resetCancel = document.getElementById("resetCancel");
  const resetFeedback = document.getElementById("resetFeedback");
  const resetPasswordInput = document.getElementById("resetPassword");
  const resetUserLabel = document.getElementById("resetUserLabel");

  let allUsers = [];
  let editingUserId = null;
  let resettingUserId = null;
  const state = {
    search: "",
    estado: "",
    rol: "",
    rolSistema: ""
  };

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

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const setTotal = (count) => {
    if (!totalCount) return;
    totalCount.textContent = `Total: ${count}`;
  };

  const populateRolFilter = (users = []) => {
    if (!rolFilter) return;
    const roles = Array.from(
      new Set(users.map((u) => (u.rol || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    const current = rolFilter.value;
    rolFilter.innerHTML = `<option value="">Rol: todos</option>` +
      roles.map((r) => `<option value="${r}">${r}</option>`).join("");
    if (roles.includes(current)) {
      rolFilter.value = current;
    }
  };

  const debounce = (fn, delay = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
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
        const rolSistema = u.rolSistema || "";
        return `<tr>
          <td>${u.nombreUsuario || ""}</td>
          <td>${u.email || ""}</td>
          <td>${badgeFor(rolSistema)}</td>
          <td>${u.rol || ""}</td>
          <td>${formatDate(u.ultimoAcceso)}</td>
          <td>${activo ? "Activo" : "Inactivo"}</td>
          <td class="actions">
            <label class="switch ${activo ? "" : "inactive"}" title="${activo ? "Activo" : "Inactivo"}">
              <input type="checkbox" data-id="${u.idUsuario}" data-action="toggle" aria-label="Cambiar estado de ${u.nombreUsuario || u.email || "profesional"}" ${activo ? "checked" : ""}>
              <span class="slider"></span>
            </label>
            <button class="btn btn-ghost" data-id="${u.idUsuario}" data-action="edit">Editar</button>
            <button class="btn btn-outline" data-id="${u.idUsuario}" data-action="reset">Resetear contraseña</button>
          </td>
        </tr>`;
      })
      .join("");
    setTotal(users.length);
  };

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "500");
      const trimmed = state.search.trim();
      if (trimmed.length >= 2) params.set("q", trimmed);
      if (state.estado) params.set("estado", state.estado);
      if (state.rol) params.set("rol", state.rol);
      if (state.rolSistema) params.set("rolSistema", state.rolSistema);

      const res = await fetch(`${API_BASE}/usuarios?${params.toString()}`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      const data = await res.json();
      const list = data.data || data || [];
      allUsers = Array.isArray(list) ? list : [];
      populateRolFilter(allUsers);
      renderUsers(allUsers);
      setFeedback(listFeedback, "");
    } catch (err) {
      setFeedback(listFeedback, err.message || "No se pudieron cargar los profesionales");
    }
  };

  const toggleUser = async (id, activo, controlEl, { skipConfirm = false } = {}) => {
    if (!id) return;
    if (!skipConfirm && !activo) {
      const confirmed = await showConfirm("¿Seguro que deseas desactivar este profesional?", "Sí, desactivar");
      if (!confirmed) {
        if (controlEl) controlEl.checked = !activo;
        return;
      }
    }
    try {
      await fetch(`${API_BASE}/usuarios/${id}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ activo })
      });
      fetchUsers();
    } catch (err) {
      if (controlEl) controlEl.checked = !activo;
      setFeedback(listFeedback, err.message || "Error actualizando estado");
    }
  };

  const findUser = (id) => allUsers.find((u) => String(u.idUsuario) === String(id));

  const openEdit = (user) => {
    if (!user || !editOverlay) return;
    editingUserId = user.idUsuario;
    editNombreUsuario.value = user.nombreUsuario || '';
    editEmail.value = user.email || '';
    editRol.value = user.rol || '';
    editRolSistema.value = user.rolSistema || 'Profesional del centro';
    setFeedback(editFeedback, '');
    editOverlay.hidden = false;
    editOverlay.setAttribute('aria-hidden', 'false');
  };

  const closeEdit = () => {
    editingUserId = null;
    if (editOverlay) {
      editOverlay.hidden = true;
      editOverlay.setAttribute('aria-hidden', 'true');
    }
  };

  const openReset = (user) => {
    if (!user || !resetOverlay || !resetForm || !resetPasswordInput) return;
    resettingUserId = user.idUsuario;
    resetForm.reset();
    setFeedback(resetFeedback, "");
    if (resetUserLabel) {
      resetUserLabel.textContent = user.nombreUsuario || user.email || "";
    }
    resetOverlay.hidden = false;
    resetOverlay.setAttribute("aria-hidden", "false");
    setTimeout(() => resetPasswordInput.focus(), 0);
  };

  const closeReset = () => {
    resettingUserId = null;
    if (resetForm) resetForm.reset();
    setFeedback(resetFeedback, "");
    if (resetOverlay) {
      resetOverlay.hidden = true;
      resetOverlay.setAttribute("aria-hidden", "true");
    }
  };

  const submitResetPassword = async (id, nuevaPassword) => {
    if (!id) return false;
    if (!nuevaPassword || nuevaPassword.length < 8) {
      setFeedback(resetFeedback || listFeedback, "La contraseña debe tener al menos 8 caracteres.");
      return false;
    }
    try {
      const res = await fetch(`${API_BASE}/usuarios/${id}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ nuevaPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(resetFeedback || listFeedback, data?.mensaje || "No se pudo resetear la contraseña");
        return false;
      }
      setFeedback(listFeedback, data?.mensaje || "Contraseña reseteada.", false);
      return true;
    } catch (err) {
      setFeedback(resetFeedback || listFeedback, err.message || "No se pudo resetear la contraseña");
      return false;
    }
  };

  if (usersTable) {
    usersTable.addEventListener("change", (e) => {
      const toggle = e.target.closest("input[data-action='toggle']");
      if (!toggle) return;
      const { id } = toggle.dataset;
      const nuevoActivo = toggle.checked;
      const user = findUser(id);
      if (!user) {
        fetchUsers();
        return;
      }
      const switchEl = toggle.closest(".switch");

      // Si se va a desactivar, pedimos confirmación antes de pintar en rojo.
      if (!nuevoActivo) {
        toggle.checked = true; // revertimos visualmente hasta confirmar
        showConfirm("¿Seguro que deseas desactivar este profesional?", "Sí, desactivar")
          .then((confirmed) => {
            if (!confirmed) return;
            toggle.checked = false;
            if (switchEl) switchEl.classList.add("inactive");
            toggleUser(id, false, toggle, { skipConfirm: true });
          });
        return;
      }

      // Activar: aplicamos verde y quitamos rojo.
      if (switchEl) switchEl.classList.remove("inactive");
      toggleUser(id, true, toggle, { skipConfirm: true });
    });

    usersTable.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { id, action } = btn.dataset;
      if (action === "edit") {
        const user = findUser(id);
        if (user) {
          openEdit(user);
        } else {
          fetchUsers();
        }
      } else if (action === "reset") {
        const user = findUser(id);
        if (user) {
          openReset(user);
        } else {
          fetchUsers();
        }
      }
    });
  }


  const applyFilters = () => fetchUsers();

  if (searchInput) {
    const handleSearch = debounce(() => {
      state.search = searchInput.value || '';
      fetchUsers();
    }, 350);
    searchInput.addEventListener('input', handleSearch);
  }

  if (estadoFilter) {
    estadoFilter.addEventListener('change', () => {
      state.estado = estadoFilter.value;
      applyFilters();
    });
  }

  if (rolFilter) {
    rolFilter.addEventListener('change', () => {
      state.rol = rolFilter.value;
      applyFilters();
    });
  }

  if (rolSistemaFilter) {
    rolSistemaFilter.addEventListener('change', () => {
      state.rolSistema = rolSistemaFilter.value;
      applyFilters();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => fetchUsers());
  }

  if (editCancel) {
    editCancel.addEventListener('click', closeEdit);
  }

  if (resetCancel) {
    resetCancel.addEventListener("click", closeReset);
  }

  if (editOverlay) {
    editOverlay.addEventListener('click', (e) => {
      if (e.target === editOverlay) {
        closeEdit();
      }
    });
  }

  if (resetOverlay) {
    resetOverlay.addEventListener("click", (e) => {
      if (e.target === resetOverlay) {
        closeReset();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideConfirm();
      closeEdit();
      closeReset();
    }
  });

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!editingUserId) return;
      setFeedback(editFeedback, '');
      const payload = {
        nombreUsuario: editNombreUsuario.value.trim(),
        email: editEmail.value.trim().toLowerCase(),
        rol: editRol.value.trim(),
        rolSistema: editRolSistema.value.trim()
      };
      if (!payload.nombreUsuario || !payload.email) {
        setFeedback(editFeedback, 'Usuario y email son obligatorios.');
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/usuarios/${editingUserId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback(editFeedback, data?.mensaje || 'No se pudo actualizar.');
          return;
        }
        closeEdit();
        setFeedback(listFeedback, 'Profesional actualizado.', false);
        fetchUsers();
      } catch (err) {
        setFeedback(editFeedback, err.message || 'No se pudo actualizar.');
      }
    });
  }

  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!resettingUserId || !resetPasswordInput) return;
      setFeedback(resetFeedback, "");
      const nuevaPassword = resetPasswordInput.value || "";
      const ok = await submitResetPassword(resettingUserId, nuevaPassword);
      if (!ok) return;
      closeReset();
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
