(function () {
  const resolveGatewayBase = () => {
    const protocol = window.location.protocol;
    const hostname = (window.location.hostname || "").toLowerCase();
    if (protocol === "file:") {
      return "http://localhost:5000";
    }
    if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
      const baseHost = hostname || "localhost";
      return `${protocol}//${baseHost}:5000`;
    }
    return `${protocol}//${window.location.host}`;
  };

  const resolveDirectBase = () => {
    const protocol = window.location.protocol === "file:" ? "http:" : window.location.protocol;
    const hostname = (window.location.hostname || "localhost").toLowerCase() || "localhost";
    return `${protocol}//${hostname}:5100`;
  };

  const DIRECT_BASE = resolveDirectBase().replace(/\/+$/, "");

  const buildApiBases = () => {
    const candidates = [`${resolveGatewayBase()}/documentos/api`, `${DIRECT_BASE}/api`];
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

  const API_BASES = buildApiBases();
  let activeApiBase = API_BASES[0] || null;

  const selectors = {
    list: document.getElementById("documentList"),
    template: document.getElementById("docCardTemplate"),
    feedback: document.getElementById("feedback"),
    count: document.getElementById("docCount"),
    searchQ: document.getElementById("docSearchQ"),
    searchEtiqueta: document.getElementById("docSearchEtiqueta"),
    searchBtn: document.getElementById("docSearchBtn"),
    clearBtn: document.getElementById("docClearBtn"),
    pageInfo: document.getElementById("docPageInfo"),
    pagePrev: document.getElementById("docPrevPage"),
    pageNext: document.getElementById("docNextPage"),
    viewer: document.getElementById("docViewer"),
    viewerFrame: document.getElementById("docViewerFrame"),
    viewerTitle: document.getElementById("docViewerTitle"),
    viewerClose: document.getElementById("closeDocViewer"),
    viewerLoading: document.getElementById("docViewerLoading"),
  };

  const state = {
    page: 1,
    pageSize: 200, // mostrar todos como antes
    lastPage: false,
  };

  let viewerFallbackTimer = null;
  let viewerBlobUrl = null;

  const getApiBase = () => activeApiBase || API_BASES[0] || "";

  const setFeedback = (message, variant = "info") => {
    if (!selectors.feedback) return;
    if (!message) {
      selectors.feedback.hidden = true;
      selectors.feedback.textContent = "";
      selectors.feedback.className = "feedback";
      return;
    }
    selectors.feedback.hidden = false;
    selectors.feedback.textContent = message;
    selectors.feedback.className = `feedback feedback--${variant}`;
  };

  const updateCount = (value) => {
    if (selectors.count) {
      selectors.count.textContent = Number.isFinite(value) ? String(value) : "--";
    }
  };

  const resolveDocLinks = (doc) => {
    const directUrl = doc?.url_descarga || doc?.ruta_archivo || doc?.url || (doc?.metadata_json && doc.metadata_json.url) || null;
    const inlineUrl = doc?.id && DIRECT_BASE ? `${DIRECT_BASE}/api/documentos/${doc.id}/contenido` : null;
    return { directUrl, inlineUrl };
  };

  const renderDocs = (docs) => {
    if (!selectors.list || !selectors.template) return;

    selectors.list.innerHTML = "";
    const safeDocs = Array.isArray(docs) ? docs : [];
    updateCount(safeDocs.length || 0);

    if (!safeDocs.length) {
      setFeedback("No hay documentos en la base de datos.", "info");
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Aun no hay documentos guardados.";
      selectors.list.appendChild(empty);
      return;
    }

    setFeedback("", "info");
    const chapterNumber = (title = "") => {
      const match = String(title || "")
        .toLowerCase()
        .match(/cap[iヴ]tulo\s*([0-9]+)/i);
      return match ? parseInt(match[1], 10) : null;
    };

    const orderedDocs = safeDocs.slice().sort((a, b) => {
      const na = chapterNumber(a?.titulo);
      const nb = chapterNumber(b?.titulo);
      if (na !== null && nb !== null && na !== nb) {
        return na - nb;
      }
      const ta = (a?.titulo || "").toLocaleLowerCase("es-ES").trim();
      const tb = (b?.titulo || "").toLocaleLowerCase("es-ES").trim();
      if (ta === tb) {
        return (a?.fuente || "").localeCompare(b?.fuente || "", "es-ES");
      }
      return ta.localeCompare(tb, "es-ES");
    });
    const fragment = document.createDocumentFragment();

    orderedDocs.forEach((doc) => {
      const clone = selectors.template.content.cloneNode(true);
      const titleNode = clone.querySelector(".doc-title");
      const descNode = clone.querySelector(".doc-desc");
      const fuenteTag = clone.querySelector(".doc-tag.fuente");
      const tipoTag = clone.querySelector(".doc-tag.tipo");
      const etiquetasContainer = clone.querySelector(".doc-etiquetas");
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

      const { directUrl, inlineUrl } = resolveDocLinks(doc);
      const hasUrl = Boolean(directUrl || inlineUrl);

      if (hasUrl) {
        descargaLink.href = inlineUrl || directUrl;
        descargaLink.textContent = "Abrir";
        descargaLink.dataset.docUrl = directUrl || "";
        if (inlineUrl) {
          descargaLink.dataset.docInlineUrl = inlineUrl;
        }
        descargaLink.dataset.docTitle = doc.titulo || "Documento";
        descargaLink.dataset.docId = doc.id ?? "";
      } else {
        descargaLink.href = "#";
        descargaLink.textContent = "Sin enlace";
        descargaLink.style.pointerEvents = "none";
        descargaLink.style.opacity = "0.6";
      }

      fragment.appendChild(clone);
    });

    selectors.list.appendChild(fragment);
  };

  const fetchWithFallback = async (path = "") => {
    let lastError = null;
    for (const base of API_BASES) {
      const url = `${base}${path}`;
      try {
        const resp = await fetch(url, { headers: { Accept: "application/json" } });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || `Error ${resp.status}`);
        }
        activeApiBase = base;
        return await resp.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No se pudo contactar con el servicio documental.");
  };

  const buildQueryString = (page = 1) => {
    const params = new URLSearchParams();
    const q = selectors.searchQ?.value.trim();
    const etiqueta = selectors.searchEtiqueta?.value.trim();

    if (q) params.set("q", q);
    if (etiqueta) params.set("etiqueta", etiqueta);

    params.set("limit", String(state.pageSize));
    params.set("skip", String((page - 1) * state.pageSize));

    return `?${params.toString()}`;
  };

  const updatePaginationControls = () => {
    if (selectors.pagePrev) selectors.pagePrev.disabled = state.page <= 1;
    if (selectors.pageNext) selectors.pageNext.disabled = state.lastPage;
    if (selectors.pageInfo) selectors.pageInfo.textContent = `Página ${state.page}`;
  };

  const loadDocs = async () => {
    setFeedback("Cargando documentos...");
    try {
      const query = buildQueryString(state.page);
      const data = await fetchWithFallback(`/documentos${query}`);
      state.lastPage = Array.isArray(data) ? data.length < state.pageSize : true;
      updatePaginationControls();
      renderDocs(data || []);
    } catch (error) {
      state.lastPage = true;
      updatePaginationControls();
      renderDocs([]);
      setFeedback(
        error?.message || "No pudimos cargar documentos. Verifica que el microservicio documental esta en marcha.",
        "error"
      );
    }
  };

  const closeViewer = () => {
    if (!selectors.viewer) return;
    selectors.viewer.hidden = true;
    if (viewerFallbackTimer) {
      clearTimeout(viewerFallbackTimer);
      viewerFallbackTimer = null;
    }
    if (viewerBlobUrl) {
      URL.revokeObjectURL(viewerBlobUrl);
      viewerBlobUrl = null;
    }
    if (selectors.viewerFrame) {
      selectors.viewerFrame.src = "";
      selectors.viewerFrame.onload = null;
      selectors.viewerFrame.onerror = null;
    }
  };

  const showViewerError = (message, externalUrl) => {
    if (!selectors.viewerLoading) return;
    selectors.viewerLoading.hidden = false;
    selectors.viewerLoading.textContent = message;
    if (externalUrl) {
      const helper = document.createElement("div");
      helper.style.marginTop = "8px";
      const link = document.createElement("a");
      link.href = externalUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Abrir en una pestaña nueva";
      helper.appendChild(link);
      selectors.viewerLoading.appendChild(helper);
    }
  };

  const loadInViewer = async ({ title, inlineUrl, directUrl }) => {
    if (!selectors.viewer || !selectors.viewerFrame || !selectors.viewerLoading || !selectors.viewerTitle) {
      if (directUrl) {
        window.open(directUrl, "_blank", "noopener");
      }
      return;
    }

    selectors.viewer.hidden = false;
    selectors.viewerTitle.textContent = title || "Documento";
    selectors.viewerLoading.hidden = false;
    selectors.viewerLoading.textContent = "Cargando documento...";
    selectors.viewerFrame.src = "about:blank";

    if (viewerFallbackTimer) {
      clearTimeout(viewerFallbackTimer);
      viewerFallbackTimer = null;
    }
    if (viewerBlobUrl) {
      URL.revokeObjectURL(viewerBlobUrl);
      viewerBlobUrl = null;
    }

    const targetUrl = inlineUrl || directUrl;
    if (!targetUrl) {
      showViewerError("Este documento no tiene un enlace disponible.");
      return;
    }

    const tryLoad = (url, fallbackUrl = null) => {
      selectors.viewerFrame.onload = () => {
        if (viewerFallbackTimer) {
          clearTimeout(viewerFallbackTimer);
          viewerFallbackTimer = null;
        }
        selectors.viewerLoading.hidden = true;
      };

      selectors.viewerFrame.onerror = () => {
        if (viewerFallbackTimer) {
          clearTimeout(viewerFallbackTimer);
          viewerFallbackTimer = null;
        }
        if (fallbackUrl) {
          tryLoad(fallbackUrl, null);
          return;
        }
        showViewerError("No pudimos mostrar el documento en el visor.", directUrl);
      };

      // Oculta el overlay aunque el evento load no dispare (algunos visores PDF no emiten onload)
      viewerFallbackTimer = setTimeout(() => {
        selectors.viewerLoading.hidden = true;
      }, 1600);

      selectors.viewerFrame.src = url;
    };

    const fetchAsBlob = async (url) => {
      const resp = await fetch(url, { headers: { Accept: "application/pdf" } });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `HTTP ${resp.status}`);
      }
      return await resp.blob();
    };

    try {
      const blob = await fetchAsBlob(targetUrl);
      viewerBlobUrl = URL.createObjectURL(blob);
      tryLoad(viewerBlobUrl, null);
    } catch (error) {
      const fallbackUrl = inlineUrl && directUrl && inlineUrl !== directUrl ? directUrl : null;
      if (fallbackUrl) {
        tryLoad(fallbackUrl, null);
      } else {
        showViewerError("No pudimos recuperar el documento.", directUrl || targetUrl);
      }
    }
  };

  const initDocumentos = () => {
    loadDocs();

    if (selectors.viewer && selectors.viewerClose) {
      selectors.viewerClose.addEventListener("click", closeViewer);
      selectors.viewer.addEventListener("click", (event) => {
        if (event.target === selectors.viewer) {
          closeViewer();
        }
      });
    }

    if (selectors.list) {
      selectors.list.addEventListener("click", (event) => {
        const link = event.target.closest(".doc-link.descarga");
        if (!link) return;
        event.preventDefault();
        const { docUrl, docTitle, docInlineUrl } = link.dataset;
        loadInViewer({
          title: docTitle || "Documento",
          inlineUrl: docInlineUrl || null,
          directUrl: docUrl || null,
        });
      });
    }

    if (selectors.searchBtn) {
      selectors.searchBtn.addEventListener("click", () => {
        state.page = 1;
        loadDocs();
      });
    }

    if (selectors.clearBtn) {
      selectors.clearBtn.addEventListener("click", () => {
        if (selectors.searchQ) selectors.searchQ.value = "";
        if (selectors.searchFuente) selectors.searchFuente.value = "";
        if (selectors.searchTipo) selectors.searchTipo.value = "";
        if (selectors.searchEtiqueta) selectors.searchEtiqueta.value = "";
        state.page = 1;
        loadDocs();
      });
    }

    const handleEnterToSearch = (input) => {
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          state.page = 1;
          loadDocs();
        }
      });
    };

    handleEnterToSearch(selectors.searchQ);
    handleEnterToSearch(selectors.searchEtiqueta);

    if (selectors.pagePrev) {
      selectors.pagePrev.addEventListener("click", () => {
        if (state.page > 1) {
          state.page -= 1;
          loadDocs();
        }
      });
    }

    if (selectors.pageNext) {
      selectors.pageNext.addEventListener("click", () => {
        if (!state.lastPage) {
          state.page += 1;
          loadDocs();
        }
      });
    }

    updatePaginationControls();
  };

  document.addEventListener("DOMContentLoaded", initDocumentos);
})();
