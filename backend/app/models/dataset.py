"""
Dataset and Sample Data Models compatible with Inspect AI Sample schema.
"""

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field

EvalCategory = Literal[
    "happy_path",
    "edge_case",
    "adversarial",
    "tool_usage",
    "exception",
    "policy_compliance",
    "multi_turn",
]

EVAL_CATEGORIES: List[EvalCategory] = [
    "happy_path",
    "edge_case",
    "adversarial",
    "tool_usage",
    "exception",
    "policy_compliance",
    "multi_turn",
]


class EvalSampleMetadata(BaseModel):
    category: EvalCategory = Field(..., description="Evaluation category")
    grading_rubric: Optional[str] = Field(
        default=None, description="Criteria for model-graded judge"
    )
    expected_tools: Optional[List[str]] = Field(
        default=None, description="Expected tool names to be invoked"
    )
    difficulty: Optional[Literal["easy", "medium", "hard"]] = Field(
        default="medium", description="Difficulty tier"
    )
    policy_rule_id: Optional[str] = Field(
        default=None, description="Referenced policy clause ID"
    )
    custom_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional arbitrary metadata"
    )


class EvalSampleModel(BaseModel):
    id: str = Field(..., description="Unique sample identifier (e.g. sample-001)")
    input: Union[str, List[Dict[str, Any]]] = Field(
        ..., description="Prompt string or ChatMessage list submitted to agent"
    )
    target: Union[str, List[str]] = Field(
        ..., description="Ideal ground truth outcome or narrative criteria"
    )
    choices: Optional[List[str]] = Field(
        default=None, description="Optional multiple choice options"
    )
    metadata: EvalSampleMetadata = Field(
        ..., description="Structured metadata including category and grading rubric"
    )
    sandbox: Optional[Union[str, tuple[str, str]]] = Field(
        default=None, description="Optional sandbox environment specification"
    )
    files: Optional[Dict[str, str]] = Field(
        default=None, description="Optional virtual files provisioned in sandbox"
    )
    setup: Optional[str] = Field(
        default=None, description="Optional setup script for sandbox"
    )

    def to_inspect_sample(self):
        """Converts to native inspect_ai.dataset.Sample object."""
        try:
            from inspect_ai.dataset import Sample
            return Sample(
                id=self.id,
                input=self.input,
                target=self.target,
                choices=self.choices,
                metadata=self.metadata.model_dump(),
                sandbox=self.sandbox,
                files=self.files,
                setup=self.setup,
            )
        except ImportError:
            return {
                "id": self.id,
                "input": self.input,
                "target": self.target,
                "choices": self.choices,
                "metadata": self.metadata.model_dump(),
                "sandbox": self.sandbox,
                "files": self.files,
                "setup": self.setup,
            }

    @classmethod
    def from_inspect_sample(cls, sample: Any) -> "EvalSampleModel":
        """Builds EvalSampleModel from inspect_ai Sample object or dictionary."""
        if hasattr(sample, "id"):
            meta_dict = sample.metadata or {}
            category = meta_dict.get("category", "happy_path")
            metadata = EvalSampleMetadata(
                category=category,
                grading_rubric=meta_dict.get("grading_rubric"),
                expected_tools=meta_dict.get("expected_tools"),
                difficulty=meta_dict.get("difficulty", "medium"),
                policy_rule_id=meta_dict.get("policy_rule_id"),
                custom_metadata={
                    k: v
                    for k, v in meta_dict.items()
                    if k
                    not in [
                        "category",
                        "grading_rubric",
                        "expected_tools",
                        "difficulty",
                        "policy_rule_id",
                    ]
                },
            )
            return cls(
                id=str(sample.id),
                input=sample.input,
                target=sample.target or "",
                choices=sample.choices,
                metadata=metadata,
                sandbox=sample.sandbox,
                files=sample.files,
                setup=sample.setup,
            )
        elif isinstance(sample, dict):
            return cls.model_validate(sample)
        raise ValueError(f"Unsupported sample type: {type(sample)}")


class EvalDatasetModel(BaseModel):
    id: str = Field(default="dataset-default", description="Unique dataset identifier")
    name: str = Field(..., description="Human-readable dataset name")
    description: str = Field(..., description="Dataset purpose and description")
    samples: List[EvalSampleModel] = Field(
        default_factory=list, description="List of evaluation samples"
    )
    total_count: int = Field(default=0, description="Total sample count")
    category_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Count of samples per category"
    )

    def calculate_distribution(self) -> None:
        """Calculates and updates total_count and category_distribution."""
        self.total_count = len(self.samples)
        counts: Dict[str, int] = {cat: 0 for cat in EVAL_CATEGORIES}
        for s in self.samples:
            cat = s.metadata.category
            counts[cat] = counts.get(cat, 0) + 1
        self.category_distribution = counts


class DatasetSynthesizeRequest(BaseModel):
    confirmed_criteria_id: Optional[str] = None
    use_case: str = Field(..., description="Business use case summary")
    domain_rules: List[str] = Field(default_factory=list)
    sample_count: int = Field(default=50, ge=10, le=200)
    categories: Optional[List[EvalCategory]] = None


class SampleUpdateRequest(BaseModel):
    input: Optional[Union[str, List[Dict[str, Any]]]] = None
    target: Optional[Union[str, List[str]]] = None
    category: Optional[EvalCategory] = None
    grading_rubric: Optional[str] = None
    expected_tools: Optional[List[str]] = None
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None
