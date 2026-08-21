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
