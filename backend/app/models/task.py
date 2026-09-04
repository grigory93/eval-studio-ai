"""
Inspect AI Task Compilation and Mermaid Diagram Data Contracts.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ScorerConfig(BaseModel):
    scorer_type: str = Field(
        ..., description="'model_graded_qa', 'policy_adherence', 'tool_verification', 'exact_match'"
    )
    name: str = Field(..., description="Scorer identifier")
    rubric: Optional[str] = Field(default=None, description="Model-graded grading rubric")
    expected_tools: Optional[List[str]] = Field(default=None)
    threshold: Optional[float] = Field(default=0.7)


class InspectTaskConfig(BaseModel):
    task_name: str = Field(default="eval_task", description="Inspect Task name")
    dataset_id: str = Field(..., description="Referenced dataset ID")
    target_agent_path: str = Field(
        ..., description="File path and symbol (e.g. examples/customer_support_adk/agent.py:root_agent)"
    )
    model_graded_judge_model: str = Field(
        default="google/gemini-2.5-flash", description="Model used for model-graded evaluation"
    )
    scorers: List[ScorerConfig] = Field(default_factory=list)
    fail_on_error: bool = Field(
        default=False, description="Whether to continue evaluation if individual sample errors out"
    )
    time_limit_seconds: Optional[int] = Field(default=60, description="Per-sample timeout")
    message_limit: Optional[int] = Field(default=10, description="Max conversation turns per sample")


class MermaidDiagramModel(BaseModel):
    diagram_code: str = Field(..., description="Mermaid syntax diagram string")
    title: str = Field(default="Evaluation Architecture & Flow")
    description: Optional[str] = Field(default=None)
    node_count: int = Field(default=0)


class CompiledTaskResponse(BaseModel):
    task_id: str
    task_name: str
    task_code: str = Field(..., description="Runnable Inspect AI Python task script")
    samples_json: Optional[str] = Field(default=None, description="Serialized JSON of raw dataset samples")
    sample_count: Optional[int] = Field(default=None, description="Total sample count")
    mermaid_diagram: MermaidDiagramModel
    config: InspectTaskConfig
