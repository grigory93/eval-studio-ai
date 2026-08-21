"""
Unit tests for Inspect AI Task & Mermaid Diagram Compiler.
"""

import ast
from app.agents.compiler import TaskCompiler
from app.models.dataset import EvalDatasetModel, EvalSampleModel, EvalSampleMetadata


def test_task_compiler_output_syntax():
    compiler = TaskCompiler()
    sample = EvalSampleModel(
        id="sample-001",
        input="Hello, can I get a refund?",
        target="Please provide your order ID.",
        metadata=EvalSampleMetadata(
            category="happy_path",
            grading_rubric="Verify prompt asks for order ID.",
            expected_tools=["lookup_order"],
        ),
    )
    dataset = EvalDatasetModel(
        name="Customer Support Eval Suite",
        description="Eval suite for customer refund agent",
        samples=[sample],
    )
    dataset.calculate_distribution()

    response = compiler.compile(
        dataset=dataset,
        target_agent_path="examples/customer_support_adk/agent.py:root_agent",
        task_name="customer_refund_task",
    )

    assert response.task_name == "customer_refund_task"
    assert response.task_code != ""
    assert "sequenceDiagram" in response.mermaid_diagram.diagram_code

    # Verify python syntax
    parsed_ast = ast.parse(response.task_code)
    assert parsed_ast is not None
