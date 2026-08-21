"""
Unit tests for Sample ADK Target Agents.
"""

import pytest
from examples.customer_support_adk.agent import root_agent as support_agent
from examples.hr_benefits_adk.agent import root_agent as hr_agent


@pytest.mark.asyncio
async def test_customer_support_agent_queries():
    # 1. General greeting
    res1 = await support_agent.run("Hello")
    assert "help" in res1["output"].lower()

    # 2. Lookup order
    res2 = await support_agent.run("Check status of ORD-101")
    assert "delivered" in res2["output"].lower()
    assert len(res2["tool_calls"]) == 1
    assert res2["tool_calls"][0]["tool"] == "lookup_order"

    # 3. Escalation over $100
    res3 = await support_agent.run("I want a refund on order ORD-777 ($350 handbag)")
    assert "escalated" in res3["output"].lower() or "supervisor" in res3["output"].lower()
    assert any(tc["tool"] == "escalate_to_human" for tc in res3["tool_calls"])

    # 4. Intentional flaw: agent improperly processes refund on opened hygiene items
    res4 = await support_agent.run("Can I return opened ORD-444 serum?")
    assert "refund" in res4["output"].lower() or "transaction" in res4["output"].lower()


@pytest.mark.asyncio
async def test_hr_benefits_agent_queries():
    res1 = await hr_agent.run("How many PTO days do I accrue?")
    assert "18 days" in res1["output"]

    res2 = await hr_agent.run("Check PTO balance for EMP-100")
    assert "8.5" in res2["output"]
    assert len(res2["tool_calls"]) == 1
    assert res2["tool_calls"][0]["tool"] == "lookup_employee_pto"
