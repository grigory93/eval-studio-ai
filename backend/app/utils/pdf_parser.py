"""
Document parsing utility for PDF, Markdown, and Plaintext requirement specifications.
"""

import io
import re
from typing import Dict, Tuple
from pypdf import PdfReader


def parse_pdf_content(content_bytes: bytes) -> Tuple[str, Dict[str, str]]:
    """Extracts plaintext and sections from PDF bytes."""
    reader = PdfReader(io.BytesIO(content_bytes))
    full_text_pages = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text_pages.append(text)

    full_text = "\n\n".join(full_text_pages).strip()
    sections = extract_sections(full_text)
    return full_text, sections


def parse_markdown_content(text: str) -> Tuple[str, Dict[str, str]]:
    """Extracts sections from Markdown based on heading levels."""
    sections = extract_sections(text)
    return text.strip(), sections


def parse_text_content(text: str) -> Tuple[str, Dict[str, str]]:
    """Extracts sections from plain text."""
    sections = extract_sections(text)
    return text.strip(), sections


def extract_sections(text: str) -> Dict[str, str]:
    """Splits text into structured sections by detecting Markdown or numbered headings."""
    sections: Dict[str, str] = {}
    lines = text.splitlines()

    current_section = "Overview"
    current_lines = []

    heading_regex = re.compile(
        r"^(#{1,4}\s+(.+)|(?:Section|POLICY)\s+[A-Z0-9]+(?::\s*|\s+)(.+)|[0-9]+\.\s+([A-Z][^.:\n]{2,60}(?::\s*|\s*$)))$",
        re.IGNORECASE,
    )

    for line in lines:
        stripped = line.strip()
        match = heading_regex.match(stripped)
        # Avoid treating numbered list items with full sentences as headings
        if match and not (stripped.endswith(".") and len(stripped.split()) > 6):
            if current_lines or current_section != "Overview":
                body = "\n".join(current_lines).strip()
                if body or current_section != "Overview":
                    sections[current_section] = body
                current_lines = []
            # Extract matched heading text
            heading_title = match.group(2) or match.group(3) or match.group(4) or match.group(1)
            current_section = heading_title.strip().rstrip(":")
        else:
            current_lines.append(line)

    if current_lines or current_section != "Overview":
        sections[current_section] = "\n".join(current_lines).strip()

    # Clean empty sections
    sections = {k: v for k, v in sections.items() if v.strip() or k != "Overview"}

    if not sections:
        sections["Overview"] = text.strip()

    return sections
