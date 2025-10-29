"use strict";

const API_BASE_URL = (() => {
  const gatewayBase = "http://localhost:5000/gestion";
  const serviceBase = "http://localhost:4002";

  if (window.location.protocol === "file:") {
    return serviceBase;
  }

  const host = window.location.hostname || "localhost";

  if (host === "localhost" || host === "127.0.0.1") {
    return serviceBase;
  }

  return `${window.location.protocol}//${window.location.host}/gestion`;
})();

const API_FALLBACK_URL =
  window.location.protocol === "file:" || window.location.hostname === "localhost"
    ? "http://localhost:5000/gestion"
    : null;

const API_URL = `${API_BASE_URL}/api`;
const API_FALLBACK = API_FALLBACK_URL ? `${API_FALLBACK_URL}/api` : null;
const LOGIN_PAGE = "login.html";
const DEFAULT_AVATAR_URL = "https://cdn-icons-png.flaticon.com/512/847/847969.png";

let usuarioActual = null;

const obtenerRangoDiaUTC = (fechaReferencia = new Date()) => {
  const inicio = new Date(
    fechaReferencia.getFullYear(),
    fechaReferencia.getMonth(),
    fechaReferencia.getDate(),
    0,
    0,
    0,
    0
  );
  const fin = new Date(
    fechaReferencia.getFullYear(),
    fechaReferencia.getMonth(),
    fechaReferencia.getDate(),
    23,
    59,
    59,
    999
  );
  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString()
  };
};

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

const obtenerNombreVisible = (usuario) => {
  if (!usuario) {
    return "";
  }

  const partes = [];
  if (usuario.nombre) {
    partes.push(usuario.nombre);
  }
  if (usuario.apellidos) {
    partes.push(usuario.apellidos);
  }

  const nombreCompleto = partes.join(" ").trim();
  return nombreCompleto || usuario.nombreUsuario || "";
};

const normalizarIdentificador = (valor = "") =>
  valor
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const obtenerSlugUsuarioActual = () =>
  normalizarIdentificador(
    usuarioActual?.nombreUsuario || usuarioActual?.email || usuarioActual?.nombre || ""
  );

const resolverProfesionalId = (cita = {}) => {
  const ref = cita?.idUsuario;
  if (!ref) {
    return null;
  }
  if (typeof ref === "string") {
    return ref;
  }
  if (typeof ref === "object") {
    return ref.idUsuario || ref._id || ref.id || null;
  }
  return null;
};

const resolverSlugProfesional = (cita = {}) => {
  const ref = cita?.idUsuario;
  if (!ref) {
    return "";
  }
  const candidatos = [
    ref.nombreUsuario,
    ref.email,
    `${ref.nombre ?? ""} ${ref.apellidos ?? ""}`,
    ref.nombre
  ];
  const slug = candidatos
    .map((valor) => normalizarIdentificador(valor))
    .find((valor) => valor.length > 0);
  return slug || "";
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
    const visibleName = obtenerNombreVisible(user);
    nameNode.textContent = visibleName || "Usuario";
  }

  const avatarNode = document.querySelector(".avatar img");
  if (avatarNode) {
    avatarNode.src = buildAvatarSrc(user.foto);
    avatarNode.alt = obtenerNombreVisible(user) || "Avatar de usuario";
  }

  if (locationNode) {
    locationNode.textContent = user.rol || "-";
  }

  return user;
};

const cargarCitas = async () => {
  const tbody = document.querySelector("#appointmentsTable tbody");

  if (!tbody) {
    return;
  }

  if (!usuarioActual?.idUsuario) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No se pudo determinar el usuario actual.</td></tr>`;
    return;
  }

  const { inicio, fin } = obtenerRangoDiaUTC(new Date());
  const params = new URLSearchParams({
    idUsuario: usuarioActual.idUsuario,
    fechaDesde: inicio,
    fechaHasta: fin
  });
  const primaryUrl = `${API_URL}/citas?${params.toString()}`;
  const fallbackUrl = API_FALLBACK ? `${API_FALLBACK}/citas?${params.toString()}` : null;

  try {
    const res = await fetch(primaryUrl).catch((error) => {
      if (fallbackUrl) {
        return fetch(fallbackUrl);
      }
      throw error;
    });
    if (!res.ok) {
      throw new Error(`Estado inesperado ${res.status}`);
    }

    let citas = await res.json();
    if (!Array.isArray(citas)) {
      citas = [];
    }

    if (!citas.length && usuarioActual) {
      const slugBuscado = obtenerSlugUsuarioActual();
      if (slugBuscado) {
        const paramsSinId = new URLSearchParams({
          fechaDesde: inicio,
          fechaHasta: fin
        });
        const alternativas = [`${API_URL}/citas?${paramsSinId.toString()}`];
        if (API_FALLBACK) {
          alternativas.push(`${API_FALLBACK}/citas?${paramsSinId.toString()}`);
        }
        for (let index = 0; index < alternativas.length; index += 1) {
          const url = alternativas[index];
          try {
            const respuestaAlternativa = await fetch(url);
            if (!respuestaAlternativa.ok) {
              throw new Error(`Estado inesperado ${respuestaAlternativa.status}`);
            }
            const datosAlternativos = await respuestaAlternativa.json();
            if (Array.isArray(datosAlternativos) && datosAlternativos.length) {
              const coincidencias = datosAlternativos.filter(
                (cita) => resolverSlugProfesional(cita) === slugBuscado
              );
              if (coincidencias.length) {
                const nuevoId = resolverProfesionalId(coincidencias[0]);
                if (nuevoId && nuevoId !== usuarioActual.idUsuario) {
                  actualizarUsuarioLocal({ idUsuario: nuevoId });
                  usuarioActual.idUsuario = nuevoId;
                }
                citas = coincidencias;
              }
            }
            if (citas.length) {
              break;
            }
          } catch (errorAlternativo) {
            if (index === alternativas.length - 1) {
              console.warn("No se pudo resolver el profesional desde los datos:", errorAlternativo);
            }
          }
        }
      }
    }

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


document.addEventListener("DOMContentLoaded", () => {
  const handleLogout = prepararLogoutModal();
  const user = cargarUsuario();
  cargarCitas();

  const agendaButton = document.querySelector('.nav-button[data-nav="agenda"]');
  if (agendaButton) {
    agendaButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "agenda.html";
    });
  }

  const nuevoPacienteButton = document.querySelector('.nav-button[data-nav="nuevo-paciente"]');
  if (nuevoPacienteButton) {
    nuevoPacienteButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "nuevoPaciente.html";
    });
  }

  const historialButton = document.querySelector('.nav-button[data-nav="historial"]');
  if (historialButton) {
    historialButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "historialClinico.html";
    });
  }

  const dietasButton = document.querySelector('.nav-button[data-nav="dietas"]');
  if (dietasButton) {
    dietasButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "dietas.html";
    });
  }

  PerfilModal.prepararModalPerfil(handleLogout, {
    getUsuarioActual: () => usuarioActual,
    actualizarUsuarioLocal,
    obtenerNombreVisible,
    apiUrl: API_URL,
    apiFallback: API_FALLBACK
  });

  if (user?.debeActualizarPassword) {
    window.location.href = "perfil.html?force=1";
    return;
  }
});
