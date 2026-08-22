"""
Dataset Management & Synthesis Router.
Handles benchmark dataset synthesis across 7 evaluation taxonomy categories,
individual sample CRUD operations, and category distribution balancing.
"""

from typing import Dict, List, Literal, Optional, Union
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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
    """Payload model for adding a single new evaluation sample to an existing dataset."""
    input: Union[str, List[Dict[str, str]]] = Field(
        ...,
        description="Prompt string or ChatMessage list submitted to the target agent under test.",
        examples=["Can I return opened ORD-444 serum?"],
    )
    target: Union[str, List[str]] = Field(
        ...,
        description="Expected ideal agent output narrative or ground truth criteria.",
        examples=["Polite refusal explaining opened hygiene items are non-refundable."],
    )
    category: EvalCategory = Field(
        ...,
        description="Evaluation taxonomy category classification.",
        examples=["policy_compliance"],
    )
    grading_rubric: Optional[str] = Field(
        default=None,
        description="Explicit scoring rubric for the model-graded judge.",
        examples=["Verify that agent refuses refund on opened hygiene item."],
    )
    expected_tools: Optional[List[str]] = Field(
        default=None,
        description="List of tool function names expected to be invoked during the turn.",
        examples=[["lookup_order"]],
    )
    difficulty: Optional[Literal["easy", "medium", "hard"]] = Field(
        default="medium",
        description="Difficulty tier classification for the test case.",
    )


@router.post("/synthesize", response_model=EvalDatasetModel)
async def synthesize_dataset(payload: DatasetSynthesizeRequest):
    """
    Synthesizes a structured benchmark dataset containing 10-200 samples across the 7 taxonomy dimensions.

    Args:
        payload (DatasetSynthesizeRequest): Criteria ID, use case description, sample count, and target categories.

    Returns:
        EvalDatasetModel: The synthesized dataset with categorized samples and distribution statistics.
    """
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
    """
    Lists all evaluation datasets stored in the active session.

    Returns:
        List[EvalDatasetModel]: Collection of stored datasets.
    """
    return list(_DATASET_STORE.values())


@router.get("/{dataset_id}", response_model=EvalDatasetModel)
async def get_dataset(dataset_id: str):
    """
    Retrieves a specific evaluation dataset by its unique identifier.

    Args:
        dataset_id (str): The unique dataset ID (e.g. 'ds-01').

    Returns:
        EvalDatasetModel: Complete dataset object including all samples.

    Raises:
        HTTPException: 404 error with recovery instructions if the dataset is not found.
    """
    if dataset_id not in _DATASET_STORE:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "DATASET_NOT_FOUND",
                "message": f"Dataset '{dataset_id}' not found.",
                "recovery_instruction": "Call POST /api/dataset/synthesize first to generate a dataset or verify the dataset ID.",
            },
        )
    return _DATASET_STORE[dataset_id]


@router.post("/{dataset_id}/samples", response_model=EvalSampleModel)
async def add_sample(dataset_id: str, payload: AddSampleRequest):
    """
    Appends a new test sample to an existing evaluation dataset.

    Args:
        dataset_id (str): Target dataset identifier.
        payload (AddSampleRequest): The validated test sample to append.

    Returns:
        EvalSampleModel: The created sample with generated ID.
    """
    if dataset_id not in _DATASET_STORE:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "DATASET_NOT_FOUND",
                "message": f"Cannot add sample: Dataset '{dataset_id}' was not found.",
                "recovery_instruction": "Ensure the dataset ID exists by checking GET /api/dataset.",
            },
        )

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
    """
    Updates an existing sample's input, target ground truth, rubric, or taxonomy category.

    Args:
        dataset_id (str): Target dataset ID.
        sample_id (str): Target sample ID within the dataset.
        payload (SampleUpdateRequest): Fields to update.

    Returns:
        EvalSampleModel: The updated sample object.
    """
    if dataset_id not in _DATASET_STORE:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "DATASET_NOT_FOUND",
                "message": f"Dataset '{dataset_id}' not found.",
                "recovery_instruction": "Verify dataset_id matches an existing dataset in the session.",
            },
        )

    dataset = _DATASET_STORE[dataset_id]
    target_sample = next((s for s in dataset.samples if s.id == sample_id), None)

    if not target_sample:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "SAMPLE_NOT_FOUND",
                "message": f"Sample '{sample_id}' not found in dataset '{dataset_id}'.",
                "recovery_instruction": "Verify the sample ID from dataset.samples list before updating.",
            },
        )

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
    """
    Deletes a test sample and rebalances category distribution.

    Args:
        dataset_id (str): Dataset ID.
        sample_id (str): Sample ID to remove.

    Returns:
        Dict: Confirmation status with remaining sample count.
    """
    if dataset_id not in _DATASET_STORE:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "DATASET_NOT_FOUND",
                "message": f"Dataset '{dataset_id}' not found.",
                "recovery_instruction": "Verify dataset ID before issuing DELETE.",
            },
        )

    dataset = _DATASET_STORE[dataset_id]
    initial_len = len(dataset.samples)
    dataset.samples = [s for s in dataset.samples if s.id != sample_id]

    if len(dataset.samples) == initial_len:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "SAMPLE_NOT_FOUND",
                "message": f"Sample '{sample_id}' not found in dataset '{dataset_id}'.",
                "recovery_instruction": "Check sample ID list in GET /api/dataset/{dataset_id}.",
            },
        )

    dataset.calculate_distribution()
    return {"status": "deleted", "sample_id": sample_id, "remaining_count": dataset.total_count}


def get_dataset_by_id(dataset_id: str) -> Optional[EvalDatasetModel]:
    """Helper method to access a dataset from storage by ID."""
    return _DATASET_STORE.get(dataset_id)

