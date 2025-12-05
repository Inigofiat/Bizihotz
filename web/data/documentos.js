(function () {
  // Lista editable de documentos. Anade, edita o elimina objetos de este array.
  // Campos admitidos: titulo (string), descripcion (string opcional), fuente (string),
  // tipo (string opcional, ej. "PDF"), etiquetas (array opcional), url (string).
  window.DOCUMENTOS_STATIC = [
    {
      titulo: "Recomendaciones dieteticas",
      descripcion: "Guia de la Agencia Espanola de Seguridad Alimentaria y Nutricion (AESAN).",
      fuente: "AESAN",
      tipo: "PDF",
      etiquetas: ["salud", "nutricion", "recomendaciones"],
      url: "https://www.aesan.gob.es/AECOSAN/docs/documentos/nutricion/RECOMENDACIONES_DIETETICAS.pdf"
    },
    {
      titulo: "Conceptos de alimentacion",
      descripcion: "Documento divulgativo de la SEGHNP sobre alimentacion y nutricion pediatrica.",
      fuente: "SEGHNP",
      tipo: "PDF",
      etiquetas: ["alimentacion", "divulgacion", "pediatria"],
      url: "https://www.seghnp.org/sites/default/files/2017-06/conceptos-alimentacion.pdf"
    }
  ];
})();
