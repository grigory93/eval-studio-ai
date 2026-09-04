"""
Unit tests for Socratic Elicitation and Gap-Detection Agent.
"""

import pytest
from app.agents.elicitation import ElicitationAgent
from app.models.elicitation import RequirementDocModel, ConfirmedCriteriaModel


@pytest.mark.asyncio
async def test_elicitation_agent_document_analysis():
    agent = ElicitationAgent()
    doc = RequirementDocModel(
        doc_id="doc-test-01",
        filename="ecommerce_policy.md",
        content_type="text/markdown",
        extracted_text="""# E-Commerce Refund Policy
1. Returns within 30 days.
2. Hygiene items (underwear, opened cosmetics) are strictly non-refundable.
3. Refunds over $100 require supervisor approval.""",
        sections={
            "Policy 1": "Returns within 30 days.",
            "Policy 2": "Hygiene items are non-refundable.",
        },
    )

    reply, ambiguities, options, criteria = await agent.analyze_document(doc)

    assert len(reply) > 10
    assert len(ambiguities) >= 1
    assert len(options) >= 2
    assert criteria.use_case != ""
    assert len(criteria.safety_policies) >= 1
    assert any("hygiene" in s.lower() or "non-refundable" in s.lower() for s in criteria.safety_policies + criteria.domain_rules)


@pytest.mark.asyncio
async def test_elicitation_agent_chat_clarification():
    agent = ElicitationAgent()
    initial_criteria = ConfirmedCriteriaModel(
        criteria_id="crit-001",
        use_case="Customer Support Agent",
        domain_rules=["30-day returns allowed."],
        safety_policies=["Opened hygiene items strictly non-refundable."],
        expected_tools=["lookup_order", "process_refund"],
    )

    response = await agent.chat_clarify(
        user_message="If the hygiene item arrived defective from the manufacturer, permit a replacement only, no cash refund.",
        current_criteria=initial_criteria,
    )

    assert response.is_ready_for_synthesis is True
    assert any("defective" in r.lower() or "replacement" in r.lower() for r in response.updated_criteria.domain_rules + response.updated_criteria.edge_cases)


def test_resolve_finding_and_dismiss_finding():
    from app.models.elicitation import AmbiguityFinding
    agent = ElicitationAgent()
    crit = ConfirmedCriteriaModel(
        criteria_id="crit-test",
        use_case="Test Case",
        domain_rules=["Rule 1"],
        ambiguities=[
            AmbiguityFinding(
                id="gap-01",
                category="Edge Case",
                description="Damaged items policy",
                suggested_question="Are damaged items refundable?",
                status="unresolved",
            ),
            AmbiguityFinding(
                id="gap-02",
                category="Limits",
                description="Supervisor limits",
                suggested_question="What is the limit?",
                status="unresolved",
            ),
        ],
    )

    # Resolve gap-01
    updated, finding = agent.resolve_finding(crit, "gap-01", "Allow damaged items with photo proof", "domain_rules")
    assert finding is not None
    assert finding.status == "resolved"
    assert finding.resolution == "Allow damaged items with photo proof"
    assert "Allow damaged items with photo proof" in updated.domain_rules
    assert updated.ambiguities[0].status == "resolved"
    assert updated.ambiguities[1].status == "unresolved"

    # Dismiss gap-02
    updated2 = agent.dismiss_finding(updated, "gap-02")
    assert updated2.ambiguities[1].status == "dismissed"


def test_resolve_finding_different_rule_types():
    from app.models.elicitation import AmbiguityFinding
    agent = ElicitationAgent()
    crit = ConfirmedCriteriaModel(
        criteria_id="crit-types",
        use_case="Test Case",
        domain_rules=[],
        edge_cases=[],
        safety_policies=[],
        ambiguities=[
            AmbiguityFinding(
                id="gap-ec",
                category="Edge Case",
                description="Network drop during checkout",
                suggested_question="How to handle network drops?",
                status="unresolved",
            ),
            AmbiguityFinding(
                id="gap-sp",
                category="Security",
                description="Prompt injection attempt",
                suggested_question="How to handle injection?",
                status="unresolved",
            ),
        ],
    )

    # Resolve to edge_cases
    updated, _ = agent.resolve_finding(crit, "gap-ec", "Retry idempotent payment once", "edge_cases")
    assert "Retry idempotent payment once" in updated.edge_cases
    assert len(updated.domain_rules) == 0

    # Resolve to safety_policies
    updated2, _ = agent.resolve_finding(updated, "gap-sp", "Strictly terminate and alert on injection", "safety_policies")
    assert "Strictly terminate and alert on injection" in updated2.safety_policies


@pytest.mark.asyncio
async def test_elicitation_agent_with_target_agent_and_tools():
    agent = ElicitationAgent()
    doc = RequirementDocModel(
        doc_id="doc-agent-test",
        filename="refund_policy.md",
        content_type="text/markdown",
        extracted_text="# Refund Policy\nItems must be returned in 30 days.\nPerishable items cannot be refunded.",
        sections={"Policy": "Items returned in 30 days. Perishable items non-refundable."},
    )

    reply, ambiguities, options, criteria = await agent.analyze_document(
        doc=doc,
        target_agent_path="examples/customer_support_adk/agent.py:root_agent",
        known_tools=["lookup_order", "process_refund", "escalate_to_human"],
    )

    assert criteria.target_agent_path == "examples/customer_support_adk/agent.py:root_agent"
    assert "lookup_order" in criteria.expected_tools
    assert "process_refund" in criteria.expected_tools
    assert len(ambiguities) >= 1
    for amb in ambiguities:
        assert amb.status == "unresolved"
        assert len(amb.suggested_options) >= 1


@pytest.mark.asyncio
async def test_chat_clarify_preserves_ambiguities():
    from app.models.elicitation import AmbiguityFinding
    agent = ElicitationAgent()
    existing_ambiguities = [
        AmbiguityFinding(
            id="gap-1",
            category="Return Window",
            description="Is shipping time included in 30 days?",
            suggested_question="Does 30 days count from delivery or order date?",
            status="resolved",
            resolved=True,
            resolution="30 days from confirmed delivery date",
        ),
        AmbiguityFinding(
            id="gap-2",
            category="Condition",
            description="Opened packaging allowance?",
            suggested_question="Can open boxes be returned?",
            status="unresolved",
            resolved=False,
        ),
        AmbiguityFinding(
            id="gap-3",
            category="Escalation",
            description="Manager override limit?",
            suggested_question="What is the supervisor limit?",
            status="unresolved",
            resolved=False,
        ),
    ]

    criteria = ConfirmedCriteriaModel(
        criteria_id="crit-preservation",
        use_case="E-commerce support",
        domain_rules=["30 days from confirmed delivery date"],
        ambiguities=existing_ambiguities,
    )

    response = await agent.chat_clarify(
        user_message="Open boxes can be returned with 10% restocking fee.",
        current_criteria=criteria,
    )

    # Ambiguities must be preserved
    updated_ambs = response.updated_criteria.ambiguities
    assert len(updated_ambs) == 3
    # gap-1 was already resolved and must remain untouched
    assert updated_ambs[0].id == "gap-1"
    assert updated_ambs[0].status == "resolved"
    assert updated_ambs[0].resolution == "30 days from confirmed delivery date"
    # gap-2 was answered by user and should now be resolved
    assert updated_ambs[1].id == "gap-2"
    assert updated_ambs[1].status == "resolved"
    # gap-3 was not addressed and must remain unresolved
    assert updated_ambs[2].id == "gap-3"
    assert updated_ambs[2].status == "unresolved"


# ---------------------------------------------------------------------------
# Router Integration Tests
# ---------------------------------------------------------------------------

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_elicitation_router_lifecycle():
    # 1. Ingest document first
    ingest_res = client.post(
        "/api/ingest/text",
        json={"title": "Test Policy", "text": "# Test Policy\nAll sales final after 14 days."},
    )
    assert ingest_res.status_code == 200
    doc_id = ingest_res.json()["doc_id"]

    # 2. Initiate elicitation with target agent path
    init_res = client.post(
        "/api/elicitation/initiate",
        json={
            "doc_id": doc_id,
            "target_agent_path": "examples/customer_support_adk/agent.py:root_agent",
        },
    )
    assert init_res.status_code == 200
    init_data = init_res.json()
    assert "criteria" in init_data
    criteria = init_data["criteria"]
    criteria_id = criteria["criteria_id"]
    assert criteria["target_agent_path"] == "examples/customer_support_adk/agent.py:root_agent"
    assert len(criteria["ambiguities"]) >= 1

    finding_id = criteria["ambiguities"][0]["id"]

    # 3. Resolve an ambiguity via router
    resolve_res = client.post(
        f"/api/elicitation/criteria/{criteria_id}/ambiguities/resolve",
        json={
            "finding_id": finding_id,
            "resolution": "Permit returns within 14 days with receipt",
            "create_rule": True,
            "rule_type": "domain_rules",
        },
    )
    assert resolve_res.status_code == 200
    resolved_crit = resolve_res.json()
    target_finding = next(a for a in resolved_crit["ambiguities"] if a["id"] == finding_id)
    assert target_finding["status"] == "resolved"
    assert target_finding["resolution"] == "Permit returns within 14 days with receipt"
    assert any("14 days" in r for r in resolved_crit["domain_rules"])

    # 4. Patch criteria (CRUD)
    patch_res = client.patch(
        f"/api/elicitation/criteria/{criteria_id}",
        json={
            "domain_rules": ["Custom Domain Rule 1", "Custom Domain Rule 2"],
            "edge_cases": ["Edge Case Alpha"],
            "safety_policies": ["Never disclose API keys"],
            "expected_tools": ["lookup_order", "process_refund"],
        },
    )
    assert patch_res.status_code == 200
    patched_crit = patch_res.json()
    assert patched_crit["domain_rules"] == ["Custom Domain Rule 1", "Custom Domain Rule 2"]
    assert patched_crit["edge_cases"] == ["Edge Case Alpha"]
    assert patched_crit["safety_policies"] == ["Never disclose API keys"]
    assert patched_crit["expected_tools"] == ["lookup_order", "process_refund"]

    # 5. Dismiss ambiguity finding
    # Add a mock ambiguity to dismiss
    mock_ambiguities = patched_crit["ambiguities"] + [
        {
            "id": "gap-to-dismiss",
            "category": "Minor",
            "description": "Optional gap",
            "suggested_question": "Dismiss me?",
            "status": "unresolved",
            "resolved": False,
        }
    ]
    client.patch(f"/api/elicitation/criteria/{criteria_id}", json={"ambiguities": mock_ambiguities})

    dismiss_res = client.post(
        f"/api/elicitation/criteria/{criteria_id}/ambiguities/dismiss",
        json={"finding_id": "gap-to-dismiss"},
    )
    assert dismiss_res.status_code == 200
    dismissed_crit = dismiss_res.json()
    dismissed_finding = next(a for a in dismissed_crit["ambiguities"] if a["id"] == "gap-to-dismiss")
    assert dismissed_finding["status"] == "dismissed"

    # 6. Error handling: 404s
    assert client.patch("/api/elicitation/criteria/nonexistent-id", json={"domain_rules": []}).status_code == 404
    assert client.post(
        "/api/elicitation/criteria/nonexistent-id/ambiguities/resolve",
        json={"finding_id": "f", "resolution": "r"},
    ).status_code == 404
    assert client.post(
        f"/api/elicitation/criteria/{criteria_id}/ambiguities/resolve",
        json={"finding_id": "nonexistent-finding-id", "resolution": "r"},
    ).status_code == 404
    assert client.post(
        f"/api/elicitation/criteria/{criteria_id}/ambiguities/dismiss",
        json={"finding_id": "nonexistent-finding-id"},
    ).status_code == 404
