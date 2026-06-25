"""
Generates a downloadable PDF of structured notes for a meeting/content item.
"""

import re
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer


def _convert_markdown_bold(text: str) -> str:
    """Converts **bold** markdown into ReportLab-compatible <b>bold</b> tags."""
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)


def generate_notes_pdf(title: str, summary: str, concepts: list[dict]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("TitleStyle", parent=styles["Title"], fontSize=20, spaceAfter=20)
    heading_style = ParagraphStyle("HeadingStyle", parent=styles["Heading2"], spaceAfter=10, spaceBefore=16)
    body_style = ParagraphStyle("BodyStyle", parent=styles["BodyText"], fontSize=11, leading=16)
    concept_name_style = ParagraphStyle("ConceptName", parent=styles["Heading3"], spaceAfter=4)

    elements = []
    elements.append(Paragraph(title or "Untitled Content", title_style))

    if summary:
        for line in summary.split("\n"):
            line = line.strip()
            if not line:
                elements.append(Spacer(1, 6))
                continue
            elements.append(Paragraph(_convert_markdown_bold(line), body_style))
            elements.append(Spacer(1, 4))

    if concepts:
        elements.append(Paragraph("Key Concepts", heading_style))
        for c in concepts:
            elements.append(Paragraph(c["name"], concept_name_style))
            elements.append(Paragraph(c["explanation"], body_style))
            elements.append(Spacer(1, 10))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()