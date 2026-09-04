"""
Elicitation, Requirement Ingestion, and Socratic Clarification Models.
"""

from typing import Any, Dict, List, Literal, Optional, Union
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.models.dataset import EvalCategory, EVAL_CATEGORIES


class RequirementDocModel(BaseModel):
    doc_id: str = Field(..., description="Unique document ID")
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(..., description="MIME type or file extension (pdf, md, txt)")
    extracted_text: str = Field(..., description="Full parsed plaintext")
    sections: Dict[str, str] = Field(
        default_factory=dict, description="Parsed sections or headings mapped to content"
    )
    summary: Optional[str] = Field(default=None, description="Executive summary of requirements")
    uploaded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ClauseReference(BaseModel):
    clause_id: str = Field(..., description="Unique clause identifier (e.g. SEC-01)")
    heading: str = Field(..., description="Section title or clause name")
    text_snippet: str = Field(..., description="Key policy excerpt or rule summary")


class EvaluationSeed(BaseModel):
    seed_id: str = Field(..., description="Unique seed identifier (e.g. seed-hp-01)")
    category: EvalCategory = Field(..., description="Inspect AI taxonomy category")
    source_clause_id: Optional[str] = Field(default=None, description="Referenced clause ID")
    scenario_intent: str = Field(..., description="Brief summary of test condition")
    sample_input: Union[str, List[Dict[str, Any]]] = Field(
        ..., description="Concrete user query prompt or multi-turn messages"
    )
    expected_target: str = Field(
        ..., description="Ideal ground truth agent behavior / refusal narrative"
    )
    grading_rubric: str = Field(..., description="Pass/fail criteria for model-graded judge")
    expected_tools: List[str] = Field(default_factory=list, description="Expected tools to invoke")
    difficulty: Literal["easy", "medium", "hard"] = Field(default="medium")
    status: Literal["proposed", "accepted", "dismissed"] = Field(default="proposed")


class TaxonomyCoverage(BaseModel):
    category: EvalCategory
    target_count: int = Field(default=3, description="Target seeds count per category")
    accepted_count: int = Field(default=0, description="Current accepted seeds count")
    coverage_score: float = Field(default=0.0, description="Coverage ratio from 0.0 to 1.0")
    status: Literal["gap", "partial", "complete"] = Field(default="gap")


class AmbiguityFinding(BaseModel):
    id: str = Field(..., description="Finding identifier")
    category: str = Field(
        ..., description="E.g. 'Unclear Edge Case', 'Conflicting Rule', 'Missing Ground Truth'"
    )
    description: str = Field(..., description="Explanation of ambiguity or gap")
    suggested_question: str = Field(..., description="Socratic probing question for the user")
    status: Literal["unresolved", "resolved", "dismissed"] = Field(
        default="unresolved", description="Status of this ambiguity"
    )
    resolved: bool = Field(default=False)
    resolution: Optional[str] = Field(default=None)
    suggested_options: List[str] = Field(
        default_factory=list, description="Quick-reply resolution options"
    )


class ConfirmedCriteriaModel(BaseModel):
    criteria_id: str = Field(default="crit-default", description="Criteria identifier")
    use_case: str = Field(..., description="High-level description of agent purpose")
    target_agent_description: str = Field(default="", description="Description of target agent under test")
    target_agent_path: str = Field(
        default="examples/customer_support_adk/agent.py:root_agent",
        description="Target ADK agent specifier",
    )
    domain_rules: List[str] = Field(default_factory=list, description="Explicit business rules")
    edge_cases: List[str] = Field(default_factory=list, description="Identified edge and boundary scenarios")
    safety_policies: List[str] = Field(default_factory=list, description="Negative constraints and safety rules")
    expected_tools: List[str] = Field(default_factory=list, description="List of tool names agent is expected to use")
    clauses: List[ClauseReference] = Field(
        default_factory=list, description="Parsed spec clauses for grounding"
    )
    ambiguities: List[AmbiguityFinding] = Field(
        default_factory=list, description="Associated ambiguity findings and their resolution status"
    )
    test_seeds: List[EvaluationSeed] = Field(
        default_factory=list, description="Distilled category scenario seeds ready for Step 4"
    )
    taxonomy_coverage: Dict[str, float] = Field(
        default_factory=dict, description="Coverage score per category (0.0 to 1.0)"
    )
    evaluation_rubrics: Dict[str, str] = Field(
        default_factory=dict, description="Rubric definitions mapped by category"
    )
    is_confirmed: bool = Field(default=False, description="Whether criteria is approved by user")


class UpdateCriteriaRequest(BaseModel):
    use_case: Optional[str] = None
    target_agent_description: Optional[str] = None
    target_agent_path: Optional[str] = None
    domain_rules: Optional[List[str]] = None
    edge_cases: Optional[List[str]] = None
    safety_policies: Optional[List[str]] = None
    expected_tools: Optional[List[str]] = None
    clauses: Optional[List[ClauseReference]] = None
    ambiguities: Optional[List[AmbiguityFinding]] = None
    test_seeds: Optional[List[EvaluationSeed]] = None
    taxonomy_coverage: Optional[Dict[str, float]] = None


class ResolveAmbiguityRequest(BaseModel):
    finding_id: str = Field(..., description="ID of the ambiguity finding to resolve")
    resolution: str = Field(..., description="User's decision or resolution text")
    create_rule: bool = Field(default=True, description="Whether to automatically add a rule to criteria")
    rule_type: Literal["domain_rules", "edge_cases", "safety_policies"] = Field(
        default="domain_rules", description="Target criteria list to add the formulated rule to"
    )


class DismissAmbiguityRequest(BaseModel):
    finding_id: str = Field(..., description="ID of the ambiguity finding to dismiss")


class AcceptSeedRequest(BaseModel):
    seed_id: str = Field(..., description="ID of proposed seed to accept into blueprint")
    modified_seed: Optional[EvaluationSeed] = Field(
        default=None, description="Optional edited seed content overriding proposed values"
    )


class DismissSeedRequest(BaseModel):
    seed_id: str = Field(..., description="ID of proposed seed to dismiss")


class AddSeedRequest(BaseModel):
    seed: EvaluationSeed = Field(..., description="Custom test seed to add to blueprint")


class DeepDiveRequest(BaseModel):
    category: EvalCategory = Field(..., description="Category to conduct deep dive on")
    focus_area: Optional[str] = Field(default=None, description="Optional specific constraint or tool focus")


class SampleAgentInfo(BaseModel):
    id: str
    name: str
    description: str
    spec: str
    tools: List[str] = Field(default_factory=list)


class ElicitationMessage(BaseModel):
    id: str = Field(..., description="Message UUID")
    role: Literal["user", "assistant", "system"] = Field(...)
    content: str = Field(...)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    clarification_options: Optional[List[str]] = Field(
        default=None, description="Quick-reply suggested options"
    )
    ambiguities_detected: Optional[List[AmbiguityFinding]] = Field(default=None)
    proposed_seeds: Optional[List[EvaluationSeed]] = Field(default=None)


class ElicitationChatRequest(BaseModel):
    session_id: str = Field(default="default-session")
    message: str = Field(..., description="User chat response or answer")
    doc_id: Optional[str] = None
    existing_criteria: Optional[ConfirmedCriteriaModel] = None
    mode: Literal["walkthrough", "chat", "gaps"] = Field(
        default="chat", description="Active canvas mode"
    )


class ElicitationChatResponse(BaseModel):
    session_id: str
    reply: str
    ambiguities: List[AmbiguityFinding] = Field(default_factory=list)
    suggested_options: List[str] = Field(default_factory=list)
    updated_criteria: ConfirmedCriteriaModel
    proposed_seeds: List[EvaluationSeed] = Field(
        default_factory=list, description="Newly generated or active scenario proposal cards"
    )
    taxonomy_coverage: Dict[str, float] = Field(
        default_factory=dict, description="Current category coverage metrics"
    )
    is_ready_for_synthesis: bool = Field(default=False)
    active_mode: Literal["walkthrough", "chat", "gaps"] = Field(default="chat")
