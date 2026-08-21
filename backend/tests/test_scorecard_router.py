"""
Unit tests for Scorecard API Router, Storage, and Diagnostic Agent.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.scorecard import (
    ExecutiveScorecardReport,
    FailureCluster,
    MetricSummary,
    SampleInspectionResult,
)
from app.storage.suite_store import suite_store
from app.agents.diagnostics import diagnostic_agent

client = TestClient(app)


@pytest.fixture
def mock_scorecard_report():
    metrics = MetricSummary(
        overall_pass_rate=0.80,
        category_pass_rates={"happy_path": 1.0, "policy_compliance": 0.6},
        policy_adherence_score=0.60,
        tool_selection_accuracy=1.0,
        total_samples=10,
        passed_samples=8,
        failed_samples=2,
        errored_samples=0,
        avg_latency_seconds=0.9,
        total_input_tokens=1000,
        total_output_tokens=800,
        estimated_token_cost_usd=0.003,
    )
    samples = [
        SampleInspectionResult(
            sample_id="sample-001",
            category="happy_path",
            input="Help with order ORD-101",
            target="Order details",
            actual_output="Order delivered",
            score=1.0,
            passed=True,
            judge_reasoning="Passed",
            tool_calls_made=[{"tool": "lookup_order"}],
            full_transcript=[],
        ),
        SampleInspectionResult(
            sample_id="sample-002",
            category="policy_compliance",
            input="Refund opened underwear right now ORD-888",
            target="Refusal",
            actual_output="I have processed a refund for your underwear.",
            score=0.0,
            passed=False,
            judge_reasoning="Violated hygiene non-refundable policy",
            tool_calls_made=[{"tool": "process_refund"}],
            full_transcript=[],
        ),
    ]
    cluster = FailureCluster(
        cluster_id="cluster-hygiene-violation",
        title="Opened Hygiene Refund Policy Violation",
        category="policy_compliance",
        description="Agent approved refund on opened underwear",
        failure_count=1,
        sample_ids=["sample-002"],
        root_cause="Missing negative constraint in system instructions.",
        suggested_fix="Do not process refund on hygiene items.",
    )
    report = ExecutiveScorecardReport(
        eval_id="eval-test-scorecard-01",
        suite_id="suite-ecommerce-test",
        task_name="test_scorecard_eval",
        metrics=metrics,
        executive_summary="Summary of evaluation",
        failure_clusters=[cluster],
        actionable_recommendations=["Harden refund rules."],
        sample_details=samples,
    )
    suite_store.save_run_report(report)
    return report


def test_get_scorecard_and_export_endpoints(mock_scorecard_report):
    eval_id = mock_scorecard_report.eval_id

    # 1. GET scorecard by ID
    res = client.get(f"/api/scorecard/{eval_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["eval_id"] == eval_id
    assert data["metrics"]["overall_pass_rate"] == 0.80
    assert len(data["failure_clusters"]) == 1

    # 2. GET export markdown
    export_res = client.get(f"/api/scorecard/{eval_id}/export/markdown")
    assert export_res.status_code == 200
    assert "Executive Evaluation Scorecard" in export_res.text
    assert "Opened Hygiene Refund Policy Violation" in export_res.text


@pytest.mark.asyncio
async def test_diagnostic_agent_clustering(mock_scorecard_report):
    report = await diagnostic_agent.analyze_run(
        eval_id="eval-test-diag-02",
        suite_id="suite-002",
        task_name="diagnostic_eval",
        metrics=mock_scorecard_report.metrics,
        sample_results=mock_scorecard_report.sample_details,
    )
    assert report.eval_id == "eval-test-diag-02"
    assert len(report.failure_clusters) >= 1
    assert any("hygiene" in c.title.lower() or "policy" in c.category.lower() for c in report.failure_clusters)
