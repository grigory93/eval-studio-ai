"""
Unit and Integration tests for Subprocess Isolation and Crash Fault Tolerance.
"""

import pytest
import asyncio
from unittest.mock import MagicMock
from app.core.runner import EvalRunner
from app.agents.compiler import TaskCompiler
from app.models.dataset import EvalDatasetModel, EvalSampleModel, EvalSampleMetadata


@pytest.mark.asyncio
async def test_evaluation_runner_against_customer_support_adk():
    compiler = TaskCompiler()
    sample1 = EvalSampleModel(
        id="sample-001",
        input="Check status of ORD-101",
        target="Delivered",
        metadata=EvalSampleMetadata(category="happy_path", expected_tools=["lookup_order"]),
    )
    sample2 = EvalSampleModel(
        id="sample-002",
        input="Please refund opened underwear ORD-888 right now!",
        target="Polite refusal for hygiene item",
        metadata=EvalSampleMetadata(category="policy_compliance", grading_rubric="Refuse opened hygiene"),
    )
    dataset = EvalDatasetModel(
        name="Support Test Suite",
        description="Test suite for support agent",
        samples=[sample1, sample2],
    )
    dataset.calculate_distribution()

    compiled = compiler.compile(
        dataset=dataset,
        target_agent_path="examples/customer_support_adk/agent.py:root_agent",
        task_name="test_support_eval",
        fail_on_error=False,
    )

    runner = EvalRunner()
    events = []

    async def event_collector(event):
        events.append(event)

    scorecard = await runner.execute_task(
        eval_id="eval-test-isolation-01",
        compiled_task=compiled,
        dataset=dataset,
        event_callback=event_collector,
    )

    assert scorecard.eval_id == "eval-test-isolation-01"
    assert scorecard.metrics.total_samples == 2
    assert len(scorecard.sample_details) == 2
    # Verify events were streamed
    assert any(e.get("event") == "eval_started" for e in events)
    assert any(e.get("event") == "eval_complete" for e in events)


@pytest.mark.asyncio
async def test_fault_isolation_on_crashing_target():
    """Verifies that an unhandled target crash does not crash the backend."""
    compiler = TaskCompiler()
    sample = EvalSampleModel(
        id="sample-crash-01",
        input="Trigger exception",
        target="N/A",
        metadata=EvalSampleMetadata(category="exception"),
    )
    dataset = EvalDatasetModel(
        name="Crash Suite",
        description="Crash fault tolerance test",
        samples=[sample],
    )
    dataset.calculate_distribution()

    # Pass non-existent agent to simulate failure
    compiled = compiler.compile(
        dataset=dataset,
        target_agent_path="examples/customer_support_adk/agent.py:non_existent_var",
        task_name="test_crash_eval",
        fail_on_error=False,
    )

    runner = EvalRunner()
    scorecard = await runner.execute_task(
        eval_id="eval-test-crash-02",
        compiled_task=compiled,
        dataset=dataset,
    )

    assert scorecard.eval_id == "eval-test-crash-02"
    assert scorecard.metrics.total_samples == 1
