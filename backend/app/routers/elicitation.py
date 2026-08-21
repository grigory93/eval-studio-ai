"""
Interactive Elicitation Chat Router.
"""

from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.elicitation import ElicitationAgent
from app.models.elicitation import (
    ConfirmedCriteriaModel,
    ElicitationChatRequest,
    ElicitationChatResponse,
)
from app.routers.ingest import get_document_by_id

router = APIRouter(prefix="/api/elicitation", tags=["Elicitation"])

# Store active criteria by session/doc
_CRITERIA_STORE: Dict[str, ConfirmedCriteriaModel] = {}
_elicitation_agent = ElicitationAgent()


class InitiateElicitationRequest(BaseModel):
    doc_id: str = Field(..., description="Document identifier from ingestion")


class InitiateElicitationResponse(BaseModel):
    session_id: str
    reply: str
    ambiguities: list
    suggested_options: list
    criteria: ConfirmedCriteriaModel


@router.post("/initiate", response_model=InitiateElicitationResponse)
async def initiate_elicitation(payload: InitiateElicitationRequest):
    """Initializes Socratic probing on a previously ingested document."""
    doc = get_document_by_id(payload.doc_id)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail=f"Document {payload.doc_id} not found. Please upload or ingest first.",
        )

    reply, ambiguities, options, criteria = await _elicitation_agent.analyze_document(doc)
    _CRITERIA_STORE[criteria.criteria_id] = criteria

    return InitiateElicitationResponse(
        session_id=criteria.criteria_id,
        reply=reply,
        ambiguities=ambiguities,
        suggested_options=options,
        criteria=criteria,
    )


@router.post("/chat", response_model=ElicitationChatResponse)
async def chat_elicitation(payload: ElicitationChatRequest):
    """Answers Socratic questions and dynamically refines evaluation criteria."""
    criteria = payload.existing_criteria
    if not criteria:
        criteria = _CRITERIA_STORE.get(
            payload.session_id,
            ConfirmedCriteriaModel(
                criteria_id=payload.session_id,
                use_case="General Agent Evaluation",
                domain_rules=[],
            ),
        )

    doc_text = ""
    if payload.doc_id:
        doc = get_document_by_id(payload.doc_id)
        if doc:
            doc_text = doc.extracted_text

    response = await _elicitation_agent.chat_clarify(
        user_message=payload.message,
        current_criteria=criteria,
        doc_text=doc_text,
    )

    _CRITERIA_STORE[response.updated_criteria.criteria_id] = response.updated_criteria
    return response


@router.post("/confirm", response_model=ConfirmedCriteriaModel)
async def confirm_criteria(payload: ConfirmedCriteriaModel):
    """Explicitly marks criteria as confirmed by the user, ready for synthesis."""
    confirmed = payload.model_copy(update={"is_confirmed": True})
    _CRITERIA_STORE[confirmed.criteria_id] = confirmed
    return confirmed


@router.get("/criteria/{criteria_id}", response_model=ConfirmedCriteriaModel)
async def get_criteria(criteria_id: str):
    if criteria_id not in _CRITERIA_STORE:
        raise HTTPException(status_code=404, detail="Criteria not found.")
    return _CRITERIA_STORE[criteria_id]


def get_criteria_by_id(criteria_id: str) -> Optional[ConfirmedCriteriaModel]:
    return _CRITERIA_STORE.get(criteria_id)
