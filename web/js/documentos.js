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

  const buildApiBases = () => {
    const candidates = [
      `${resolveGatewayBase()}/documentos/api`,
      `${resolveDirectBase()}/api`,
    ];
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

  const selectors = {
    list: document.getElementById("documentList"),
    template: document.getElementById("docCardTemplate"),
    feedback: document.getElementById("feedback"),
    count: document.getElementById("docCount"),
  };

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
        .match(/cap[ií]tulo\s*([0-9]+)/i);
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

      const url =
        doc.url_descarga ||
        doc.ruta_archivo ||
        doc.url ||
        (doc.metadata_json && doc.metadata_json.url) ||
        null;

      if (url) {
        descargaLink.href = url;
        descargaLink.textContent = "Abrir";
        descargaLink.target = "_blank";
        descargaLink.rel = "noopener";
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
        return await resp.json();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("No se pudo contactar con el servicio documental.");
  };

  const loadDocs = async () => {
    setFeedback("Cargando documentos...");
    try {
      const data = await fetchWithFallback("/documentos?limit=200");
      renderDocs(data || []);
    } catch (error) {
      renderDocs([]);
      setFeedback(
        error?.message || "No pudimos cargar documentos. Verifica que el microservicio documental esta en marcha.",
        "error"
      );
    }
  };

  document.addEventListener("DOMContentLoaded", loadDocs);
})();
