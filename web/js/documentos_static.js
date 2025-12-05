(function () {
  const docs = Array.isArray(window.DOCUMENTOS_STATIC) ? window.DOCUMENTOS_STATIC : [];

  const renderDocs = () => {
    const list = document.getElementById("documentList");
    const template = document.getElementById("docCardTemplate");
    const feedback = document.getElementById("feedback");

    if (!list || !template) return;

    list.innerHTML = "";

    if (!docs || docs.length === 0) {
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = "No hay documentos configurados. Edita web/data/documentos.js para anadir enlaces.";
      }
      return;
    }

    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
    }

    const fragment = document.createDocumentFragment();

    docs.forEach((doc) => {
      const clone = template.content.cloneNode(true);
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

      if (doc.url) {
        descargaLink.href = doc.url;
        descargaLink.textContent = "Abrir";
      } else {
        descargaLink.href = "#";
        descargaLink.textContent = "Sin enlace";
        descargaLink.style.pointerEvents = "none";
        descargaLink.style.opacity = "0.6";
      }

      fragment.appendChild(clone);
    });

    list.appendChild(fragment);
  };

  document.addEventListener("DOMContentLoaded", renderDocs);
})();
