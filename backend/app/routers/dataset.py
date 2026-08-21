"""
Dataset Management & Synthesis Router.
"""

from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.synthesizer import DatasetSynthesizerAgent
from app.models.dataset import (
    DatasetSynthesizeRequest,
    EvalCategory,
    EvalDatasetModel,
    EvalSampleMetadata,
    EvalSampleModel,
    SampleUpdateRequest,
)
from app.models.elicitation import ConfirmedCriteriaModel
from app.routers.elicitation import get_criteria_by_id

router = APIRouter(prefix="/api/dataset", tags=["Dataset"])

# In-memory store for datasets
_DATASET_STORE: Dict[str, EvalDatasetModel] = {}
_synthesizer_agent = DatasetSynthesizerAgent()


class AddSampleRequest(BaseModel):
    input: str
    target: str
    category: EvalCategory
    grading_rubric: Optional[str] = None
    expected_tools: Optional[List[str]] = None
    difficulty: Optional[str] = "medium"


@router.post("/synthesize", response_model=EvalDatasetModel)
async def synthesize_dataset(payload: DatasetSynthesizeRequest):
    """Synthesizes 50-200 samples across the 7 taxonomy categories."""
    criteria = None
    if payload.confirmed_criteria_id:
        criteria = get_criteria_by_id(payload.confirmed_criteria_id)

    if not criteria:
        criteria = ConfirmedCriteriaModel(
            criteria_id="crit-ad-hoc",
            use_case=payload.use_case,
            domain_rules=payload.domain_rules,
            target_agent_description=f"Agent for {payload.use_case}",
        )

    dataset = await _synthesizer_agent.synthesize_dataset(
        criteria=criteria,
        sample_count=payload.sample_count,
        categories=payload.categories,
    )

    _DATASET_STORE[dataset.id] = dataset
    return dataset


@router.get("", response_model=List[EvalDatasetModel])
async def list_datasets():
    """Lists all stored datasets."""
    return list(_DATASET_STORE.values())


@router.get("/{dataset_id}", response_model=EvalDatasetModel)
async def get_dataset(dataset_id: str):
    """Retrieves a dataset by ID."""
    if dataset_id not in _DATASET_STORE:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found.")
    return _DATASET_STORE[dataset_id]


@router.post("/{dataset_id}/samples", response_model=EvalSampleModel)
async def add_sample(dataset_id: str, payload: AddSampleRequest):
    """Adds a new custom sample to the dataset."""
    if dataset_id not in _DATASET_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    dataset = _DATASET_STORE[dataset_id]
    sample_id = f"sample-{len(dataset.samples) + 1:03d}"
    new_sample = EvalSampleModel(
        id=sample_id,
        input=payload.input,
        target=payload.target,
        metadata=EvalSampleMetadata(
            category=payload.category,
            grading_rubric=payload.grading_rubric or f"Verify adherence to {payload.category} standard.",
            expected_tools=payload.expected_tools or [],
            difficulty=payload.difficulty or "medium",
        ),
    )

    dataset.samples.append(new_sample)
    dataset.calculate_distribution()
    return new_sample


@router.put("/{dataset_id}/samples/{sample_id}", response_model=EvalSampleModel)
async def update_sample(
    dataset_id: str, sample_id: str, payload: SampleUpdateRequest
):
    """Updates an existing sample's input, target, rubric, or category."""
    if dataset_id not in _DATASET_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    dataset = _DATASET_STORE[dataset_id]
    target_sample = next((s for s in dataset.samples if s.id == sample_id), None)

    if not target_sample:
        raise HTTPException(status_code=404, detail=f"Sample {sample_id} not found.")

    if payload.input is not None:
        target_sample.input = payload.input
    if payload.target is not None:
        target_sample.target = payload.target
    if payload.category is not None:
        target_sample.metadata.category = payload.category
    if payload.grading_rubric is not None:
        target_sample.metadata.grading_rubric = payload.grading_rubric
    if payload.expected_tools is not None:
        target_sample.metadata.expected_tools = payload.expected_tools
    if payload.difficulty is not None:
        target_sample.metadata.difficulty = payload.difficulty

    dataset.calculate_distribution()
    return target_sample


@router.delete("/{dataset_id}/samples/{sample_id}")
async def delete_sample(dataset_id: str, sample_id: str):
    """Deletes a test sample and updates category distribution."""
    if dataset_id not in _DATASET_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    dataset = _DATASET_STORE[dataset_id]
    initial_len = len(dataset.samples)
    dataset.samples = [s for s in dataset.samples if s.id != sample_id]

    if len(dataset.samples) == initial_len:
        raise HTTPException(status_code=404, detail=f"Sample {sample_id} not found.")

    dataset.calculate_distribution()
    return {"status": "deleted", "sample_id": sample_id, "remaining_count": dataset.total_count}


def get_dataset_by_id(dataset_id: str) -> Optional[EvalDatasetModel]:
    return _DATASET_STORE.get(dataset_id)
