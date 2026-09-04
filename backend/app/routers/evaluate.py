"""
Evaluation Execution & Real-Time SSE Streaming Router.
"""

import asyncio
import json
import logging
import uuid
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.agents.compiler import TaskCompiler
from app.core.runner import eval_runner
from app.models.dataset import EvalDatasetModel
from app.models.scorecard import ExecutiveScorecardReport
from app.models.task import CompiledTaskResponse
from app.routers.dataset import get_dataset_by_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/eval", tags=["Evaluation"])

_compiler = TaskCompiler()

# In-memory storage for compiled tasks, event queues, and scorecard results
_COMPILED_TASKS: Dict[str, CompiledTaskResponse] = {}
_EVENT_QUEUES: Dict[str, asyncio.Queue] = {}
_SCORECARDS: Dict[str, ExecutiveScorecardReport] = {}
_EVAL_STATUS: Dict[str, str] = {}


class CompileTaskRequest(BaseModel):
    """Payload model for compiling a dataset into an Inspect AI task script."""
    dataset_id: str = Field(..., description="Unique dataset identifier to compile.", examples=["ds-01"])
    target_agent_path: str = Field(
        default="examples/customer_support_adk/agent.py:root_agent",
        description="Path and attribute identifier for the agent under test.",
        examples=["examples/customer_support_adk/agent.py:root_agent"],
    )
    task_name: Optional[str] = Field(
        default=None,
        description="Optional custom name for the task function and test runner.",
        examples=["eval_customer_support_v1"],
    )
    fail_on_error: bool = Field(
        default=False,
        description="Whether the Inspect test runner should stop on first sample exception.",
    )


class StartEvalRequest(BaseModel):
    """Payload model for initiating an evaluation run."""
    task_id: str = Field(..., description="Compiled task identifier from /api/eval/compile.", examples=["task-ab12cd34"])
    dataset_id: str = Field(..., description="Referenced evaluation dataset ID.", examples=["ds-01"])
    target_agent_path: str = Field(
        default="examples/customer_support_adk/agent.py:root_agent",
        description="Path to the target agent under test.",
    )


class StartEvalResponse(BaseModel):
    """Response returned upon successfully queuing an evaluation run."""
    eval_id: str = Field(..., description="Unique evaluation execution run ID.")
    task_id: str = Field(..., description="Referenced compiled task ID.")
    status: str = Field(default="running", description="Initial execution state ('running').")


@router.post("/compile", response_model=CompiledTaskResponse)
async def compile_task_endpoint(payload: CompileTaskRequest):
    """
    Compiles a synthesized evaluation dataset into an executable Inspect AI task script and Mermaid diagram.

    Args:
        payload (CompileTaskRequest): Dataset ID, target agent path, and compilation parameters.

    Returns:
        CompiledTaskResponse: Runnable Python task script, Mermaid diagram model, and task configuration.
    """
    dataset = get_dataset_by_id(payload.dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "DATASET_NOT_FOUND",
                "message": f"Dataset '{payload.dataset_id}' not found.",
                "recovery_instruction": "Create or synthesize a dataset via POST /api/dataset/synthesize before compiling.",
            },
        )

    compiled = _compiler.compile(
        dataset=dataset,
        target_agent_path=payload.target_agent_path,
        task_name=payload.task_name,
        fail_on_error=payload.fail_on_error,
    )

    _COMPILED_TASKS[compiled.task_id] = compiled
    return compiled


@router.post("/start", response_model=StartEvalResponse)
async def start_evaluation_endpoint(payload: StartEvalRequest):
    """
    Launches an evaluation run in an isolated worker subprocess with multi-scorer verification.

    Args:
        payload (StartEvalRequest): Task ID, dataset ID, and target agent path.

    Returns:
        StartEvalResponse: Generated eval_id and status tracking information.
    """
    dataset = get_dataset_by_id(payload.dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "DATASET_NOT_FOUND",
                "message": f"Dataset '{payload.dataset_id}' was not found.",
                "recovery_instruction": "Synthesize a dataset first via POST /api/dataset/synthesize.",
            },
        )

    compiled = _COMPILED_TASKS.get(payload.task_id)
    if not compiled:
        compiled = _compiler.compile(
            dataset=dataset,
            target_agent_path=payload.target_agent_path,
        )
        _COMPILED_TASKS[compiled.task_id] = compiled

    eval_id = f"eval-{uuid.uuid4().hex[:8]}"
    queue = asyncio.Queue()
    _EVENT_QUEUES[eval_id] = queue
    _EVAL_STATUS[eval_id] = "running"

    async def event_callback(event: Dict):
        await queue.put(event)

    async def run_in_background():
        try:
            scorecard = await eval_runner.execute_task(
                eval_id=eval_id,
                compiled_task=compiled,
                dataset=dataset,
                event_callback=event_callback,
            )
            _SCORECARDS[eval_id] = scorecard
            _EVAL_STATUS[eval_id] = "completed"
        except Exception as e:
            logger.error(f"Error in background eval run {eval_id}: {e}", exc_info=True)
            _EVAL_STATUS[eval_id] = "error"
            await queue.put({
                "event": "eval_error",
                "eval_id": eval_id,
                "error": str(e),
                "recovery_instruction": "Check worker logs, agent execution signatures, and dependency configuration.",
            })

    asyncio.create_task(run_in_background())

    return StartEvalResponse(
        eval_id=eval_id,
        task_id=compiled.task_id,
        status="running",
    )


@router.get("/{eval_id}/stream")
async def stream_evaluation(request: Request, eval_id: str):
    """
    Server-Sent Events (SSE) streaming endpoint delivering real-time logs and live evaluation progress.

    Args:
        eval_id (str): Evaluation run identifier.

    Returns:
        EventSourceResponse: SSE stream yielding progress and completion events.
    """
    from app.storage.suite_store import suite_store
    queue = _EVENT_QUEUES.get(eval_id)
    report = _SCORECARDS.get(eval_id) or suite_store.get_run_report(eval_id)

    if not queue and not report and _EVAL_STATUS.get(eval_id) not in ["running", "error"]:
        raise HTTPException(
            status_code=404,
            detail={
                "error_code": "EVAL_STREAM_NOT_FOUND",
                "message": f"Evaluation stream for '{eval_id}' was not found.",
                "recovery_instruction": "Start an evaluation run via POST /api/eval/start before connecting to the stream.",
            },
        )

    async def event_generator():
        # If already completed, send immediate complete event
        report = _SCORECARDS.get(eval_id) or suite_store.get_run_report(eval_id)
        if report:
            yield {
                "event": "eval_complete",
                "data": json.dumps({
                    "eval_id": eval_id,
                    "scorecard": report.model_dump(),
                }),
            }
            return

        if _EVAL_STATUS.get(eval_id) == "error":
            yield {
                "event": "eval_error",
                "data": json.dumps({
                    "eval_id": eval_id,
                    "error": "Evaluation execution failed or aborted.",
                }),
            }
            return

        if not queue:
            return

        while True:
            if await request.is_disconnected():
                break

            try:
                event = await asyncio.wait_for(queue.get(), timeout=1.0)
                event_type = event.get("event", "message")
                yield {
                    "event": event_type,
                    "data": json.dumps(event),
                }

                if event_type in ["eval_complete", "eval_error"]:
                    break
            except asyncio.TimeoutError:
                # Check if report completed asynchronously in storage
                rep = _SCORECARDS.get(eval_id) or suite_store.get_run_report(eval_id)
                if rep:
                    yield {
                        "event": "eval_complete",
                        "data": json.dumps({
                            "eval_id": eval_id,
                            "scorecard": rep.model_dump(),
                        }),
                    }
                    break
                # Keep-alive ping
                yield {"event": "ping", "data": ""}

    return EventSourceResponse(event_generator())


@router.post("/{eval_id}/cancel")
async def cancel_evaluation(eval_id: str):
    """
    Safely terminates an ongoing evaluation worker subprocess.

    Args:
        eval_id (str): The running evaluation ID.

    Returns:
        Dict: Cancellation confirmation status.
    """
    cancelled = await eval_runner.cancel_run(eval_id)
    _EVAL_STATUS[eval_id] = "cancelled"
    return {"status": "cancelled" if cancelled else "not_running", "eval_id": eval_id}


@router.get("/{eval_id}/status")
async def get_eval_status(eval_id: str):
    """
    Queries current execution lifecycle state and scorecard availability for an evaluation.

    Args:
        eval_id (str): Unique evaluation ID.

    Returns:
        Dict: Status details ('running', 'completed', 'error', 'cancelled').
    """
    from app.storage.suite_store import suite_store
    report = _SCORECARDS.get(eval_id) or suite_store.get_run_report(eval_id)
    has_scorecard = report is not None
    status = _EVAL_STATUS.get(eval_id)
    if has_scorecard and status != "error":
        status = "completed"
    elif not status:
        status = "completed" if has_scorecard else "unknown"
    return {"eval_id": eval_id, "status": status, "has_scorecard": has_scorecard}


def get_scorecard_by_id(eval_id: str) -> Optional[ExecutiveScorecardReport]:
    """Helper to access in-memory or persisted scorecards by evaluation ID."""
    from app.storage.suite_store import suite_store
    return _SCORECARDS.get(eval_id) or suite_store.get_run_report(eval_id)

