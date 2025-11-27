"use strict";

const DOCUMENTOS_BASE_URL = (() => {
  const host = (window.location.hostname || "").toLowerCase();
  if (window.location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "") {
    return "http://localhost:5000/documentos";
  }
  return `${window.location.protocol}//${window.location.hostname}/documentos`;
})();

const DOCUMENTOS_API_URL = `${DOCUMENTOS_BASE_URL}/api/documentos`;
const DOCUMENTOS_SYNC_SOURCE = "openlibrary";

const elements = {
  list: null,
  feedback: null,
  searchInput: null,
  fuenteInput: null,
  etiquetaInput: null,
  reloadBtn: null,
  syncOpenLibraryBtn: null,
  template: null
};

const state = {
  docs: [],
  loading: false,
  error: null
};

const setFeedback = (message, isError = false) => {
  if (!elements.feedback) return;
  if (!message) {
    elements.feedback.hidden = true;
    elements.feedback.textContent = "";
    return;
  }
  elements.feedback.hidden = false;
  elements.feedback.textContent = message;
  elements.feedback.style.background = isError ? "#fff1f0" : "#fff8eb";
  elements.feedback.style.borderColor = isError ? "#ffb3af" : "#f6d88e";
  elements.feedback.style.color = isError ? "#a61b1b" : "#8a6d1b";
};

const renderDocs = (docs) => {
  if (!elements.list || !elements.template) return;
  elements.list.innerHTML = "";
  if (!docs || docs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No hay documentos disponibles.";
    elements.list.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  docs.forEach((doc) => {
    const clone = elements.template.content.cloneNode(true);
    const titleNode = clone.querySelector(".doc-title");
    const descNode = clone.querySelector(".doc-desc");
    const fuenteTag = clone.querySelector(".doc-tag.fuente");
    const tipoTag = clone.querySelector(".doc-tag.tipo");
    const etiquetasContainer = clone.querySelector(".doc-etiquetas");
    const detalleLink = clone.querySelector(".doc-link.detalle");
    const descargaLink = clone.querySelector(".doc-link.descarga");

    titleNode.textContent = doc.titulo || "Documento sin titulo";
    descNode.textContent = doc.descripcion || "Sin descripcion";
    fuenteTag.textContent = doc.fuente || "externo";
    tipoTag.textContent = doc.tipo || "general";

    etiquetasContainer.innerHTML = "";
    if (Array.isArray(doc.etiquetas) && doc.etiquetas.length > 0) {
      doc.etiquetas.forEach((et) => {
        const tag = document.createElement("span");
        tag.textContent = et;
        etiquetasContainer.appendChild(tag);
      });
    }

    detalleLink.href = `${DOCUMENTOS_API_URL}/${doc.id}`;
    detalleLink.textContent = "Detalle API";

    if (doc.url_descarga) {
      descargaLink.href = doc.url_descarga;
      descargaLink.textContent = "Descargar";
    } else {
      descargaLink.href = "#";
      descargaLink.textContent = "Sin enlace";
      descargaLink.style.pointerEvents = "none";
      descargaLink.style.opacity = "0.6";
    }

    fragment.appendChild(clone);
  });

  elements.list.appendChild(fragment);
};

const buildQuery = () => {
  const params = new URLSearchParams();
  const q = elements.searchInput?.value.trim();
  const fuente = elements.fuenteInput?.value.trim();
  const etiqueta = elements.etiquetaInput?.value.trim();
  if (q) params.set("q", q);
  if (fuente) params.set("fuente", fuente);
  if (etiqueta) params.set("etiqueta", etiqueta);
  return params.toString();
};

const loadDocs = async () => {
  if (state.loading) return;
  state.loading = true;
  setFeedback("Cargando documentos...");
  try {
    const query = buildQuery();
    const url = query ? `${DOCUMENTOS_API_URL}?${query}` : DOCUMENTOS_API_URL;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    state.docs = data;
    renderDocs(state.docs);
    setFeedback("");
  } catch (error) {
    setFeedback(error.message || "No se pudieron cargar los documentos.", true);
  } finally {
    state.loading = false;
  }
};

const syncOpenLibrary = async () => {
  if (state.loading) return;
  state.loading = true;
  setFeedback("Sincronizando OpenLibrary...");
  try {
    const response = await fetch(`${DOCUMENTOS_BASE_URL}/api/documentos/sync/${DOCUMENTOS_SYNC_SOURCE}`, {
      method: "POST"
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }
    await loadDocs();
    setFeedback("Sincronización completada.");
  } catch (error) {
    setFeedback(error.message || "No se pudo sincronizar OpenLibrary.", true);
  } finally {
    state.loading = false;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  elements.list = document.getElementById("documentList");
  elements.feedback = document.getElementById("feedback");
  elements.searchInput = document.getElementById("searchInput");
  elements.fuenteInput = document.getElementById("fuenteInput");
  elements.etiquetaInput = document.getElementById("etiquetaInput");
  elements.reloadBtn = document.getElementById("reloadDocs");
  elements.syncOpenLibraryBtn = document.getElementById("syncOpenLibrary");
  elements.template = document.getElementById("docCardTemplate");

  elements.reloadBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    loadDocs();
  });

  elements.syncOpenLibraryBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    syncOpenLibrary();
  });

  [elements.searchInput, elements.fuenteInput, elements.etiquetaInput].forEach((input) => {
    input?.addEventListener("change", () => loadDocs());
  });

  loadDocs();
});
