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
    dataset_id: str
    target_agent_path: str = "examples/customer_support_adk/agent.py:root_agent"
    task_name: Optional[str] = None
    fail_on_error: bool = False


class StartEvalRequest(BaseModel):
    task_id: str
    dataset_id: str
    target_agent_path: str = "examples/customer_support_adk/agent.py:root_agent"


class StartEvalResponse(BaseModel):
    eval_id: str
    task_id: str
    status: str


@router.post("/compile", response_model=CompiledTaskResponse)
async def compile_task_endpoint(payload: CompileTaskRequest):
    """Compiles an approved dataset into an Inspect AI task and Mermaid diagram."""
    dataset = get_dataset_by_id(payload.dataset_id)
    if not dataset:
        raise HTTPException(
            status_code=404, detail=f"Dataset {payload.dataset_id} not found."
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
    """Launches an evaluation run in an isolated worker subprocess."""
    dataset = get_dataset_by_id(payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

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
            })

    asyncio.create_task(run_in_background())

    return StartEvalResponse(
        eval_id=eval_id,
        task_id=compiled.task_id,
        status="running",
    )


@router.get("/{eval_id}/stream")
async def stream_evaluation(request: Request, eval_id: str):
    """SSE streaming endpoint providing live logs and execution progress."""
    queue = _EVENT_QUEUES.get(eval_id)
    if not queue and eval_id not in _SCORECARDS:
        raise HTTPException(status_code=404, detail="Evaluation stream not found.")

    async def event_generator():
        # If already completed, send immediate complete event
        if eval_id in _SCORECARDS:
            yield {
                "event": "eval_complete",
                "data": json.dumps({
                    "eval_id": eval_id,
                    "scorecard": _SCORECARDS[eval_id].model_dump(),
                }),
            }
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
                # Keep-alive ping
                yield {"event": "ping", "data": ""}

    return EventSourceResponse(event_generator())


@router.post("/{eval_id}/cancel")
async def cancel_evaluation(eval_id: str):
    """Cancels a running evaluation subprocess."""
    cancelled = await eval_runner.cancel_run(eval_id)
    _EVAL_STATUS[eval_id] = "cancelled"
    return {"status": "cancelled" if cancelled else "not_running"}


@router.get("/{eval_id}/status")
async def get_eval_status(eval_id: str):
    status = _EVAL_STATUS.get(eval_id, "unknown")
    has_scorecard = eval_id in _SCORECARDS
    return {"eval_id": eval_id, "status": status, "has_scorecard": has_scorecard}


def get_scorecard_by_id(eval_id: str) -> Optional[ExecutiveScorecardReport]:
    return _SCORECARDS.get(eval_id)
