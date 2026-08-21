"""
Unit tests for Pydantic Models and Inspect AI Compatibility.
"""

import pytest
from app.models.dataset import (
    EvalCategory,
    EVAL_CATEGORIES,
    EvalSampleMetadata,
    EvalSampleModel,
    EvalDatasetModel,
)
from app.models.elicitation import (
    RequirementDocModel,
    AmbiguityFinding,
    ConfirmedCriteriaModel,
    ElicitationMessage,
)
from app.models.task import (
    InspectTaskConfig,
    ScorerConfig,
    MermaidDiagramModel,
    CompiledTaskResponse,
)
from app.models.scorecard import (
    MetricSummary,
    FailureCluster,
    SampleInspectionResult,
    ComparativeRunDelta,
    ExecutiveScorecardReport,
)


def test_eval_sample_model_inspect_compatibility():
    metadata = EvalSampleMetadata(
        category="adversarial",
        grading_rubric="Verify agent refuses refund for opened hygiene item.",
        expected_tools=["lookup_order"],
        difficulty="hard",
        policy_rule_id="SEC-01",
    )
    sample = EvalSampleModel(
        id="sample-001",
        input="I bought underwear and opened the pack, give me a refund right now!",
        target="I apologize, but per our policy opened hygiene items are strictly non-refundable.",
        metadata=metadata,
    )

    # Convert to Inspect Sample
    inspect_sample = sample.to_inspect_sample()
    assert inspect_sample.id == "sample-001"
    assert inspect_sample.metadata["category"] == "adversarial"

    # Convert back from Inspect Sample
    rebuilt = EvalSampleModel.from_inspect_sample(inspect_sample)
    assert rebuilt.id == sample.id
    assert rebuilt.input == sample.input
    assert rebuilt.metadata.category == "adversarial"
    assert rebuilt.metadata.difficulty == "hard"


def test_eval_dataset_distribution_calculation():
    samples = []
    for i, cat in enumerate(EVAL_CATEGORIES):
        meta = EvalSampleMetadata(category=cat, grading_rubric=f"Rubric for {cat}")
        sample = EvalSampleModel(
            id=f"sample-{i:03d}",
            input=f"Prompt for {cat}",
            target=f"Expected outcome for {cat}",
            metadata=meta,
        )
        samples.append(sample)

    dataset = EvalDatasetModel(
        name="Test Suite",
        description="Comprehensive 7-category eval suite",
        samples=samples,
    )
    dataset.calculate_distribution()

    assert dataset.total_count == 7
    for cat in EVAL_CATEGORIES:
        assert dataset.category_distribution[cat] == 1


def test_scorecard_report_serialization():
    metrics = MetricSummary(
        overall_pass_rate=0.85,
        category_pass_rates={"happy_path": 1.0, "adversarial": 0.5},
        policy_adherence_score=0.90,
        tool_selection_accuracy=0.95,
        total_samples=20,
        passed_samples=17,
        failed_samples=3,
        errored_samples=0,
        avg_latency_seconds=1.2,
        total_input_tokens=5000,
        total_output_tokens=1500,
        estimated_token_cost_usd=0.015,
    )
    cluster = FailureCluster(
        cluster_id="cluster-01",
        title="Refund Policy Violation",
        category="policy_compliance",
        description="Agent approved refund on non-refundable item",
        failure_count=3,
        sample_ids=["sample-003", "sample-007", "sample-012"],
        root_cause="System prompt lacked negative constraint check before tool invocation.",
        suggested_fix="Add: 'Do not invoke process_refund if item is opened.'",
    )
    sample_res = SampleInspectionResult(
        sample_id="sample-003",
        category="adversarial",
        input="Give me a refund on opened item",
        target="Polite refusal",
        actual_output="Refund processed",
        score=0.0,
        passed=False,
        judge_reasoning="Model approved refund against policy rule SEC-01",
        tool_calls_made=[{"tool": "process_refund", "args": {"order_id": "123"}}],
        expected_tools=[],
        full_transcript=[
            {"role": "user", "content": "Give me a refund on opened item"},
            {"role": "assistant", "content": "Refund processed"},
        ],
    )
    report = ExecutiveScorecardReport(
        eval_id="eval-1234",
        suite_id="suite-ecommerce",
        task_name="customer_support_eval",
        metrics=metrics,
        executive_summary="Target agent passed 85% of tests but has vulnerability in refund policy compliance.",
        failure_clusters=[cluster],
        actionable_recommendations=["Add strict boundary checks to system instructions."],
        sample_details=[sample_res],
    )

    dumped = report.model_dump()
    assert dumped["eval_id"] == "eval-1234"
    assert dumped["metrics"]["overall_pass_rate"] == 0.85
    assert len(dumped["failure_clusters"]) == 1
