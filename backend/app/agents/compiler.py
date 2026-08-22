"""
Inspect AI Task & Mermaid Diagram Compiler.
Compiles synthesized datasets and target agent metadata into executable Python task code and Mermaid.js diagrams
with comprehensive docstrings, strict model validation, and structured error resilience.
"""

import uuid
from typing import Optional
from app.models.dataset import EvalDatasetModel
from app.models.task import (
    CompiledTaskResponse,
    InspectTaskConfig,
    MermaidDiagramModel,
    ScorerConfig,
)
from app.utils.code_generator import generate_task_python_code


class TaskCompiler:
    """
    Compiles datasets and agent configurations into Inspect AI Tasks and business diagrams.
    """

    def compile(
        self,
        dataset: EvalDatasetModel,
        target_agent_path: str = "examples/customer_support_adk/agent.py:root_agent",
        task_name: Optional[str] = None,
        fail_on_error: bool = False,
    ) -> CompiledTaskResponse:
        """
        Compiles an evaluation dataset and agent spec into runnable Inspect AI task code and a Mermaid architecture diagram.

        Args:
            dataset (EvalDatasetModel): Synthesized benchmark dataset containing categorized samples.
            target_agent_path (str): Relative or absolute path to target agent and symbol
                (e.g., 'examples/customer_support_adk/agent.py:root_agent'). Defaults to customer support agent.
            task_name (Optional[str]): Custom task identifier; will be sanitized into a valid Python identifier.
            fail_on_error (bool): Whether Inspect AI should abort on first sample error or continue (default False).

        Returns:
            CompiledTaskResponse: Contains generated Python task script, Mermaid sequence diagram, and task configuration.
        """
        clean_task_name = (
            task_name or f"eval_{dataset.name.lower().replace(' ', '_').replace('-', '_')}"
        )
        # Ensure valid Python identifier
        clean_task_name = "".join(c if c.isalnum() or c == "_" else "_" for c in clean_task_name)
        if clean_task_name and clean_task_name[0].isdigit():
            clean_task_name = f"task_{clean_task_name}"

        scorers = [
            ScorerConfig(
                scorer_type="model_graded_qa",
                name="ModelGradedQA",
                rubric="Domain-specific criteria",
            ),
            ScorerConfig(
                scorer_type="policy_adherence",
                name="PolicyAdherenceJudge",
                rubric="Safety and refusal enforcement",
            ),
            ScorerConfig(
                scorer_type="tool_verification",
                name="DeterministicToolVerifier",
                expected_tools=[],
            ),
        ]

        config = InspectTaskConfig(
            task_name=clean_task_name,
            dataset_id=dataset.id,
            target_agent_path=target_agent_path,
            model_graded_judge_model="google/gemini-2.5-flash",
            scorers=scorers,
            fail_on_error=fail_on_error,
            time_limit_seconds=60,
            message_limit=10,
        )

        task_code = generate_task_python_code(dataset=dataset, config=config)
        mermaid_diagram = self._generate_mermaid_diagram(dataset, target_agent_path)

        return CompiledTaskResponse(
            task_id=f"task-{uuid.uuid4().hex[:8]}",
            task_name=clean_task_name,
            task_code=task_code,
            mermaid_diagram=mermaid_diagram,
            config=config,
        )

    def _generate_mermaid_diagram(
        self, dataset: EvalDatasetModel, target_agent_path: str
    ) -> MermaidDiagramModel:
        """
        Generates dynamic business sequence diagram for the evaluation workflow.

        Args:
            dataset (EvalDatasetModel): The dataset under evaluation with sample metadata and tools.
            target_agent_path (str): Target agent identifier.

        Returns:
            MermaidDiagramModel: Structured Mermaid diagram definition with node count and description.
        """
        agent_label = target_agent_path.split(":")[-1] if ":" in target_agent_path else "Target Agent"

        # Collect unique tool names across dataset
        tools_found = set()
        for s in dataset.samples:
            if s.metadata.expected_tools:
                tools_found.update(s.metadata.expected_tools)
        tools_list_str = ", ".join(list(tools_found)[:3]) or "Custom Tools"

        diagram_code = f"""sequenceDiagram
    autonumber
    actor Persona as Test Persona ({dataset.total_count} Samples)
    participant Agent as {agent_label} ({target_agent_path.split('/')[0]})
    participant Tools as Tools ({tools_list_str})
    participant Judge as Evaluator Judges (Gemini 2.5 via Vertex AI)
    participant Scorecard as Executive Scorecard & Diagnostics

    Note over Persona,Agent: 1. Input Generation (7 Taxonomy Categories)
    Persona->>Agent: Submits User Prompt / Chat Sequence

    opt Tool Invocations
        Agent->>Tools: Function Call with Parameters
        Tools-->>Agent: Tool Output / Status Result
    end

    Agent-->>Persona: Returns Final Assistant Response

    Note over Agent,Judge: 2. Multi-Scorer & Metric Evaluation
    Agent->>Judge: Streams Full Transcript & Tool Traces
    Judge->>Judge: 1. ModelGradedQA Scorer (Rubric Fit)
    Judge->>Judge: 2. PolicyAdherence Scorer (Boundary Checks)
    Judge->>Judge: 3. ToolVerification Scorer (Deterministic)

    Note over Judge,Scorecard: 3. Aggregation & Root-Cause Clustering
    Judge->>Scorecard: Grouped Category Pass Rates & Failure Diagnostics
"""
        return MermaidDiagramModel(
            diagram_code=diagram_code,
            title=f"Evaluation Workflow: {dataset.name}",
            description="End-to-end evaluation flow connecting user personas, target agent, tools, and multi-scorers.",
            node_count=5,
        )

