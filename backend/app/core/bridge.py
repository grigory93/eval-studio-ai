"""
Target ADK Agent Dynamic Loader and Inspect AI Bridge.
Wraps local Google ADK agents into Inspect AI Solvers and intercepts tool calls
with strict schema validation, detailed parameter documentation, and actionable error recovery.
"""

import hashlib
import importlib.util
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

from inspect_ai.model import ChatMessageUser, ModelOutput
from inspect_ai.solver import Generate, TaskState, solver
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic Schemas for Agent Loader and Solver Contracts
# ---------------------------------------------------------------------------

class AgentSpecModel(BaseModel):
    """Validation schema for target agent module and attribute specification."""
    spec: str = Field(
        ...,
        description="Path and attribute specifier formatted as 'path/to/module.py:agent_variable'.",
        pattern=r"^.+\.py:[a-zA-Z_][a-zA-Z0-9_]*$",
        examples=["examples/customer_support_adk/agent.py:root_agent"],
    )


class AgentExecutionError(BaseModel):
    """Structured error payload attached when target agent execution fails."""
    status: str = Field(default="error", description="Failure status indicator.")
    error_code: str = Field(..., description="Machine-readable error category.")
    error_message: str = Field(..., description="Human-readable exception details.")
    recovery_instruction: str = Field(
        ...,
        description="Actionable guidance instructing the LLM / evaluator on how to recover from failure.",
    )
    target_spec: str = Field(..., description="The target agent spec that failed execution.")


# ---------------------------------------------------------------------------
# Agent Dynamic Loader & Inspect Solver
# ---------------------------------------------------------------------------

def load_adk_agent(spec: str) -> Any:
    """
    Dynamically loads an agent instance from a filesystem path and attribute name.

    Args:
        spec (str): Path and attribute name separated by a colon, e.g.
            'examples/customer_support_adk/agent.py:root_agent'.

    Returns:
        Any: The instantiated agent object or function loaded from the target module.

    Raises:
        ValueError: If `spec` does not follow the 'file_path.py:attr_name' format.
        FileNotFoundError: If the specified agent Python file does not exist on disk.
        ImportError: If the Python module cannot be dynamically imported.
        AttributeError: If the specified attribute variable is missing from the module.

    Example:
        >>> agent = load_adk_agent("examples/customer_support_adk/agent.py:root_agent")
        >>> hasattr(agent, "run")
        True
    """
    if ":" not in spec:
        raise ValueError(
            f"Invalid agent spec '{spec}'. Expected format 'path/to/file.py:agent_var' "
            "(e.g. 'examples/customer_support_adk/agent.py:root_agent')."
        )

    file_path_str, attr_name = spec.split(":", 1)
    file_path = Path(file_path_str)
    repo_root = Path(__file__).resolve().parent.parent.parent.parent

    # Resolve relative to repo root if not absolute
    if not file_path.is_absolute():
        file_path = (repo_root / file_path_str).resolve()
    else:
        file_path = file_path.resolve()

    # Security: Ensure agent module resides strictly within the repo root workspace
    if not file_path.is_relative_to(repo_root):
        raise PermissionError(
            f"Access denied: Target agent '{spec}' must reside within the workspace directory ({repo_root})."
        )

    # Security: Disallow loading from system, environment, or hidden runtime directories
    disallowed_dirs = {".venv", "venv", ".git", "__pycache__", ".gemini"}
    if any(part in disallowed_dirs for part in file_path.parts):
        raise PermissionError(
            f"Access denied: Cannot load agent modules from protected directory ({file_path})."
        )

    if not file_path.exists():
        raise FileNotFoundError(
            f"Agent source file not found at: {file_path}. "
            "Please check the relative file path and ensure the agent file exists."
        )

    # Add directory to sys.path to allow imports within the agent package and repo root
    for p in [file_path.parent, file_path.parent.parent, repo_root]:
        resolved_p = p.resolve()
        if resolved_p.is_relative_to(repo_root):
            p_str = str(resolved_p)
            if p_str not in sys.path:
                sys.path.insert(0, p_str)

    # Prevent sys.modules collision for agents sharing the same filename (e.g. agent.py)
    path_hash = hashlib.sha256(str(file_path).encode("utf-8")).hexdigest()[:8]
    module_name = f"adk_target_{file_path.stem}_{path_hash}"
    spec_obj = importlib.util.spec_from_file_location(module_name, str(file_path))
    if not spec_obj or not spec_obj.loader:
        raise ImportError(f"Could not create module spec for {file_path}")

    module = importlib.util.module_from_spec(spec_obj)
    sys.modules[module_name] = module
    spec_obj.loader.exec_module(module)

    if not hasattr(module, attr_name):
        raise AttributeError(
            f"Module '{module_name}' at {file_path} does not define attribute '{attr_name}'. "
            "Ensure the agent instance is defined and exported at module level."
        )

    agent = getattr(module, attr_name)
    return agent


def extract_agent_tools(agent: Any) -> List[str]:
    """
    Extracts tool names from an already loaded ADK agent instance.
    """
    if hasattr(agent, "tools"):
        if isinstance(agent.tools, dict):
            return list(agent.tools.keys())
        elif isinstance(agent.tools, list):
            return [getattr(t, "name", str(t)) for t in agent.tools]
    return []


def inspect_agent_tools(spec: str) -> List[str]:
    """
    Inspects and extracts available tool names from a target ADK agent spec.
    """
    try:
        agent = load_adk_agent(spec)
        return extract_agent_tools(agent)
    except Exception as e:
        logger.warning(f"Could not inspect tools for spec '{spec}': {e}")
        return []


from app.core.tracing import get_tracer

tracer = get_tracer("app.core.bridge")


@solver
def adk_agent_solver(target_spec: str) -> Callable:
    """
    Inspect AI solver wrapping an ADK agent for multi-scorer evaluation.

    Dynamically loads the target agent, intercepts its execution per sample,
    and captures tool call traces and response outputs into the TaskState.

    Args:
        target_spec (str): File path and attribute for the agent under evaluation
            (e.g., 'examples/customer_support_adk/agent.py:root_agent').

    Returns:
        Callable: An asynchronous solver function compatible with inspect_ai.Task.

    Errors and Recovery:
        If target agent loading or execution raises an exception:
        - The solver records a non-crashing ModelOutput containing explicit error details
          and actionable recovery instructions.
        - Structured metadata is attached to `state.metadata` under 'error' and 'recovery_instruction'.
    """
    try:
        agent = load_adk_agent(target_spec)
    except Exception as load_err:
        logger.error(
            f"Failed to pre-load agent for spec '{target_spec}': {load_err}",
            extra={"target_spec": target_spec, "error_code": "AGENT_LOAD_FAILED"},
        )
        agent = None
        load_error_str = str(load_err)

    async def solve(state: TaskState, generate: Generate) -> TaskState:
        sample_id = getattr(state, "sample_id", None) or (state.metadata or {}).get("sample_id", "sample-unknown")
        category = (state.metadata or {}).get("category", "unknown")
        expected_tools = (state.metadata or {}).get("expected_tools", [])

        # Extract user input prompt from state.input
        user_input = ""
        if isinstance(state.input, str):
            user_input = state.input
        elif isinstance(state.input, list):
            for m in state.input:
                if isinstance(m, dict):
                    user_input += f"\n{m.get('content', '')}"
                elif hasattr(m, "text"):
                    user_input += f"\n{m.text}"
                else:
                    user_input += f"\n{str(m)}"
        else:
            user_input = str(state.input)

        user_input = user_input.strip()

        # 1. EXPLICIT INTENT LOGGING
        logger.info(
            "Executing target ADK agent turn",
            extra={
                "phase": "intent",
                "sample_id": sample_id,
                "category": category,
                "target_spec": target_spec,
                "expected_tools": expected_tools,
                "input_length": len(user_input),
            },
        )

        start_time = time.perf_counter()

        with tracer.start_as_current_span("adk_agent_solver") as span:
            span.set_attribute("target_spec", target_spec)
            span.set_attribute("sample_id", str(sample_id))
            span.set_attribute("category", category)

            if agent is None:
                err_payload = AgentExecutionError(
                    error_code="AGENT_LOAD_FAILED",
                    error_message=f"Target agent could not be loaded: {load_error_str}",
                    recovery_instruction=(
                        f"Check that '{target_spec}' points to a valid Python file with the exported symbol. "
                        "Verify all dependencies are installed."
                    ),
                    target_spec=target_spec,
                )
                state.output = ModelOutput.from_content(
                    model="adk_agent",
                    content=(
                        f"Agent Execution Error: {err_payload.error_message}\n"
                        f"Recovery Instruction: {err_payload.recovery_instruction}"
                    ),
                )
                if not state.metadata:
                    state.metadata = {}
                state.metadata["error"] = err_payload.error_message
                state.metadata["error_code"] = err_payload.error_code
                state.metadata["recovery_instruction"] = err_payload.recovery_instruction

                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                span.set_attribute("status", "error")
                span.set_attribute("error_code", "AGENT_LOAD_FAILED")

                # 2. EXPLICIT OUTCOME LOGGING (AGENT LOAD ERROR)
                logger.error(
                    "Target ADK agent load failed",
                    extra={
                        "phase": "outcome",
                        "status": "error",
                        "error_code": "AGENT_LOAD_FAILED",
                        "sample_id": sample_id,
                        "duration_ms": duration_ms,
                    },
                )
                return state

            try:
                # Execute target agent
                if hasattr(agent, "run"):
                    if callable(getattr(agent, "run")):
                        import inspect
                        if inspect.iscoroutinefunction(agent.run):
                            result = await agent.run(user_input)
                        else:
                            result = agent.run(user_input)
                    else:
                        result = {"output": str(agent), "tool_calls": []}
                elif callable(agent):
                    import inspect
                    if inspect.iscoroutinefunction(agent):
                        result = await agent(user_input)
                    else:
                        result = agent(user_input)
                else:
                    result = {"output": str(agent), "tool_calls": []}

                output_text = result.get("output", "") if isinstance(result, dict) else str(result)
                tool_calls = result.get("tool_calls", []) if isinstance(result, dict) else []

                # Store in state
                state.output = ModelOutput.from_content(model="adk_agent", content=output_text)
                if not state.metadata:
                    state.metadata = {}
                state.metadata["tool_calls"] = tool_calls

                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                tools_called_names = [tc.get("tool", "") if isinstance(tc, dict) else str(tc) for tc in tool_calls]

                span.set_attribute("status", "success")
                span.set_attribute("duration_ms", duration_ms)
                span.set_attribute("tools_called_count", len(tool_calls))

                # 2. EXPLICIT OUTCOME LOGGING (SUCCESS)
                logger.info(
                    "Target ADK agent turn completed successfully",
                    extra={
                        "phase": "outcome",
                        "status": "success",
                        "sample_id": sample_id,
                        "category": category,
                        "tools_called": tools_called_names,
                        "output_length": len(output_text),
                        "duration_ms": duration_ms,
                    },
                )

            except Exception as e:
                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                span.set_attribute("status", "error")
                span.set_attribute("error_code", "AGENT_RUNTIME_EXCEPTION")

                logger.error(
                    f"Error executing target ADK agent: {e}",
                    exc_info=True,
                    extra={
                        "phase": "outcome",
                        "status": "error",
                        "error_code": "AGENT_RUNTIME_EXCEPTION",
                        "sample_id": sample_id,
                        "duration_ms": duration_ms,
                    },
                )
                recovery_msg = (
                    "Ensure the agent's run() method accepts user string input without unhandled exceptions. "
                    "Check tool invocations and exception handling inside the agent implementation."
                )
                state.output = ModelOutput.from_content(
                    model="adk_agent",
                    content=(
                        f"Agent Execution Error: {str(e)}\n"
                        f"Recovery Instruction: {recovery_msg}"
                    ),
                )
                if not state.metadata:
                    state.metadata = {}
                state.metadata["error"] = str(e)
                state.metadata["error_code"] = "AGENT_RUNTIME_EXCEPTION"
                state.metadata["recovery_instruction"] = recovery_msg

            return state

    return solve

