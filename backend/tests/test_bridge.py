"""
Unit tests for ADK Agent Loader and Inspect Solver Bridge.
"""

import pytest
from unittest.mock import MagicMock
from app.core.bridge import load_adk_agent, adk_agent_solver
from inspect_ai.solver import TaskState


def test_load_adk_agent_valid_and_invalid():
    # Valid spec
    agent = load_adk_agent("examples/customer_support_adk/agent.py:root_agent")
    assert agent is not None
    assert hasattr(agent, "run")

    # Invalid specs
    with pytest.raises(ValueError):
        load_adk_agent("invalid_spec_without_colon")

    with pytest.raises(FileNotFoundError):
        load_adk_agent("non_existent_dir/agent.py:root_agent")


@pytest.mark.asyncio
async def test_adk_agent_solver_execution():
    solver_fn = adk_agent_solver("examples/customer_support_adk/agent.py:root_agent")

    state = MagicMock()
    state.input = "Check status of order ORD-101"
    state.metadata = {}

    res_state = await solver_fn(state, MagicMock())
    assert "delivered" in res_state.output.completion.lower()
    assert len(res_state.metadata["tool_calls"]) == 1
    assert res_state.metadata["tool_calls"][0]["tool"] == "lookup_order"
