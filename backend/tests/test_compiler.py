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

    # Verify task code structure: @task must appear before RAW_SAMPLES
    task_idx = response.task_code.index("@task")
    raw_samples_idx = response.task_code.index("RAW_SAMPLES =")
    get_dataset_idx = response.task_code.index("def get_dataset()")
    assert task_idx < get_dataset_idx < raw_samples_idx, "@task must be at top, followed by get_dataset(), followed by RAW_SAMPLES"

    # Verify samples_json and sample_count in response
    assert response.samples_json is not None
    assert "sample-001" in response.samples_json
    assert response.sample_count == 1

    # Verify python syntax and compilation
    parsed_ast = ast.parse(response.task_code)
    assert parsed_ast is not None
    compiled_py = compile(response.task_code, "task.py", "exec")
    assert compiled_py is not None
