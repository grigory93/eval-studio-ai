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


def test_runs_dir_isolation_from_workspace_root():
    """
    Verifies that the default sandbox runs directory is completely isolated from the
    repository root workspace so Uvicorn --reload never detects dynamic Python script writes.
    """
    from app.config import settings, REPO_ROOT
    from app.core.sandbox import sandbox_manager

    # 1. Verify runs_dir is not within REPO_ROOT
    try:
        settings.runs_dir.relative_to(REPO_ROOT)
        is_inside_repo = True
    except ValueError:
        is_inside_repo = False

    assert not is_inside_repo, (
        f"settings.runs_dir ({settings.runs_dir}) must not be inside REPO_ROOT ({REPO_ROOT}) "
        "to prevent Uvicorn WatchFiles from restarting mid-evaluation."
    )

    # 2. Verify sandbox_manager creates run directories inside settings.runs_dir
    run_dir = sandbox_manager.create_run_environment("test-isolation-check-01")
    assert run_dir.is_dir()
    assert run_dir.parent == settings.runs_dir
    test_py = run_dir / "worker_test.py"
    test_py.write_text("print('isolated')", encoding="utf-8")
    assert test_py.exists()
    assert not (REPO_ROOT / "worker_test.py").exists()


@pytest.mark.asyncio
async def test_eval_runner_granular_sample_progress_emission():
    """
    Verifies that EvalRunner emits granular per-sample log_chunk events with proportional
    progress (5% -> 90%), sample IDs, category classifications, and finishing at 95% and 100%.
    """
    compiler = TaskCompiler()
    samples = [
        EvalSampleModel(
            id=f"sample-prog-{i:03d}",
            input=f"Prompt for sample {i}",
            target="Ideal response",
            metadata=EvalSampleMetadata(category="policy_compliance" if i % 2 == 0 else "tool_usage"),
        )
        for i in range(1, 5)
    ]
    dataset = EvalDatasetModel(
        name="Progress Suite",
        description="Suite to test granular progress emissions",
        samples=samples,
    )
    dataset.calculate_distribution()

    compiled = compiler.compile(
        dataset=dataset,
        target_agent_path="examples/customer_support_adk/agent.py:root_agent",
        task_name="test_progress_eval",
        fail_on_error=False,
    )

    runner = EvalRunner()
    events = []

    async def event_collector(event):
        events.append(event)

    scorecard = await runner.execute_task(
        eval_id="eval-test-progress-01",
        compiled_task=compiled,
        dataset=dataset,
        event_callback=event_collector,
    )

    assert scorecard.metrics.total_samples == 4

    # Filter sample-level progress events
    sample_progress_events = [
        e for e in events
        if e.get("event") == "log_chunk" and e.get("current_sample_id") is not None
    ]
    assert len(sample_progress_events) == 4, "Must emit one log_chunk event per sample evaluated"

    for idx, e in enumerate(sample_progress_events):
        expected_sample_id = f"sample-prog-{(idx + 1):03d}"
        assert e["current_sample_id"] == expected_sample_id
        assert e["completed_samples"] == idx + 1
        assert e["total_samples"] == 4
        # Proportional progress should increase across samples up to 90%
        expected_pct = max(5, min(90, int(((idx + 1) / 4) * 90)))
        assert e["progress_percent"] == expected_pct

    # Verify diagnostics progress (95%)
    diag_events = [
        e for e in events
        if e.get("event") == "log_chunk" and e.get("progress_percent") == 95
    ]
    assert len(diag_events) >= 1, "Must emit diagnostic clustering progress event at 95%"

    # Verify complete event
    complete_events = [e for e in events if e.get("event") == "eval_complete"]
    assert len(complete_events) == 1
    assert complete_events[0]["scorecard"]["eval_id"] == "eval-test-progress-01"


@pytest.mark.asyncio
async def test_eval_runner_worker_timeout_protection(monkeypatch):
    """
    Verifies that when a worker subprocess hangs or exceeds worker_timeout_seconds,
    EvalRunner cleanly raises TimeoutError, terminates/kills the subprocess, and cleans up.
    """
    from unittest.mock import AsyncMock, patch
    from app.config import settings

    compiler = TaskCompiler()
    sample = EvalSampleModel(
        id="sample-timeout-01",
        input="Hang forever",
        target="N/A",
        metadata=EvalSampleMetadata(category="exception"),
    )
    dataset = EvalDatasetModel(
        name="Timeout Suite",
        description="Timeout test",
        samples=[sample],
    )
    dataset.calculate_distribution()

    compiled = compiler.compile(
        dataset=dataset,
        target_agent_path="examples/customer_support_adk/agent.py:root_agent",
        task_name="test_timeout_eval",
        fail_on_error=False,
    )

    runner = EvalRunner()

    # Simulate timeout by setting worker_timeout_seconds very small and mocking subprocess to sleep
    monkeypatch.setattr(settings, "worker_timeout_seconds", 0.1)

    async def mock_wait_for(fut, timeout):
        if hasattr(fut, "close"):
            fut.close()
        raise asyncio.TimeoutError()

    with patch("asyncio.wait_for", side_effect=mock_wait_for):
        with pytest.raises(TimeoutError, match="timed out after"):
            await runner.execute_task(
                eval_id="eval-test-timeout-01",
                compiled_task=compiled,
                dataset=dataset,
            )

    # Verify active_processes was cleaned up
    assert "eval-test-timeout-01" not in runner.active_processes

