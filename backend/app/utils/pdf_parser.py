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
        r"^(#{1,4}\s+|[0-9]+\.\s+|Section\s+[0-9]+:?\s*|POLICY\s+[A-Z0-9]+:?\s*)(.+)$",
        re.IGNORECASE,
    )

    for line in lines:
        stripped = line.strip()
        match = heading_regex.match(stripped)
        if match:
            if current_lines or current_section != "Overview":
                sections[current_section] = "\n".join(current_lines).strip()
                current_lines = []
            heading_title = match.group(2).strip()
            current_section = heading_title
        else:
            current_lines.append(line)

    if current_lines or current_section != "Overview":
        sections[current_section] = "\n".join(current_lines).strip()

    # Clean empty sections
    sections = {k: v for k, v in sections.items() if v.strip() or k != "Overview"}

    if not sections:
        sections["Overview"] = text.strip()

    return sections
