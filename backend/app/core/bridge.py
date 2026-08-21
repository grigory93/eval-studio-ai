"""
Target ADK Agent Dynamic Loader and Inspect AI Bridge.
Wraps local Google ADK agents into Inspect AI Solvers and intercepts tool calls.
"""

import importlib.util
import logging
import os
import sys
from pathlib import Path
from typing import Any, Callable, Dict

from inspect_ai.model import ChatMessageUser, ModelOutput
from inspect_ai.solver import Generate, TaskState, solver

logger = logging.getLogger(__name__)


def load_adk_agent(spec: str) -> Any:
    """
    Dynamically loads an agent instance from a filesystem path and attribute name.
    Example spec: 'examples/customer_support_adk/agent.py:root_agent'
    """
    if ":" not in spec:
        raise ValueError(f"Invalid agent spec '{spec}'. Must be in format 'path/to/file.py:agent_var'")

    file_path_str, attr_name = spec.split(":", 1)
    file_path = Path(file_path_str).resolve()

    if not file_path.exists():
        raise FileNotFoundError(f"Agent file not found at: {file_path}")

    # Add directory to sys.path to allow relative imports within the agent package
    agent_dir = str(file_path.parent.parent)
    if agent_dir not in sys.path:
        sys.path.insert(0, agent_dir)

    module_name = f"adk_target_{file_path.stem}"
    spec_obj = importlib.util.spec_from_file_location(module_name, str(file_path))
    if not spec_obj or not spec_obj.loader:
        raise ImportError(f"Could not create module spec for {file_path}")

    module = importlib.util.module_from_spec(spec_obj)
    sys.modules[module_name] = module
    spec_obj.loader.exec_module(module)

    if not hasattr(module, attr_name):
        raise AttributeError(f"Module {module_name} does not contain '{attr_name}'")

    agent = getattr(module, attr_name)
    return agent


@solver
def adk_agent_solver(target_spec: str) -> Callable:
    """
    Inspect AI solver wrapping an ADK agent.
    Runs the agent and attaches tool calls to task state.
    """
    agent = load_adk_agent(target_spec)

    async def solve(state: TaskState, generate: Generate) -> TaskState:
        # Extract user input prompt
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

        except Exception as e:
            logger.error(f"Error executing target ADK agent: {e}", exc_info=True)
            state.output = ModelOutput.from_content(
                model="adk_agent", content=f"Agent Execution Error: {str(e)}"
            )
            if not state.metadata:
                state.metadata = {}
            state.metadata["error"] = str(e)

        return state

    return solve
