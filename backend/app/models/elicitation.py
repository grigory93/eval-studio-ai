"""
Elicitation, Requirement Ingestion, and Socratic Clarification Models.
"""

from typing import Any, Dict, List, Literal, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field


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


class AmbiguityFinding(BaseModel):
    id: str = Field(..., description="Finding identifier")
    category: str = Field(..., description="E.g. 'Unclear Edge Case', 'Conflicting Rule', 'Missing Ground Truth'")
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
    ambiguities: List[AmbiguityFinding] = Field(
        default_factory=list, description="Associated ambiguity findings and their resolution status"
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
    ambiguities: Optional[List[AmbiguityFinding]] = None


class ResolveAmbiguityRequest(BaseModel):
    finding_id: str = Field(..., description="ID of the ambiguity finding to resolve")
    resolution: str = Field(..., description="User's decision or resolution text")
    create_rule: bool = Field(default=True, description="Whether to automatically add a rule to criteria")
    rule_type: Literal["domain_rules", "edge_cases", "safety_policies"] = Field(
        default="domain_rules", description="Target criteria list to add the formulated rule to"
    )


class DismissAmbiguityRequest(BaseModel):
    finding_id: str = Field(..., description="ID of the ambiguity finding to dismiss")


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


class ElicitationChatRequest(BaseModel):
    session_id: str = Field(default="default-session")
    message: str = Field(..., description="User chat response or answer")
    doc_id: Optional[str] = None
    existing_criteria: Optional[ConfirmedCriteriaModel] = None


class ElicitationChatResponse(BaseModel):
    session_id: str
    reply: str
    ambiguities: List[AmbiguityFinding] = Field(default_factory=list)
    suggested_options: List[str] = Field(default_factory=list)
    updated_criteria: ConfirmedCriteriaModel
    is_ready_for_synthesis: bool = Field(default=False)
