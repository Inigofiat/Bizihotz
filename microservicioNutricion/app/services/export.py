from __future__ import annotations

import csv
from datetime import datetime
from io import StringIO
from typing import Tuple

try:  # pragma: no cover - dependencia opcional
    from fpdf import FPDF  # type: ignore

    _HAS_FPDF = True
except ImportError:  # pragma: no cover - fallback texto plano
    _HAS_FPDF = False

    class FPDF:  # type: ignore
        """Implementacion minima para entornos sin fpdf2 instalada."""

        def __init__(self) -> None:
            self._buffer: list[str] = []

        def add_page(self) -> None:
            self._buffer.append("\n=== Nuevo plan ===\n")
            self.header()

        def set_font(self, *_args, **_kwargs) -> None:
            return

        def cell(self, _w, _h, txt: str = "", ln: bool = False, **_kwargs) -> None:
            self._buffer.append(txt)
            if ln:
                self._buffer.append("\n")

        def multi_cell(self, _w, _h, txt: str = "", **_kwargs) -> None:
            self._buffer.append(txt)
            self._buffer.append("\n")

        def ln(self, _h: float = 0) -> None:
            self._buffer.append("\n")

        def set_y(self, *_args, **_kwargs) -> None:
            return

        def header(self) -> None:
            self._buffer.append("Plan nutricional\n")

        def output(self, dest: str = "S") -> str:
            return "".join(self._buffer) or "Plan nutricional generado sin dependencias extra."


from ..models import Dieta, DietaReceta
from ..services.nutrition import calcular_totales_dieta, calcular_totales_receta


def _ordenar_recetas(recetas: list[DietaReceta]) -> list[DietaReceta]:
    return sorted(
        recetas,
        key=lambda item: (
            item.dia_semana or "",
            item.momento or "",
            item.orden or 0,
        ),
    )


def _formatear_pares(valores: dict[str, float]) -> str:
    if not valores:
        return "-"
    pares = [f"{clave}: {valor}" for clave, valor in valores.items()]
    return "; ".join(pares)


def generar_csv_dieta(dieta: Dieta) -> Tuple[bytes, str]:
    buffer = StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["Dieta", dieta.nombre])
    writer.writerow(["Paciente", dieta.paciente_id or "N/A"])
    writer.writerow(["Version", dieta.version])
    writer.writerow(["Periodo", f"{dieta.fecha_inicio} - {dieta.fecha_fin or 'Indefinido'}"])
    writer.writerow([])
    writer.writerow(["Dia", "Momento", "Receta", "Porciones", "Macros", "Micros"])

    for item in _ordenar_recetas(list(dieta.recetas)):
        receta = item.receta
        if receta is None:
            continue
        totales = calcular_totales_receta(receta)
        writer.writerow(
            [
                item.dia_semana or "-",
                item.momento or "-",
                receta.nombre,
                item.porciones or 1,
                _formatear_pares(totales["macros"]),
                _formatear_pares(totales["micros"]),
            ]
        )

    writer.writerow([])
    totales_dieta = calcular_totales_dieta(dieta.recetas)
    writer.writerow(["Totales dieta"])
    writer.writerow(["Macros", _formatear_pares(totales_dieta["macros"])])
    writer.writerow(["Micros", _formatear_pares(totales_dieta["micros"])])

    contenido = buffer.getvalue().encode("utf-8-sig")
    buffer.close()
    nombre = f"dieta_{dieta.id}_v{dieta.version}.csv"
    return contenido, nombre


class _PDF(FPDF):
    def header(self):  # pragma: no cover - comportamiento nativo de FPDF
        if _HAS_FPDF:
            self.set_font("Helvetica", "B", 14)
            self.cell(0, 10, "Plan nutricional", ln=True, align="C")
            self.ln(2)


def generar_pdf_dieta(dieta: Dieta, footer_note: str) -> Tuple[bytes, str]:
    pdf = _PDF()
    pdf.add_page()
    if _HAS_FPDF:
        pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, dieta.nombre, ln=True)

    if _HAS_FPDF:
        pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 8, f"Paciente: {dieta.paciente_id or '-'}", ln=True)
    pdf.cell(0, 8, f"Version: {dieta.version}", ln=True)
    pdf.cell(
        0,
        8,
        f"Periodo: {dieta.fecha_inicio} - {dieta.fecha_fin or 'Indefinido'}",
        ln=True,
    )
    if dieta.objetivo:
        pdf.multi_cell(0, 8, f"Objetivo: {dieta.objetivo}")
    if dieta.descripcion:
        pdf.multi_cell(0, 8, f"Descripcion: {dieta.descripcion}")
    if dieta.notas:
        pdf.multi_cell(0, 8, f"Notas: {dieta.notas}")

    pdf.ln(4)

    for item in _ordenar_recetas(list(dieta.recetas)):
        receta = item.receta
        if receta is None:
            continue

        if _HAS_FPDF:
            pdf.set_font("Helvetica", "B", 12)
        encabezado = f"{item.dia_semana or '-'} - {item.momento or '-'}"
        pdf.cell(0, 8, encabezado, ln=True)

        if _HAS_FPDF:
            pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 6, f"Receta: {receta.nombre}", ln=True)
        pdf.cell(0, 6, f"Porciones: {item.porciones or 1}", ln=True)
        totales = calcular_totales_receta(receta)
        pdf.multi_cell(0, 6, f"Macros: {_formatear_pares(totales['macros'])}")
        if totales["micros"]:
            pdf.multi_cell(0, 6, f"Micros: {_formatear_pares(totales['micros'])}")
        pdf.ln(2)

    totales_dieta = calcular_totales_dieta(dieta.recetas)
    if _HAS_FPDF:
        pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Totales del plan", ln=True)
    if _HAS_FPDF:
        pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 6, f"Macros: {_formatear_pares(totales_dieta['macros'])}", ln=True)
    if totales_dieta["micros"]:
        pdf.multi_cell(0, 6, f"Micros: {_formatear_pares(totales_dieta['micros'])}")

    pdf.set_y(-25)
    if _HAS_FPDF:
        pdf.set_font("Helvetica", "I", 9)
    pdf.multi_cell(0, 5, footer_note, align="C")
    pdf.cell(
        0,
        5,
        datetime.utcnow().strftime("Emitido el %d/%m/%Y %H:%M UTC"),
        ln=True,
        align="C",
    )

    contenido = pdf.output(dest="S")
    if isinstance(contenido, str):
        contenido_bytes = contenido.encode("latin-1", errors="replace")
    else:  # pragma: no cover - modo nativo fpdf devuelve str
        contenido_bytes = contenido

    nombre = f"dieta_{dieta.id}_v{dieta.version}.pdf"
    return contenido_bytes, nombre
