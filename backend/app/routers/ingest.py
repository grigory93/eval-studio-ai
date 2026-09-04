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
from app.utils.sanitizer import redact_pii

router = APIRouter(prefix="/api/ingest", tags=["Ingestion"])

# In-memory document storage for the session
_DOCUMENT_STORE: Dict[str, RequirementDocModel] = {}


class TextInputRequest(BaseModel):
    """Payload model for direct raw text specification ingestion."""
    title: str = Field(
        default="Plain Text Specification",
        description="User-provided title or agent identifier for the specification.",
        examples=["Customer Support Return Policy"],
    )
    text: str = Field(
        ...,
        min_length=1,
        description="Raw text requirement, business rules, or user stories.",
        examples=["# Policy Rules\n1. Returns allowed within 30 days."],
    )
    redact_pii: bool = Field(
        default=True,
        description="Whether to sanitize PII (emails, phone numbers, SSNs, tokens) from ingested text.",
    )


@router.post("/upload", response_model=RequirementDocModel)
async def upload_document(
    file: UploadFile = File(...),
    redact_pii_content: bool = True,
):
    """
    Accepts PDF, Markdown, or text requirement documents, parses sections, and produces structured document models.

    Args:
        file (UploadFile): Binary document upload (supports .pdf, .md, .markdown, .txt).

    Returns:
        RequirementDocModel: Parsed document containing extracted sections and full text.

    Raises:
        HTTPException: 400 with recovery instructions if parsing or decoding fails.
    """
    filename = file.filename or "uploaded_doc.txt"
    content_bytes = await file.read()

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"

    if filename.lower().endswith(".pdf"):
        try:
            full_text, sections = parse_pdf_content(content_bytes)
            content_type = "application/pdf"
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "PDF_PARSING_ERROR",
                    "message": f"Failed to parse PDF document '{filename}': {str(e)}",
                    "recovery_instruction": "Ensure the PDF contains selectable text (not scanned images) or paste text directly via POST /api/ingest/text.",
                },
            )
    elif filename.lower().endswith(".md") or filename.lower().endswith(".markdown"):
        try:
            text = content_bytes.decode("utf-8")
            full_text, sections = parse_markdown_content(text)
            content_type = "text/markdown"
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "MARKDOWN_DECODING_ERROR",
                    "message": f"Failed to decode markdown file: {str(e)}",
                    "recovery_instruction": "Ensure the file is encoded in standard UTF-8 text.",
                },
            )
    else:
        try:
            text = content_bytes.decode("utf-8", errors="replace")
            full_text, sections = parse_text_content(text)
            content_type = "text/plain"
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "TEXT_PARSING_ERROR",
                    "message": f"Failed to parse text document: {str(e)}",
                    "recovery_instruction": "Verify the file is a readable plain text document.",
                },
            )

    if redact_pii_content:
        full_text = redact_pii(full_text)
        sections = {k: redact_pii(v) for k, v in sections.items()}

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
    """
    Ingests direct user stories, Markdown rules, or plain-text policy specifications.

    Args:
        payload (TextInputRequest): Specification title and raw rule text.

    Returns:
        RequirementDocModel: Parsed document representation ready for Socratic elicitation.
    """
    if not payload.text.strip():
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "EMPTY_SPECIFICATION_TEXT",
                "message": "Requirement text cannot be empty.",
                "recovery_instruction": "Provide non-empty business requirements or policy rules in payload.text.",
            },
        )

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    full_text, sections = parse_markdown_content(payload.text)

    if payload.redact_pii:
        full_text = redact_pii(full_text)
        sections = {k: redact_pii(v) for k, v in sections.items()}

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
    """
    Retrieves a previously parsed requirement document by its unique ID.
    """
    if doc_id not in _DOCUMENT_STORE:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "DOCUMENT_NOT_FOUND",
                "message": f"Document '{doc_id}' not found.",
                "recovery_instruction": "Upload or ingest a document first via POST /api/ingest/upload or POST /api/ingest/text.",
            },
        )
    return _DOCUMENT_STORE[doc_id]


class InspectAgentRequest(BaseModel):
    spec: str = Field(..., description="Agent entrypoint specifier, e.g. path/to/agent.py:root_agent")


class InspectAgentResponse(BaseModel):
    spec: str
    valid: bool
    tools: list[str] = Field(default_factory=list)
    error: Optional[str] = None


@router.get("/sample-agents")
async def get_sample_agents():
    """Returns preset ADK sample agents and their verified tools."""
    from app.core.bridge import inspect_agent_tools
    return [
        {
            "id": "customer-support",
            "name": "Customer Support ADK Agent",
            "description": "E-commerce refund and order management agent with lookup and refund tools.",
            "spec": "examples/customer_support_adk/agent.py:root_agent",
            "tools": inspect_agent_tools("examples/customer_support_adk/agent.py:root_agent"),
        },
        {
            "id": "hr-benefits",
            "name": "HR Benefits ADK Agent",
            "description": "Enterprise HR employee policy advisor covering PTO, healthcare, and 401(k).",
            "spec": "examples/hr_benefits_adk/agent.py:root_agent",
            "tools": inspect_agent_tools("examples/hr_benefits_adk/agent.py:root_agent"),
        },
    ]


@router.post("/inspect-agent", response_model=InspectAgentResponse)
async def inspect_agent_endpoint(payload: InspectAgentRequest):
    """Validates target agent spec and extracts declared tools."""
    from app.core.bridge import inspect_agent_tools, load_adk_agent
    try:
        load_adk_agent(payload.spec)
        tools = inspect_agent_tools(payload.spec)
        return InspectAgentResponse(spec=payload.spec, valid=True, tools=tools)
    except Exception as e:
        return InspectAgentResponse(spec=payload.spec, valid=False, tools=[], error=str(e))


def get_document_by_id(doc_id: str) -> Optional[RequirementDocModel]:
    """Helper to access stored documents by ID."""
    return _DOCUMENT_STORE.get(doc_id)
