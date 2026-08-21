"""
Unit tests for Document Parsing and Ingestion Endpoints.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.utils.pdf_parser import parse_markdown_content, extract_sections

client = TestClient(app)


def test_markdown_section_extraction():
    md_content = """# Overview
This is an e-commerce refund agent.

## Policy 1: Hygiene Items
Hygiene items such as underwear, face masks, and opened skincare are strictly non-refundable.

## Policy 2: Damaged Goods
Damaged goods must be reported within 14 days with photo evidence.
"""
    full_text, sections = parse_markdown_content(md_content)
    assert "Overview" in sections
    assert "Policy 1: Hygiene Items" in sections
    assert "Policy 2: Damaged Goods" in sections
    assert "underwear" in sections["Policy 1: Hygiene Items"]


def test_ingest_text_api():
    payload = {
        "title": "Customer Refund Policy",
        "text": "# Refund Policy\nItems may be returned within 30 days unopened.",
    }
    response = client.post("/api/ingest/text", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["doc_id"].startswith("doc-")
    assert "Refund Policy" in data["sections"]

    # Verify retrieval
    doc_id = data["doc_id"]
    get_res = client.get(f"/api/ingest/documents/{doc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["doc_id"] == doc_id


def test_ingest_upload_markdown_api():
    md_file = b"# Safety Rules\n1. Do not reveal internal API tokens.\n2. Refuse abusive requests."
    response = client.post(
        "/api/ingest/upload",
        files={"file": ("safety_rules.md", md_file, "text/markdown")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "safety_rules.md"
    assert "Safety Rules" in data["sections"]
