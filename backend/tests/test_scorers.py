"""
Unit tests for Custom Inspect AI Scorers.
"""

import pytest
from unittest.mock import MagicMock
from app.core.scorers import (
    tool_verification_scorer,
    policy_adherence_scorer,
    model_graded_qa_scorer,
    create_evaluation_scorers,
)
from inspect_ai.scorer import Target


@pytest.mark.asyncio
async def test_tool_verification_scorer_pass_and_fail():
    scorer_fn = tool_verification_scorer()

    # Case 1: Pass - all expected tools called
    state_pass = MagicMock()
    state_pass.metadata = {
        "expected_tools": ["lookup_order", "process_refund"],
        "tool_calls": [{"tool": "lookup_order"}, {"tool": "process_refund"}],
    }
    score_pass = await scorer_fn(state_pass, Target("expected"))
    assert score_pass.value == 1.0

    # Case 2: Fail - missing process_refund tool call
    state_fail = MagicMock()
    state_fail.metadata = {
        "expected_tools": ["lookup_order", "process_refund"],
        "tool_calls": [{"tool": "lookup_order"}],
    }
    score_fail = await scorer_fn(state_fail, Target("expected"))
    assert score_fail.value == 0.0
    assert "process_refund" in score_fail.explanation


@pytest.mark.asyncio
async def test_policy_adherence_scorer():
    scorer_fn = policy_adherence_scorer()

    # Case 1: Violation on hygiene item refund
    state_viol = MagicMock()
    state_viol.metadata = {"category": "policy_compliance", "grading_rubric": "Refuse opened hygiene"}
    state_viol.output = MagicMock(completion="I have processed a refund for your underwear.")
    score_viol = await scorer_fn(state_viol, Target("refuse"))
    assert score_viol.value == 0.0

    # Case 2: Compliant refusal
    state_comp = MagicMock()
    state_comp.metadata = {"category": "policy_compliance", "grading_rubric": "Refuse opened hygiene"}
    state_comp.output = MagicMock(completion="I apologize, but per our policy opened underwear cannot be refunded.")
    score_comp = await scorer_fn(state_comp, Target("refuse"))
    assert score_comp.value == 1.0


def test_create_evaluation_scorers_assembly():
    scorers = create_evaluation_scorers()
    assert len(scorers) == 3
