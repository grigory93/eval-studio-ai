"""
Document and Requirement Ingestion Router.
"""

import uuid
from typing import Dict, Optional
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.models.elicitation import RequirementDocModel
from app.utils.pdf_parser import (
    parse_markdown_content,
    parse_pdf_content,
    parse_text_content,
)

router = APIRouter(prefix="/api/ingest", tags=["Ingestion"])

# In-memory document storage for the session
_DOCUMENT_STORE: Dict[str, RequirementDocModel] = {}


class TextInputRequest(BaseModel):
    title: str = Field(default="Plain Text Specification")
    text: str = Field(..., description="Raw text requirement or policy specification")


@router.post("/upload", response_model=RequirementDocModel)
async def upload_document(file: UploadFile = File(...)):
    """Accepts PDF, Markdown, or text requirement documents and parses structure."""
    filename = file.filename or "uploaded_doc.txt"
    content_bytes = await file.read()

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"

    if filename.lower().endswith(".pdf"):
        try:
            full_text, sections = parse_pdf_content(content_bytes)
            content_type = "application/pdf"
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to parse PDF document: {str(e)}"
            )
    elif filename.lower().endswith(".md") or filename.lower().endswith(".markdown"):
        try:
            text = content_bytes.decode("utf-8")
            full_text, sections = parse_markdown_content(text)
            content_type = "text/markdown"
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to decode markdown file: {str(e)}"
            )
    else:
        try:
            text = content_bytes.decode("utf-8", errors="replace")
            full_text, sections = parse_text_content(text)
            content_type = "text/plain"
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to parse text document: {str(e)}"
            )

    doc_model = RequirementDocModel(
        doc_id=doc_id,
        filename=filename,
        content_type=content_type,
        extracted_text=full_text,
        sections=sections,
        summary=f"Extracted {len(sections)} sections from {filename} ({len(full_text)} characters)",
    )

    _DOCUMENT_STORE[doc_id] = doc_model
    return doc_model


@router.post("/text", response_model=RequirementDocModel)
async def ingest_raw_text(payload: TextInputRequest):
    """Ingests direct user story or plain-text policy specification."""
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Requirement text cannot be empty.")

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    full_text, sections = parse_markdown_content(payload.text)

    doc_model = RequirementDocModel(
        doc_id=doc_id,
        filename=f"{payload.title}.md",
        content_type="text/markdown",
        extracted_text=full_text,
        sections=sections,
        summary=f"Ingested text specification ({len(full_text)} characters)",
    )

    _DOCUMENT_STORE[doc_id] = doc_model
    return doc_model


@router.get("/documents/{doc_id}", response_model=RequirementDocModel)
async def get_document(doc_id: str):
    """Retrieves previously parsed requirement document."""
    if doc_id not in _DOCUMENT_STORE:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _DOCUMENT_STORE[doc_id]


def get_document_by_id(doc_id: str) -> Optional[RequirementDocModel]:
    return _DOCUMENT_STORE.get(doc_id)
