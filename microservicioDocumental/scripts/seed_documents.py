from __future__ import annotations

"""
Script sencillo para insertar documentos de ejemplo en la base de datos.

Uso:
    python scripts/seed_documents.py

Respeta la cadena de conexión definida en .env (DATABASE_URL). Si la tabla no
existe, la crea antes de insertar.
"""

from pathlib import Path
import sys

# Permite ejecutar el script desde la carpeta del proyecto sin instalar el paquete
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import Base, engine, session_scope
from app.models.document import Documento


SEED_DOCUMENTS = [
    {
        "titulo": "Manual básico de Nutrición Clínica y Dietética",
        "descripcion": "Manual del GEFP-SEFH (Valencia, 2012) sobre nutrición clínica y dietética.",
        "fuente": "SEFH",
        "tipo": "PDF",
        "etiquetas": ["nutricion-clinica", "dietetica", "manual"],
        "url_descarga": "https://gruposdetrabajo.sefh.es/gefp/images/stories/documentos/4-ATENCION-FARMACEUTICA/Nutricion/Manual_basico_N_clinica_y_Dietetica_Valencia_2012.pdf",
        "external_id": "sefh-manual-nutricion-clinica-2012",
    },
    {
        "titulo": "Recomendaciones dietéticas",
        "descripcion": "Guía de la Agencia Española de Seguridad Alimentaria y Nutrición (AESAN).",
        "fuente": "AESAN",
        "tipo": "PDF",
        "etiquetas": ["salud", "nutricion", "recomendaciones"],
        "url_descarga": "https://www.aesan.gob.es/AECOSAN/docs/documentos/nutricion/RECOMENDACIONES_DIETETICAS.pdf",
        "external_id": "aesan-recomendaciones",
    },
    {
        "titulo": "Conceptos de alimentación",
        "descripcion": "Documento divulgativo de la SEGHNP sobre alimentación y nutrición pediátrica.",
        "fuente": "SEGHNP",
        "tipo": "PDF",
        "etiquetas": ["alimentacion", "divulgacion", "pediatria"],
        "url_descarga": "https://www.seghnp.org/sites/default/files/2017-06/conceptos-alimentacion.pdf",
        "external_id": "seghnp-conceptos",
    },
    {
        "titulo": "Recomendaciones dietéticas para la población española (curso)",
        "descripcion": "Capítulo 1 de un curso de nutrición clínica y dietética.",
        "fuente": "Campus Panamericana",
        "tipo": "PDF",
        "etiquetas": ["nutricion", "dietetica", "curso", "capitulo"],
        "url_descarga": "https://aula.campuspanamericana.com/_Cursos/Curso00577/Temario/Cap1.pdf",
        "external_id": "campus-panamericana-cap1-curso00577",
    },
    {
        "titulo": "Libro Blanco de la Nutrición en España (2013)",
        "descripcion": "Publicación de la Sociedad Española de Nutrición (SEN) sobre la situación nutricional en España.",
        "fuente": "SEN",
        "tipo": "PDF",
        "etiquetas": ["nutricion", "libro-blanco", "espana"],
        "url_descarga": "https://www.sennutricion.org/media/Docs_Consenso/Libro_Blanco_Nutricion_Esp-2013.pdf",
        "external_id": "sen-libro-blanco-nutricion-2013",
    },
    {
    "titulo": "Capítulo 1. Conceptos básicos",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "dietetica", "conceptos-basicos", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-09-19-cap-1-conceptos-basicos-2018.pdf",
    "external_id": "ucm-manual-capitulo-1-conceptos-basicos"
  },
  {
    "titulo": "Capítulo 2. Composición corporal",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "composicion-corporal", "antropometria", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-24-cap-2-composicion-corporal55.pdf",
    "external_id": "ucm-manual-capitulo-2-composicion-corporal"
  },
  {
    "titulo": "Capítulo 2a. Composición corporal (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "composicion-corporal", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-03-29-CC-WEB.pdf",
    "external_id": "ucm-manual-capitulo-2a-composicion-corporal-diapositivas"
  },
  {
    "titulo": "Capítulo 3. Ingestas recomendadas, objetivos nutricionales y guías alimentarias",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "ingestas-recomendadas", "guia-alimentaria", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-09-20-cap-3-ingestas-recomendadas-2018.pdf",
    "external_id": "ucm-manual-capitulo-3-ingestas-recomendadas-objetivos-nutricionales-y-guias-alimentarias"
  },
  {
    "titulo": "Capítulo 3a. Ingestas recomendadas y objetivos nutricionales (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "ingestas-recomendadas", "objetivos-nutricionales", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-09-20-Carbajal-IR-ON-GABA-diapo-web.pdf",
    "external_id": "ucm-manual-capitulo-3a-ingestas-recomendadas-y-objetivos-nutricionales-diapositivas"
  },
  {
    "titulo": "Capítulo 3b. Ingestas recomendadas población española y gasto energético total (tablas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "ingestas-recomendadas", "tablas", "gasto-energetico"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-01-26-IR-Tablas-Moreiras-col-2016-web.pdf",
    "external_id": "ucm-manual-capitulo-3b-ingestas-recomendadas-poblacion-espanola-y-gasto-energetico-total-tablas"
  },
  {
    "titulo": "Capítulo 4. Energía",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "energia", "metabolismo", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-09-20-cap-4-energia-2018.pdf",
    "external_id": "ucm-manual-capitulo-4-energia"
  },
  {
    "titulo": "Capítulo 5. Proteínas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "proteinas", "macronutrientes", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-24-cap-5-proteinas.pdf",
    "external_id": "ucm-manual-capitulo-5-proteinas"
  },
  {
    "titulo": "Capítulo 5a. Proteínas (diapositivas) – Parte 1",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "proteinas", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-01-PROTEINAS-2018-1a-web.pdf",
    "external_id": "ucm-manual-capitulo-5a-proteinas-diapositivas-parte-1"
  },
  {
    "titulo": "Capítulo 5b. Proteínas (diapositivas) – Parte 2",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "proteinas", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-01-PROTEINAS-2018-1b-web.pdf",
    "external_id": "ucm-manual-capitulo-5b-proteinas-diapositivas-parte-2"
  },
  {
    "titulo": "Capítulo 6. Grasas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "grasas", "lipidos", "macronutrientes", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-24-cap-6-grasas.pdf",
    "external_id": "ucm-manual-capitulo-6-grasas"
  },
  {
    "titulo": "Capítulo 7. Hidratos de carbono",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "hidratos-de-carbono", "carbohidratos", "macronutrientes", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-24-cap-7-hidratos-carbono.pdf",
    "external_id": "ucm-manual-capitulo-7-hidratos-de-carbono"
  },
  {
    "titulo": "Capítulo 7a. Hidratos de carbono (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "hidratos-de-carbono", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-03-CHO-2018-web.pdf",
    "external_id": "ucm-manual-capitulo-7a-hidratos-de-carbono-diapositivas"
  },
  {
    "titulo": "Capítulo 8. Fibra dietética",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "fibra", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-24-cap-8-fibra.pdf",
    "external_id": "ucm-manual-capitulo-8-fibra-dietetica"
  },
  {
    "titulo": "Capítulo 8a. Fibra dietética (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "fibra", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-02-13-Fibra-dietetica-web.pdf",
    "external_id": "ucm-manual-capitulo-8a-fibra-dietetica-diapositivas"
  },
  {
    "titulo": "Capítulo 9. Agua",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "agua", "hidratacion", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-24-cap-9-agua.pdf",
    "external_id": "ucm-manual-capitulo-9-agua"
  },
  {
    "titulo": "Capítulo 9a. Alcohol (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "alcohol", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-03-04-ALCOHOL-web.pdf",
    "external_id": "ucm-manual-capitulo-9a-alcohol-diapositivas"
  },
  {
    "titulo": "Capítulo 10. Minerales",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "minerales", "micronutrientes", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2017-12-02-cap-10-minerales-2017.pdf",
    "external_id": "ucm-manual-capitulo-10-minerales"
  },
  {
    "titulo": "Capítulo 10a. Minerales (diapositivas) – Generalidades",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "minerales", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-08-MINERALES-diapositivas-2020-web-1.pdf",
    "external_id": "ucm-manual-capitulo-10a-minerales-diapositivas-generalidades"
  },
  {
    "titulo": "Capítulo 10b. Minerales (diapositivas) – Calcio",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "minerales", "calcio", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-08-MINERALES-diapositivas-2020-web-Ca.pdf",
    "external_id": "ucm-manual-capitulo-10b-minerales-diapositivas-calcio"
  },
  {
    "titulo": "Capítulo 10c. Minerales (diapositivas) – Hierro",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "minerales", "hierro", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-08-MINERALES-diapositivas-2020-web-Fe.pdf",
    "external_id": "ucm-manual-capitulo-10c-minerales-diapositivas-hierro"
  },
  {
    "titulo": "Capítulo 10d. Minerales (diapositivas) – Cinc y Yodo",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "minerales", "cinc", "yodo", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-08-MINERALES-diapositivas-2020-web-Zn-I.pdf",
    "external_id": "ucm-manual-capitulo-10d-minerales-diapositivas-cinc-y-yodo"
  },
  {
    "titulo": "Capítulo 11. Vitaminas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "vitaminas", "micronutrientes", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-24-cap-11-vitaminas.pdf",
    "external_id": "ucm-manual-capitulo-11-vitaminas"
  },
  {
    "titulo": "Capítulo 11a. Vitaminas (diapositivas) – Generalidades",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "vitaminas", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-10-VITAMINAS-generalidades-2020-web.pdf",
    "external_id": "ucm-manual-capitulo-11a-vitaminas-diapositivas-generalidades"
  },
  {
    "titulo": "Capítulo 11b. Vitamina A (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "vitaminas", "vitamina-a", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-10-VITAMINA-A-2020-web.pdf",
    "external_id": "ucm-manual-capitulo-11b-vitamina-a-diapositivas"
  },
  {
    "titulo": "Capítulo 11c. Vitamina D (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "vitaminas", "vitamina-d", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2019-01-21-VITAMINA-D-2019-web.pdf",
    "external_id": "ucm-manual-capitulo-11c-vitamina-d-diapositivas"
  },
  {
    "titulo": "Capítulo 11d. Vitamina E (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "vitaminas", "vitamina-e", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-11-VITAMINA-E-2020-web.pdf",
    "external_id": "ucm-manual-capitulo-11d-vitamina-e-diapositivas"
  },
  {
    "titulo": "Capítulo 11e. Vitamina K (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "vitaminas", "vitamina-k", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-08-VITAMINA-K-2020-web.pdf",
    "external_id": "ucm-manual-capitulo-11e-vitamina-k-diapositivas"
  },
  {
    "titulo": "Capítulo 11f. Folatos (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "vitaminas", "folatos", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-02-13-VITAMINAS-FOLATOS-2020-web.pdf",
    "external_id": "ucm-manual-capitulo-11f-folatos-diapositivas"
  },
  {
    "titulo": "Capítulo 12. Componentes bioactivos",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "bioactivos", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-24-cap-12-bioactivos.pdf",
    "external_id": "ucm-manual-capitulo-12-componentes-bioactivos"
  },
  {
    "titulo": "Capítulo 12a. Componentes bioactivos (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "bioactivos", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-02-07-Bioactivos-web.pdf",
    "external_id": "ucm-manual-capitulo-12a-componentes-bioactivos-diapositivas"
  },
  {
    "titulo": "Capítulo 13. Digestión y absorción de nutrientes",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "digestion", "absorcion", "fisiologia", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-09-cap-13-digestion-absorcion-2018.pdf",
    "external_id": "ucm-manual-capitulo-13-digestion-y-absorcion-de-nutrientes"
  },
  {
    "titulo": "Capítulo 14. Los alimentos como fuente de energía y nutrientes",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "alimentos", "energia", "nutrientes", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-01-10-cap-14-alimentos-2018.pdf",
    "external_id": "ucm-manual-capitulo-14-los-alimentos-como-fuente-de-energia-y-nutrientes"
  },
  {
    "titulo": "Capítulo 15. Estado nutricional. Encuestas dietéticas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "estado-nutricional", "encuestas-dieteticas", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-30-cap-15-estado-nutricional.pdf",
    "external_id": "ucm-manual-capitulo-15-estado-nutricional-encuestas-dieteticas"
  },
  {
    "titulo": "Capítulo 15a. Encuestas dietéticas (diapositivas) – Parte 1",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "encuestas-dieteticas", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-13-encuestas-2018-web-1.pdf",
    "external_id": "ucm-manual-capitulo-15a-encuestas-dieteticas-diapositivas-parte-1"
  },
  {
    "titulo": "Capítulo 15b. Encuestas dietéticas (diapositivas) – Parte 2",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "encuestas-dieteticas", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-13-encuestas-2018-web-2.pdf",
    "external_id": "ucm-manual-capitulo-15b-encuestas-dieteticas-diapositivas-parte-2"
  },
  {
    "titulo": "Capítulo 15c. Biomarcadores (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "biomarcadores", "evaluacion", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-13-biomarcadores-2018-web.pdf",
    "external_id": "ucm-manual-capitulo-15c-biomarcadores-diapositivas"
  },
  {
    "titulo": "Capítulo 16. Dieta equilibrada",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "dieta-equilibrada", "planificacion", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-07-31-cap-16-dieta-equilibrada.pdf",
    "external_id": "ucm-manual-capitulo-16-dieta-equilibrada"
  },
  {
    "titulo": "Capítulo 17. Calidad nutricional de la dieta",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "calidad-de-la-dieta", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-08-01-cap-17-calidad-dieta.pdf",
    "external_id": "ucm-manual-capitulo-17-calidad-nutricional-de-la-dieta"
  },
  {
    "titulo": "Capítulo 18. Dieta Mediterránea",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "dieta-mediterranea", "patrones-alimentarios", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-06-20-cap-18-dieta-mediterranea-2018.pdf",
    "external_id": "ucm-manual-capitulo-18-dieta-mediterranea"
  },
  {
    "titulo": "Capítulo 19. Dieta en España. Alimentos",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "dieta-en-espana", "alimentos", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-08-16-cap-19-dieta-espa%C3%B1a-1.pdf",
    "external_id": "ucm-manual-capitulo-19-dieta-en-espana-alimentos"
  },
  {
    "titulo": "Capítulo 20. Dieta en España. Energía y nutrientes",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "dieta-en-espana", "energia", "nutrientes", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-08-17-cap-20-dieta-espa%C3%B1a-2.pdf",
    "external_id": "ucm-manual-capitulo-20-dieta-en-espana-energia-y-nutrientes"
  },
  {
    "titulo": "Capítulo 20a. Hábitos alimentarios (diapositivas) – Parte 1",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "habitos-alimentarios", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-31-HA-2018-web-1.pdf",
    "external_id": "ucm-manual-capitulo-20a-habitos-alimentarios-diapositivas-parte-1"
  },
  {
    "titulo": "Capítulo 20b. Hábitos alimentarios (diapositivas) – Parte 2",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "habitos-alimentarios", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-31-HA-2018-web-2.pdf",
    "external_id": "ucm-manual-capitulo-20b-habitos-alimentarios-diapositivas-parte-2"
  },
  {
    "titulo": "Capítulo 21. Diseño y programación de dietas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "diseño-de-dietas", "programacion-de-dietas", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-10-31-cap-21-dise%C3%B1o-dietas-2015.pdf",
    "external_id": "ucm-manual-capitulo-21-diseno-y-programacion-de-dietas"
  },
  {
    "titulo": "Capítulo 21a. Diseño y programación de dietas (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "diseño-de-dietas", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-11-02-dise%C3%B1o-dietas-2018-WEB.pdf",
    "external_id": "ucm-manual-capitulo-21a-diseno-y-programacion-de-dietas-diapositivas"
  },
  {
    "titulo": "Capítulo 22. Dietas de adelgazamiento",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "adelgazamiento", "dietas", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-08-18-cap-22-dietas-adelgazamiento.pdf",
    "external_id": "ucm-manual-capitulo-22-dietas-de-adelgazamiento"
  },
  {
    "titulo": "Capítulo 23. Nutrición a lo largo de la vida",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "ciclo-vital", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-08-19-cap-23-nutrici%C3%B3n-a-lo-largo-de-la-vida.pdf",
    "external_id": "ucm-manual-capitulo-23-nutricion-a-lo-largo-de-la-vida"
  },
  {
    "titulo": "Capítulo 23a. Personas mayores (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "personas-mayores", "geriatria", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2018-03-05-PEA-2018-web.pdf",
    "external_id": "ucm-manual-capitulo-23a-personas-mayores-diapositivas"
  },
  {
    "titulo": "Capítulo 24. Nutrición y enfermedad",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "nutricion-clinica", "enfermedad", "capitulo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-08-21-cap-24-nutrici%C3%B3n-y-enfermedad.pdf",
    "external_id": "ucm-manual-capitulo-24-nutricion-y-enfermedad"
  },
  {
    "titulo": "Capítulo 24a. Nutrición y Diabetes Mellitus (diapositivas)",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "diabetes", "diapositivas"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2020-08-12-Diabetes-diapositivas-2020-web.pdf",
    "external_id": "ucm-manual-capitulo-24a-nutricion-y-diabetes-mellitus-diapositivas"
  },
  {
    "titulo": "Bibliografía",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "bibliografia", "referencias"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-08-19-cap-25-bibliografia.pdf",
    "external_id": "ucm-manual-bibliografia"
  },
  {
    "titulo": "Abreviaturas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "abreviaturas", "glosario"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2013-08-25-abreviaturas.pdf",
    "external_id": "ucm-manual-abreviaturas"
  },
  {
    "titulo": "Anexo 1. Protocolos de valoración y programación de dietas y encuestas dietéticas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "protocolos", "valoracion-nutricional", "encuestas-dieteticas", "anexo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2015-10-22-protocolos-valoracion-EN-y-encuestas-dieteticas-2015.pdf",
    "external_id": "ucm-manual-anexo-1-protocolos-de-valoracion-y-programacion-de-dietas-y-encuestas-dieteticas"
  },
  {
    "titulo": "Anexo 2. Pesos de medidas caseras y raciones habituales",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "medidas-caseras", "raciones", "anexo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2015-10-22-pesos-medidas-caseras-raciones-2015.pdf",
    "external_id": "ucm-manual-anexo-2-pesos-de-medidas-caseras-y-raciones-habituales"
  },
  {
    "titulo": "Anexo 3. Recuerdo de 24 horas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "recuerdo-24-horas", "encuestas-dieteticas", "anexo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2016-03-08-Recuerdo-24h-2016.pdf",
    "external_id": "ucm-manual-anexo-3-recuerdo-de-24-horas"
  },
  {
    "titulo": "Anexo 4. Registro de 3 días",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "registro-3-dias", "actividad-fisica", "encuestas-dieteticas", "anexo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2016-03-08-Registro-3d-y-AF-2016.pdf",
    "external_id": "ucm-manual-anexo-4-registro-de-3-dias"
  },
  {
    "titulo": "Anexo 5. Raciones recomendadas",
    "descripcion": "Recurso del Manual de Nutrición y Dietética (Universidad Complutense de Madrid).",
    "fuente": "UCM",
    "tipo": "PDF",
    "etiquetas": ["manual", "nutricion", "raciones", "recomendaciones", "anexo"],
    "url_descarga": "https://www.ucm.es/data/cont/docs/458-2017-01-29-Raciones-recomendadas-SENC-2016.pdf",
    "external_id": "ucm-manual-anexo-5-raciones-recomendadas"
  }
]


def main() -> None:
    # Garantiza que la tabla exista
    Base.metadata.create_all(bind=engine)

    with session_scope() as session:
        for payload in SEED_DOCUMENTS:
            exists = (
                session.query(Documento)
                .filter(
                    Documento.fuente == payload["fuente"],
                    Documento.external_id == payload["external_id"],
                )
                .first()
            )
            if exists:
                # Ya existe; saltar para evitar duplicado
                continue
            session.add(Documento(**payload))
        # commit implícito en session_scope


if __name__ == "__main__":
    main()
