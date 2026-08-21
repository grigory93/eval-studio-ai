"""
Scorecard, Metric Summaries, Failure Clusters, and Comparative Regression Models.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class MetricSummary(BaseModel):
    overall_pass_rate: float = Field(..., ge=0.0, le=1.0)
    category_pass_rates: Dict[str, float] = Field(
        default_factory=dict, description="Pass rate per category from grouped metrics"
    )
    policy_adherence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    tool_selection_accuracy: float = Field(default=1.0, ge=0.0, le=1.0)
    total_samples: int = Field(default=0)
    passed_samples: int = Field(default=0)
    failed_samples: int = Field(default=0)
    errored_samples: int = Field(default=0)
    avg_latency_seconds: float = Field(default=0.0)
    total_input_tokens: int = Field(default=0)
    total_output_tokens: int = Field(default=0)
    estimated_token_cost_usd: float = Field(default=0.0)


class FailureCluster(BaseModel):
    cluster_id: str
    title: str
    category: str
    description: str
    failure_count: int
    sample_ids: List[str]
    root_cause: str
    suggested_fix: str


class SampleInspectionResult(BaseModel):
    sample_id: str
    category: str
    input: str
    target: str
    actual_output: str
    score: float = Field(default=0.0)
    passed: bool = Field(default=False)
    judge_reasoning: str = Field(default="")
    tool_calls_made: List[Dict[str, Any]] = Field(default_factory=list)
    expected_tools: Optional[List[str]] = None
    error_message: Optional[str] = None
    full_transcript: List[Dict[str, Any]] = Field(default_factory=list)


class ComparativeRunDelta(BaseModel):
    baseline_eval_id: str
    baseline_timestamp: str
    overall_pass_rate_delta: float
    category_deltas: Dict[str, float] = Field(default_factory=dict)
    newly_failed_sample_ids: List[str] = Field(default_factory=list)
    newly_passed_sample_ids: List[str] = Field(default_factory=list)


class ExecutiveScorecardReport(BaseModel):
    eval_id: str
    suite_id: str = Field(default="suite-default")
    task_name: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metrics: MetricSummary
    comparative_delta: Optional[ComparativeRunDelta] = None
    executive_summary: str
    failure_clusters: List[FailureCluster] = Field(default_factory=list)
    actionable_recommendations: List[str] = Field(default_factory=list)
    sample_details: List[SampleInspectionResult] = Field(default_factory=list)
