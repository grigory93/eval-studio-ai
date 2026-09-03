# EvalStudio AI — High-Level Architecture

## 1. Overview

**EvalStudio AI** is an interactive, visual IDE and continuous evaluation workbench for GenAI agents and LLM applications. Its goal is to empower business users, product managers, and AI practitioners to:
1. autonomously construct, execute, and analyze business-driven evaluation workflows—**with zero code required**.
2. continuously evaluate AI agents and applications for quality, safety, and policy compliance.

EvalStudio AI bridges the gap between high-level business specifications and empirical evaluation by translating plain-English requirements and policy documents into comprehensive, multi-category evaluation suites with actionable diagnostics.

---

## 2. High-Level Business Architecture

The following diagram illustrates the functional and business architecture of EvalStudio AI, focusing strictly on business capabilities, user journeys, and value delivery without technical or implementation details.

```mermaid
flowchart LR
    Feedback["Actionable Guidance & Fixes"]
    
    subgraph Users ["Users"]
        direction TB
        U1["Business Analysts<br>Product Managers<br>Product Stakeholders<br>Domain Experts<br>Compliance Officers"]
    end

    subgraph Phase1 ["1. Specification & Gap Discovery"]
        direction TB
        F1["Policy & Requirements Ingestion"]
        F2["Socratic Ambiguity & Gap Detection"]
        F3["Evaluation Criteria & Rubric Alignment"]
        F1 --> F2 --> F3
    end

    subgraph Phase2 ["2. Automated Test Synthesis & Curation"]
        direction TB
        F4["Multi-Category Test Synthesis"]
        F5["Interactive Test Data Grid & Editing"]
        F6["Visual Workflow Inspection"]
        F4 --> F5 --> F6
    end

    subgraph Phase3 ["3. Evaluation & Multi-Criteria Assessment"]
        direction TB
        F7["AI Agent Assessment & Tool Inspection"]
        F8["Policy Adherence & Safety Scoring"]
        F9["Domain Quality & Goal Completion Grading"]
        F7 --> F8 --> F9
    end

    subgraph Phase4 ["4. Executive Intelligence & Diagnostics"]
        direction TB
        F10["Executive Scorecard & KPI Reporting"]
        F11["Semantic Failure Mode Clustering"]
        F12["Actionable Guidance & Quality Gates"]
        F10 --> F11 --> F12
    end

    Users -->|Uploads Policies & Clarifies Rules| Phase1
    Phase1 -->|Confirmed Rubrics| Phase2
    Phase2 -->|Curated Test Scenarios| Phase3
    Phase3 -->|Execution Transcripts & Scores| Phase4
    Phase4 --> Feedback
```

### Core Business Capabilities

1. **Specification & Gap Discovery**:
   - **Policy Ingestion**: Directly consumes business requirements, policy handbooks, user stories, and compliance guidelines in standard business document formats (PDF, Markdown, Text).
   - **Socratic Gap Detection**: Proactively identifies ambiguities, unaddressed edge cases, conflicting business rules, and missing escalation thresholds before testing begins.
   - **Rubric Alignment**: Formulates explicit domain scoring criteria agreed upon by business stakeholders.

2. **Automated Test Synthesis & Curation**:
   - **Taxonomy Synthesis**: Automatically generates balanced benchmark suites covering standard interactions (`happy_path`), complex edge cases, adversarial safety/jailbreak attempts, strict policy boundaries, tool operations, and multi-turn dialogue.
   - **Interactive Data Grid**: Empowers non-technical domain experts to inspect, edit, filter, and augment test cases in an intuitive spreadsheet-style view.
   - **Visual Workflow Transparency**: Presents the evaluation plan as an intuitive flow diagram so non-technical users can verify the evaluation topology before execution.

3. **Evaluation & Multi-Criteria Assessment**:
   - **Empirical Agent Testing**: Executes tests safely against the target agent under test with real-time progress visibility.
   - **Multi-Criteria Scoring**: Simulates human evaluator judgment across multiple dimensions: overall answer quality, strict negative policy adherence (refusal accuracy), and correct business tool usage.

4. **Executive Intelligence & Diagnostics (Closed-Loop Flywheel)**:
   - **Executive Scorecard**: Delivers high-level KPI cards (Pass Rates, Compliance %, Tool Accuracy, Latency) designed for business leadership.
   - **Semantic Failure Clustering**: Groups failed scenarios into meaningful problem themes (e.g., *"Refund Policy Misinterpretation"*, *"Missing Escalation Threshold"*) rather than raw error dumps.
   - **Actionable Guidance**: Provides copy-pasteable prompt improvements and policy updates, enabling rapid iterative refinement.
   - **Continuous Quality Gates**: Compares current runs against historical baselines to verify fixes and prevent regressions.

---

## 3. High-Level Agentic Architecture

The following diagram illustrates the agentic design of EvalStudio AI, focusing strictly on the specialized agents that participate in the evaluation lifecycle, their interactions, data contracts, and feedback loops.

```mermaid
flowchart TD
    Elicitation["Elicitation & Gap-Detection Agent"]
    Synthesizer["Dataset Synthesizer Agent"]
    Compiler["Inspect Task Compiler Agent"]
    TargetAgent["Target Agent under Evaluation"]
    Judges["Evaluator Judge Agents<br/>(Quality, Safety & Policy Compliance)"]
    Diagnostics["Diagnostic Analysis Agent"]

    Elicitation -->|"Confirmed Criteria & Domain Policies"| Synthesizer
    Synthesizer -->|"50-200 Categorized Samples & Rubrics"| Compiler
    TargetAgent -.->|"Agent Spec & Tool Interfaces"| Compiler
    Compiler -->|"Orchestrates Evaluation Run"| TargetAgent
    TargetAgent -->|"Execution Traces & Tool Outputs"| Judges
    Synthesizer -.->|"Grading Rubrics & Expected Tools"| Judges
    Judges -->|"Scored Transcripts & Category Metrics"| Diagnostics
    Diagnostics -->|"Actionable Prompt & Tool Fixes"| TargetAgent
    Diagnostics -.->|"Refined Edge Cases & Clarifications"| Elicitation
```

### Agent Roles & Collaborative Workflows

1. **Elicitation & Gap-Detection Agent** (`agents/elicitation.py`):
   - **Role**: Socratic domain requirements interviewer powered by Gemini 2.5 on Vertex AI.
   - **Inputs**: Business policy documents, user stories, and interactive stakeholder dialogue.
   - **Outputs**: Structured domain rules, negative boundary constraints, and confirmed evaluation rubrics.
   - **Downstream Dependency**: Handoff to the *Dataset Synthesizer Agent*.

2. **Dataset Synthesizer Agent** (`agents/synthesizer.py`):
   - **Role**: Synthetic test data generator producing 50–200 multi-category scenarios.
   - **Inputs**: Confirmed evaluation criteria and extracted business rules from the Elicitation Agent.
   - **Outputs**: Balanced evaluation dataset across the 7-category taxonomy (`happy_path`, `edge_case`, `adversarial`, `tool_usage`, `exception`, `policy_compliance`, `multi_turn`) with ground truth and custom rubrics.
   - **Downstream Dependencies**: Feeds the *Task Compiler Agent* with samples, and supplies ground truth targets and rubrics to the *Evaluator Judge Agents*.

3. **Inspect Task Compiler Agent** (`agents/compiler.py`):
   - **Role**: Evaluation harness compiler and workflow orchestrator.
   - **Inputs**: Synthesized dataset from the Synthesizer Agent, target agent path, and tool specifications.
   - **Outputs**: Executable Inspect AI task configuration (`task.py`), multi-scorer registrations, and grouped metric aggregations.
   - **Downstream Dependency**: Binds and dispatches test scenarios to the *Target Agent under Evaluation*.

4. **Target Agent under Evaluation** (System Under Test):
   - **Role**: The Google ADK application being evaluated (e.g. `customer_support_adk`, `hr_benefits_adk`).
   - **Inputs**: User prompts and conversational turns dispatched during evaluation execution.
   - **Outputs**: Natural language responses, reasoning steps, and intercepted tool execution traces.
   - **Downstream Dependency**: Streams complete execution transcripts to the *Evaluator Judge Agents*.

5. **Evaluator Judge Agents** (`core/scorers.py`):
   - **Role**: Autonomous multi-scorer judges (Gemini 2.5 on Vertex AI ADC + deterministic verifiers).
   - **Inputs**: Target agent responses and tool traces paired with the Synthesizer Agent's ground truth rubrics.
   - **Outputs**: Granular evaluation grades across three dimensions:
     - *ModelGradedQA*: Relevance, correctness, and rubric adherence.
     - *PolicyAdherence*: Boundary constraint and safe refusal enforcement.
     - *ToolVerification*: Deterministic tool selection and argument validation.
   - **Downstream Dependency**: Delivers scored transcripts and grouped categorical metrics to the *Diagnostic Analysis Agent*.

6. **Diagnostic Analysis Agent** (`agents/diagnostics.py`):
   - **Role**: Root-cause diagnostic specialist and quality flywheel orchestrator.
   - **Inputs**: Scored `EvalLog` transcripts, grouped failure rates, and judge reasoning traces.
   - **Outputs**: Semantic failure clusters, root cause analyses, and copy-pasteable prompt and tool improvements.
   - **Closed-Loop Feedback**:
     - Sends actionable prompt and tool fixes directly to the *Target Agent under Evaluation*.
     - Feeds newly discovered edge cases and ambiguous policy clauses back to the *Elicitation & Gap-Detection Agent* for continuous improvement.

---

## 4. High-Level Technical Architecture

The following diagram illustrates the underlying technical tiers: the React/TypeScript Frontend, FastAPI Backend, Execution Isolation Barrier, and the Target Agent under test.

```mermaid
flowchart TD
    subgraph UI ["Frontend (React / TypeScript / Vite / Tailwind)"]
        A1["1. Document & Requirement Ingestion"]
        A2["2. Socratic Elicitation Chat"]
        A3["3. Editable Dataset Grid (50-200 samples)"]
        A4["4. Dual View (Mermaid Flow + Inspect Code)"]
        A5["5. Live Execution & SSE Progress"]
        A6["6. Executive Scorecard & Diagnostics UI"]
    end

    subgraph Backend ["Backend (FastAPI + Python 3.11 + uv)"]
        B1["API Endpoints & SSE Streamer"]
        B2["Document Parser (PDF, MD, CSV, JSON)"]
        B3["ADK Internal Sub-Agents (Gemini 2.5 via Vertex AI ADC)"]
        B4["Inspect AI Task Compiler & Orchestrator"]
    end

    subgraph Isolation ["Execution & Sandbox Isolation Barrier"]
        S1["Isolated Worker Subprocess Runner"]
        S2["Inspect AI Docker / Tool Sandbox"]
    end

    subgraph Target ["Target Agent under Evaluation"]
        T1["Local ADK Agent Project (path/to/agent.py:root_agent)"]
        T2["Agent Tools & MCP Connectors"]
    end

    A1 --> B2
    B2 --> B3
    A2 <--> B3
    B3 --> A3
    A3 --> B4
    B4 --> A4
    A5 <--> B1
    B4 -->|Spawns Isolated Run| S1
    S1 <-->|agent_bridge / async runner| T1
    T1 <--> S2
    S2 <--> T2
    S1 -->|Generates EvalLog with Grouped Metrics| B4
    B4 -->|Feeds EvalLog| B3
    B3 --> A6
```

### Architectural Tiers & Responsibilities

1. **Frontend (Presentation Tier)**:
   - Built with React 18, TypeScript, Vite, Tailwind CSS, Lucide React, and Radix UI.
   - Guides the user through an intuitive 6-step evaluation wizard.
   - Streams live execution progress over Server-Sent Events (SSE).
   - Renders dynamic Mermaid.js workflow diagrams and Recharts metric dashboards.

2. **Backend (Application Tier)**:
   - FastAPI service running under Python 3.11+ managed via `uv`.
   - Houses internal Google ADK reasoning agents:
     - **Elicitation & Gap-Detection Agent** (`agents/elicitation.py`): Performs Socratic probing to resolve ambiguities.
     - **Dataset Synthesizer Agent** (`agents/synthesizer.py`): Generates 50–200 balanced test samples across the 7-category taxonomy.
     - **Inspect Task Compiler** (`agents/compiler.py`): Compiles datasets, target agent bridges, multi-scorers, and grouped metrics into executable Inspect AI tasks.
     - **Diagnostic Analysis Agent** (`agents/diagnostics.py`): Parses `EvalLog` outputs, clusters failure modes, and generates actionable recommendations.

3. **Execution & Sandbox Isolation Barrier**:
   - Executes target agents inside dedicated worker subprocesses (`core/runner.py`, `core/sandbox.py`) with strict limits (`time_limit`, `message_limit`).
   - Ensures that target agent crashes, infinite loops, or exceptions never affect the primary FastAPI backend.
   - Configures Inspect tasks with `fail_on_error=False` so sample errors are captured gracefully for diagnostics.
   - Leverages Inspect AI container sandboxes (`sandbox="docker"`) for filesystem and bash tool isolation.

4. **Target Agent under Evaluation**:
   - In Phase 1, target agents are local Google ADK Python projects (e.g. `examples/customer_support_adk/agent.py:root_agent`).
   - Dynamically loaded in-process within the worker subprocess via `core/bridge.py:load_adk_agent`.
   - Intercepts and traces tool calls made by the target agent (including Python functions and Model Context Protocol / MCP servers).

---

## 5. Evaluation Execution & Multi-Scorer Lifecycle

The sequence diagram below details the runtime lifecycle of an individual evaluation run, from sample dispatch through multi-scorer judging and executive scorecard generation:

```mermaid
sequenceDiagram
    autonumber
    actor Persona as Test Persona (50-200 Categorized Samples)
    participant Bridge as Isolated Runner / Agent Bridge
    participant Agent as Local ADK Target Agent
    participant Tools as Agent Tools & MCP Connectors
    participant Judges as Multi-Scorer Judges (Gemini 2.5 via Vertex AI)
    participant Diagnostics as Diagnostic Analysis Agent
    participant UI as Executive Scorecard UI

    Note over Persona,Agent: 1. Input Submission (7 Taxonomy Categories)
    Persona->>Bridge: Sample Input (Prompt / ChatMessage Sequence)
    Bridge->>Agent: Invokes Agent run() in Subprocess

    opt Tool Invocations
        Agent->>Tools: Function Call with Parameters
        Tools-->>Agent: Tool Output / Status Result
    end

    Agent-->>Bridge: Returns Agent Response & Tool Traces
    Bridge->>Judges: Generates EvalLog (Transcripts, Outputs, Traces)

    Note over Judges: 2. Multi-Scorer Evaluation & Grouped Metrics
    Judges->>Judges: 1. ModelGradedQA (Domain Rubric Fit)
    Judges->>Judges: 2. PolicyAdherence (Boundary & Refusal Checks)
    Judges->>Judges: 3. ToolVerification (Deterministic Tool Matching)

    Note over Judges,Diagnostics: 3. Diagnostic Analysis & Root-Cause Clustering
    Judges->>Diagnostics: Raw EvalLog with grouped() category metrics
    Diagnostics->>Diagnostics: Failure Mode Clustering & Prompt/Tool Recommendations
    Diagnostics->>UI: Executive Scorecard Report & Comparative Delta
```

### Multi-Scorer Diagnostic Pipeline

EvalStudio AI compiles a multi-layered scorer suite for each evaluation:
1. **Primary Quality Scorer (`model_graded_qa`)**: An LLM judge evaluates output relevance, correctness, tone, and rubric fulfillment.
2. **Policy Adherence Scorer (`policy_adherence`)**: A specialized compliance judge verifies adherence to hard business constraints, negative policies, and boundary refusals.
3. **Tool Verification Scorer (`tool_verification`)**: A deterministic scorer verifying that the target agent invoked the expected tools with valid arguments based on sample metadata.
4. **Grouped Diagnostic Metrics**: Inspect AI's `grouped(accuracy(), "category")` and `grouped(mean(), "category")` automatically compute categorical pass rates across all 7 taxonomy categories for failure clustering.

---

## 6. Key Architectural Decisions

| Decision | Implementation | Rationale |
|---|---|---|
| **Zero API Keys** | Vertex AI ADC (`GOOGLE_GENAI_USE_VERTEXAI=true`) | Enterprise security standard; leverages Google Cloud IAM service accounts with zero credential leaks. |
| **Local Target Scope (Phase 1)** | Subprocess worker + `core/bridge.py` | Eliminates remote network flakiness; protects backend from agent crashes without requiring live cloud deployment. |
| **Inspect AI as Engine** | Native `Sample`, `Task`, and `EvalLog` contracts | Standards-compliant, extensible evaluation foundation that allows users to export standalone runnable Python scripts. |
| **Human-in-the-Loop Workflow** | Socratic chat + editable data grid + dual view | Gives domain experts full transparency and editorial control over evaluation criteria before execution. |
| **Repeatable Regression Gates** | Historical suite store (`storage/suite_store.py`) | Enables side-by-side comparative analysis (`ComparativeRunDelta`) to track regressions when agent prompts or code change. |