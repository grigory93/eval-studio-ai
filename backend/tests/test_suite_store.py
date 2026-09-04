"""
Unit tests for SuiteStore dual persistence, fallback lookups, and run list deduplication.
"""

import json
from pathlib import Path
import pytest
from app.config import settings
from app.models.scorecard import (
    ExecutiveScorecardReport,
    MetricSummary,
    SampleInspectionResult,
)
from app.storage.suite_store import SuiteStore


@pytest.fixture
def temp_suite_store(tmp_path):
    runs_dir = tmp_path / "sandbox_runs"
    suites_dir = tmp_path / "suites"
    runs_dir.mkdir()
    suites_dir.mkdir()
    return SuiteStore(suites_dir=suites_dir, runs_dir=runs_dir), runs_dir


@pytest.fixture
def sample_report():
    metrics = MetricSummary(
        overall_pass_rate=0.9,
        category_pass_rates={"happy_path": 1.0, "policy_compliance": 0.8},
        policy_adherence_score=0.8,
        tool_selection_accuracy=1.0,
        total_samples=10,
        passed_samples=9,
        failed_samples=1,
        errored_samples=0,
        avg_latency_seconds=0.7,
        total_input_tokens=1000,
        total_output_tokens=700,
        estimated_token_cost_usd=0.002,
    )
    samples = [
        SampleInspectionResult(
            sample_id="sample-001",
            category="happy_path",
            input="Status ORD-1",
            target="Shipped",
            actual_output="Shipped",
            score=1.0,
            passed=True,
            judge_reasoning="Accurate",
            tool_calls_made=[],
            full_transcript=[],
        )
    ]
    return ExecutiveScorecardReport(
        eval_id="eval-dual-persist-01",
        suite_id="suite-001",
        task_name="test_dual_persist",
        metrics=metrics,
        executive_summary="Executive summary test",
        failure_clusters=[],
        actionable_recommendations=[],
        sample_details=samples,
    )


def test_suite_store_dual_path_persistence(temp_suite_store, sample_report, tmp_path, monkeypatch):
    """Verifies that save_run_report persists in runs_dir and mirrors to data_dir / runs."""
    store, runs_dir = temp_suite_store
    repo_data_dir = tmp_path / "repo_data"
    repo_data_runs = repo_data_dir / "runs"
    repo_data_runs.mkdir(parents=True)
    monkeypatch.setattr(settings, "data_dir", repo_data_dir)

    store.save_run_report(sample_report)

    # Check runs_dir
    primary_file = runs_dir / sample_report.eval_id / "scorecard_report.json"
    assert primary_file.exists(), "Report should be saved in sandbox runs_dir"

    # Check mirror in repo data_dir / runs
    mirrored_file = repo_data_runs / sample_report.eval_id / "scorecard_report.json"
    assert mirrored_file.exists(), "Report should be mirrored to repo data_dir/runs"

    loaded_primary = json.loads(primary_file.read_text(encoding="utf-8"))
    loaded_mirror = json.loads(mirrored_file.read_text(encoding="utf-8"))
    assert loaded_primary["eval_id"] == sample_report.eval_id
    assert loaded_mirror["eval_id"] == sample_report.eval_id


def test_suite_store_fallback_lookup(temp_suite_store, sample_report, tmp_path, monkeypatch):
    """Verifies that get_run_report retrieves reports from data_dir/runs if absent in runs_dir."""
    store, runs_dir = temp_suite_store
    repo_data_dir = tmp_path / "repo_data"
    repo_data_runs = repo_data_dir / "runs"
    fallback_folder = repo_data_runs / sample_report.eval_id
    fallback_folder.mkdir(parents=True)
    fallback_file = fallback_folder / "scorecard_report.json"
    fallback_file.write_text(sample_report.model_dump_json(indent=2), encoding="utf-8")

    monkeypatch.setattr(settings, "data_dir", repo_data_dir)

    # Ensure runs_dir does not have it
    primary_file = runs_dir / sample_report.eval_id / "scorecard_report.json"
    assert not primary_file.exists()

    # get_run_report should find it via fallback
    retrieved = store.get_run_report(sample_report.eval_id)
    assert retrieved is not None
    assert retrieved.eval_id == sample_report.eval_id
    assert retrieved.metrics.overall_pass_rate == sample_report.metrics.overall_pass_rate


def test_suite_store_list_runs_deduplication(temp_suite_store, sample_report, tmp_path, monkeypatch):
    """Verifies that list_runs aggregates and deduplicates across runs_dir and data_dir/runs."""
    store, runs_dir = temp_suite_store
    repo_data_dir = tmp_path / "repo_data"
    repo_data_runs = repo_data_dir / "runs"
    repo_data_runs.mkdir(parents=True)
    monkeypatch.setattr(settings, "data_dir", repo_data_dir)

    # Save report (written to both places)
    store.save_run_report(sample_report)

    # Also add a unique historical report only in data_dir/runs
    historical_report = sample_report.model_copy(update={"eval_id": "eval-historical-99"})
    hist_folder = repo_data_runs / historical_report.eval_id
    hist_folder.mkdir(parents=True)
    (hist_folder / "scorecard_report.json").write_text(
        historical_report.model_dump_json(indent=2), encoding="utf-8"
    )

    all_runs = store.list_runs()
    eval_ids = [r.eval_id for r in all_runs]

    # Verify both exist and the duplicated one is not listed twice
    assert "eval-dual-persist-01" in eval_ids
    assert "eval-historical-99" in eval_ids
    assert len(eval_ids) == len(set(eval_ids)), "List of runs must not contain duplicates"
