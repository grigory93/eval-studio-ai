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
    resolved: bool = Field(default=False)
    resolution: Optional[str] = Field(default=None)


class ConfirmedCriteriaModel(BaseModel):
    criteria_id: str = Field(default="crit-default", description="Criteria identifier")
    use_case: str = Field(..., description="High-level description of agent purpose")
    target_agent_description: str = Field(default="", description="Description of target agent under test")
    domain_rules: List[str] = Field(default_factory=list, description="Explicit business rules")
    edge_cases: List[str] = Field(default_factory=list, description="Identified edge and boundary scenarios")
    safety_policies: List[str] = Field(default_factory=list, description="Negative constraints and safety rules")
    expected_tools: List[str] = Field(default_factory=list, description="List of tool names agent is expected to use")
    evaluation_rubrics: Dict[str, str] = Field(
        default_factory=dict, description="Rubric definitions mapped by category"
    )
    is_confirmed: bool = Field(default=False, description="Whether criteria is approved by user")


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
