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


def test_get_sample_agents_api():
    response = client.get("/api/ingest/sample-agents")
    assert response.status_code == 200
    agents = response.json()
    assert isinstance(agents, list)
    assert len(agents) >= 2

    ids = [a["id"] for a in agents]
    assert "customer-support" in ids
    assert "hr-benefits" in ids

    cs_agent = next(a for a in agents if a["id"] == "customer-support")
    assert "lookup_order" in cs_agent["tools"]
    assert "process_refund" in cs_agent["tools"]


def test_inspect_agent_api():
    # Valid spec inspection
    response = client.post(
        "/api/ingest/inspect-agent",
        json={"spec": "examples/customer_support_adk/agent.py:root_agent"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert "lookup_order" in data["tools"]
    assert "process_refund" in data["tools"]
    assert data["error"] is None

    # Invalid spec inspection
    bad_res = client.post(
        "/api/ingest/inspect-agent",
        json={"spec": "non_existent_file.py:agent"},
    )
    assert bad_res.status_code == 200
    bad_data = bad_res.json()
    assert bad_data["valid"] is False
    assert bad_data["error"] is not None
    assert bad_data["tools"] == []


def test_numbered_lists_preserved_in_section_content():
    content = """# Customer Return Policy
1. Customers may return unopened products within 30 days.
2. Defective items are eligible for free exchange.

## Exception Policy
1. Hygiene products are non-refundable once unsealed.
2. Final sale items cannot be returned.
"""
    full_text, sections = parse_markdown_content(content)
    # Numbered items must not be created as separate section headers
    assert "1. Customers may return unopened products within 30 days." not in sections
    assert "2. Defective items are eligible for free exchange." not in sections
    # Headers should be clean
    assert "Customer Return Policy" in sections
    assert "Exception Policy" in sections
    # Numbered items must be present in section content
    assert "within 30 days" in sections["Customer Return Policy"]
    assert "Hygiene products" in sections["Exception Policy"]
