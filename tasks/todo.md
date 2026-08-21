# EvalStudio AI — Implementation Progress & Task Tracker

<!--
Consolidated tracking file for EvalStudio AI Phase 1 implementation.
Follows the planning-and-task-breakdown specification.
-->

## Status Overview
- **Phase 1: Foundation & Core Contracts** -> [x] **COMPLETED** (100% verified)
- **Phase 2: Socratic Elicitation & Multi-Category Dataset Synthesis** -> [x] **COMPLETED** (100% verified)
- **Phase 3: Inspect AI Task Compilation & Dual-View Presentation** -> [x] **COMPLETED** (100% verified)
- **Phase 4: Isolated Execution Engine & Live Streaming** -> [x] **COMPLETED** (100% verified)
- **Phase 5: Diagnostic Analysis, Historical Regression & Executive Scorecard** -> [x] **COMPLETED** (100% verified)
- **Phase 6: Wizard Integration, E2E Verification & Cloud Deployment** -> [x] **COMPLETED** (100% verified)

### Test & Build Verification
- **Backend Test Suite**: 24/24 passed (`uv run pytest backend/tests/ -v`)
- **Frontend Typecheck & Production Build**: 0 errors (`cd frontend && npx tsc --noEmit && npm run build`)
- **Fault Tolerance & Sandbox Isolation**: Verified against sample target agent crashes & timeouts

---

## Detailed Task Breakdown

### Phase 1: Foundation & Core Contracts

---

### Task 1: Environment & Project Scaffolding

**Description:** Initialize the backend Python project with `uv` (`pyproject.toml`, FastAPI, Uvicorn, Inspect AI, Google ADK, Pydantic) and the frontend with Vite, React 18, TypeScript, and Tailwind CSS.

**Acceptance criteria:**
- [x] `pyproject.toml` defines all required backend dependencies (`fastapi`, `uvicorn`, `inspect-ai>=0.3.50`, `google-genai>=1.0.0`, `google-cloud-aiplatform`, `pydantic>=2.8`, `pypdf`, `python-multipart`, `sse-starlette`, `pytest`, `pytest-asyncio`, `pytest-cov`) and resolves with `uv lock`.
- [x] `backend/app/main.py` starts a FastAPI app with CORS middleware and health check endpoint `/api/health`.
- [x] `frontend/` is initialized with React 18, TypeScript, Vite, Tailwind CSS, Lucide React, and Radix UI primitives.

**Verification:**
- [x] Tests pass: `cd backend && uv run pytest`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: `curl http://localhost:8000/api/health` returns `{"status": "ok"}`.

**Dependencies:** None

**Files touched:**
- `pyproject.toml`
- `backend/app/main.py`
- `backend/app/__init__.py`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tailwind.config.js`

**Estimated scope:** Medium (4-5 files)

---

### Task 2: Core Data Contracts & Schemas

**Description:** Implement the complete set of Pydantic v2 data models in the backend and matching TypeScript interfaces in the frontend for datasets, samples, elicitation, tasks, scorecard reports, and regression deltas.

**Acceptance criteria:**
- [x] `backend/app/models/dataset.py` implements `EvalCategory` (7 categories), `EvalSampleMetadata`, `EvalSampleModel`, and `EvalDatasetModel` directly compatible with Inspect AI `Sample`.
- [x] `backend/app/models/elicitation.py` implements `RequirementDocModel`, `ElicitationMessage`, `AmbiguityFinding`, and `ConfirmedCriteriaModel`.
- [x] `backend/app/models/task.py` implements `InspectTaskConfig`, `ScorerConfig`, and `MermaidDiagramModel`.
- [x] `backend/app/models/scorecard.py` implements `MetricSummary`, `FailureCluster`, `SampleInspectionResult`, `ComparativeRunDelta`, and `ExecutiveScorecardReport`.
- [x] TypeScript definitions in `frontend/src/types/` mirror all backend schemas exactly.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_models.py`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Serialization and deserialization of a 7-category sample dataset succeeds with roundtrip equality.

**Dependencies:** Task 1

**Files touched:**
- `backend/app/models/dataset.py`
- `backend/app/models/elicitation.py`
- `backend/app/models/task.py`
- `backend/app/models/scorecard.py`
- `frontend/src/types/index.ts`

**Estimated scope:** Medium (5 files)

---

### Task 3: Config, Document Parsers & Ingestion API

**Description:** Build runtime configuration management (Vertex AI ADC validation), document parsers for PDF/Markdown/Text files, and the file ingestion API router.

**Acceptance criteria:**
- [x] `backend/app/config.py` loads and validates Google Cloud Vertex AI settings (`GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`) and sandbox settings without hardcoded API keys.
- [x] `backend/app/utils/pdf_parser.py` extracts text and document sections from PDF, Markdown, and text uploads using `pypdf`.
- [x] `backend/app/routers/ingest.py` exposes `POST /api/ingest/upload` and `POST /api/ingest/text` returning parsed structured requirements.
- [x] Frontend document uploader component (`frontend/src/components/ingest/DocumentUploader.tsx`) handles drag-and-drop file upload with progress feedback.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_ingest.py`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Uploading a sample policy PDF returns extracted text sections in API response.

**Dependencies:** Task 2

**Files touched:**
- `backend/app/config.py`
- `backend/app/utils/pdf_parser.py`
- `backend/app/routers/ingest.py`
- `frontend/src/components/ingest/DocumentUploader.tsx`

**Estimated scope:** Medium (4 files)

---

### Checkpoint 1: Foundation, Data Contracts & Document Ingestion
- [x] All unit tests for models and document ingestion pass (`uv run pytest`)
- [x] FastAPI backend starts without error (`uv run uvicorn app.main:app`)
- [x] Frontend TypeScript builds clean without type errors (`npm run build`)
- [x] Policy upload and text extraction work end-to-end

---

### Phase 2: Socratic Elicitation & Multi-Category Dataset Synthesis

---

### Task 4: Socratic Elicitation & Gap-Detection Agent

**Description:** Implement the ADK sub-agent using Gemini 2.5 on Vertex AI (via ADC) that analyzes domain requirements, executes Socratic knowledge probing to detect unstated edge cases, conflicting policies, or missing ground truth, and outputs formal criteria and rubrics.

**Acceptance criteria:**
- [x] `backend/app/agents/elicitation.py` implements the ADK `ElicitationAgent` using Gemini 2.5 on Vertex AI.
- [x] Agent extracts domain rules, detects ambiguities, formulates targeted clarification questions, and converts answers into formal `ConfirmedCriteriaModel`.
- [x] Handles fallbacks and mock responses cleanly when running in test mode without Vertex AI credentials.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_elicitation.py`
- [x] Build succeeds: `uv run python -c "from app.agents.elicitation import ElicitationAgent"`
- [x] Manual check: Pass a vague customer refund policy text and verify the agent returns high-value probing questions.

**Dependencies:** Task 3

**Files touched:**
- `backend/app/agents/elicitation.py`
- `backend/tests/test_elicitation.py`

**Estimated scope:** Small (2 files)

---

### Task 5: Interactive Elicitation Chat API & UI Components

**Description:** Build the interactive elicitation chat API endpoint and UI interface where users can chat with the Socratic Elicitation Agent, answer probing questions, and confirm evaluation criteria.

**Acceptance criteria:**
- [x] `backend/app/routers/elicitation.py` provides `POST /api/elicitation/chat` for conversational Q&A and `POST /api/elicitation/confirm` to finalize criteria.
- [x] `frontend/src/components/chat/ChatInterface.tsx` displays conversational turns, suggested clarification responses, and a confirmation summary banner.
- [x] `frontend/src/services/api.ts` implements API calls with error handling and toast notifications.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_elicitation.py`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Multi-turn chat successfully refines vague requirements and produces a confirmed criteria summary in the UI.

**Dependencies:** Task 4

**Files touched:**
- `backend/app/routers/elicitation.py`
- `frontend/src/components/chat/ChatInterface.tsx`
- `frontend/src/services/api.ts`

**Estimated scope:** Medium (3 files)

---

### Task 6: Multi-Category Dataset Synthesizer Agent (50–200 Samples)

**Description:** Implement the ADK Dataset Synthesizer Agent that generates a balanced matrix of 50–200 test cases categorized across all 7 taxonomy categories (`happy_path`, `edge_case`, `adversarial`, `tool_usage`, `exception`, `policy_compliance`, `multi_turn`) in native Inspect AI `Sample` schema.

**Acceptance criteria:**
- [x] `backend/app/agents/synthesizer.py` generates datasets structured in `EvalDatasetModel` containing 50–200 `EvalSampleModel` records.
- [x] Every sample contains `id`, `input`, `target`, and `metadata` with `category`, `grading_rubric`, `expected_tools`, and `difficulty`.
- [x] Distribution is balanced across all 7 taxonomy categories.
- [x] Includes streaming/batch generation to handle high sample volume within timeout limits.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_synthesizer.py`
- [x] Build succeeds: `uv run python -c "from app.agents.synthesizer import DatasetSynthesizerAgent"`
- [x] Manual check: Synthesize a dataset and verify category distribution covers all 7 categories with non-empty rubrics.

**Dependencies:** Task 5

**Files touched:**
- `backend/app/agents/synthesizer.py`
- `backend/tests/test_synthesizer.py`

**Estimated scope:** Small (2 files)

---

### Task 7: Dataset Management API & Interactive Editable Data Grid UI

**Description:** Build dataset CRUD endpoints and the interactive editable data grid UI allowing users to inspect, filter by category, edit inputs/targets/rubrics, and add/delete test samples.

**Acceptance criteria:**
- [x] `backend/app/routers/dataset.py` provides `POST /api/dataset/synthesize`, `GET /api/dataset/{dataset_id}`, `PUT /api/dataset/{dataset_id}/samples/{sample_id}`, and `DELETE /api/dataset/{dataset_id}/samples/{sample_id}`.
- [x] `frontend/src/components/dataset/DatasetGrid.tsx` renders a paginated, searchable, category-filtered table with category badges, inline editing, and sample detail modal.
- [x] Users can add custom test samples or delete existing samples directly in the UI before execution.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_dataset_router.py`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Filtering by `adversarial` isolates attack samples; editing a target updates the sample state and persists to backend.

**Dependencies:** Task 6

**Files touched:**
- `backend/app/routers/dataset.py`
- `frontend/src/components/dataset/DatasetGrid.tsx`
- `frontend/src/components/dataset/SampleEditModal.tsx`

**Estimated scope:** Medium (3 files)

---

### Checkpoint 2: Elicitation & Dataset Synthesis Verified
- [x] Socratic elicitation chat functions cleanly with requirement refinement
- [x] 50–200 sample dataset synthesizes across all 7 categories with rubrics
- [x] Frontend dataset grid allows full inspection, category filtering, and inline editing
- [x] All tests pass: `uv run pytest` and `npm run build`

---

### Phase 3: Inspect AI Task Compilation & Dual-View Presentation

---

### Task 8: Sample ADK Target Agents for Evaluation & Testing

**Description:** Create reference local Google ADK target agent projects (`customer_support_adk` and `hr_benefits_adk`) with tools, policies, and deliberate known flaws to serve as realistic test targets.

**Acceptance criteria:**
- [x] `examples/customer_support_adk/` contains `agent.py` (ADK agent with Gemini 2.5), `tools.py` (`lookup_order`, `process_refund`, `escalate_to_human`), and `policy.md`. Contains deliberate flaw (violates policy by approving refunds on opened hygiene items).
- [x] `examples/hr_benefits_adk/` contains `agent.py`, `tools.py`, and `policy.md` (HR handbook QA agent).
- [x] Both agents can be loaded programmatically via entrypoint format `path/to/agent:root_agent`.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_example_agents.py`
- [x] Build succeeds: `uv run python -c "from examples.customer_support_adk.agent import root_agent"`
- [x] Manual check: Invocations of sample agents return appropriate message and tool call responses.

**Dependencies:** Task 2

**Files touched:**
- `examples/customer_support_adk/agent.py`
- `examples/customer_support_adk/tools.py`
- `examples/customer_support_adk/policy.md`
- `examples/hr_benefits_adk/agent.py`
- `examples/hr_benefits_adk/tools.py`

**Estimated scope:** Medium (5 files)

---

### Task 9: Custom Inspect AI Scorers & Grouped Metric Helpers

**Description:** Implement custom Inspect AI scorers and grouped diagnostic metric aggregators for model-graded QA, policy adherence, tool verification, and statistical confidence intervals.

**Acceptance criteria:**
- [x] `backend/app/core/scorers.py` implements:
  - `model_graded_qa_scorer`: Model-graded judge evaluating response quality against sample rubric.
  - `policy_adherence_scorer`: Evaluates adherence to negative constraints and boundary enforcement.
  - `tool_verification_scorer`: Deterministically verifies expected tool names and arguments against `expected_tools`.
- [x] Attaches grouped metrics: `accuracy()`, `mean()`, `stderr()`.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_scorers.py`
- [x] Build succeeds: `uv run python -c "from app.core.scorers import create_evaluation_scorers"`
- [x] Manual check: Unit test against mock transcript confirms tool scorer passes when expected tool is called and fails when wrong tool is called.

**Dependencies:** Task 8

**Files touched:**
- `backend/app/core/scorers.py`
- `backend/tests/test_scorers.py`

**Estimated scope:** Small (2 files)

---

### Task 10: Inspect Task & Mermaid Flow Compiler

**Description:** Implement the Inspect Task Compiler that transforms dataset samples and target agent configuration into runnable Python task code (`task.py`) and high-level Mermaid.js sequence/flow diagrams (`diagram.mmd`).

**Acceptance criteria:**
- [x] `backend/app/agents/compiler.py` generates executable Python task script using native Inspect AI `Task`, `MemoryDataset`, solvers, and multi-scorers with `fail_on_error=False`.
- [x] `backend/app/utils/code_generator.py` formats valid, PEP-8 compliant Python code runnable independently with `inspect eval task.py`.
- [x] Generates a high-level business Mermaid.js diagram illustrating user personas, target agent, tool interactions, and model-graded judges.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_compiler.py`
- [x] Build succeeds: `uv run python -c "from app.agents.compiler import TaskCompiler"`
- [x] Manual check: Generated `task.py` code string parses without syntax errors (`ast.parse(code)`).

**Dependencies:** Task 7, Task 9

**Files touched:**
- `backend/app/agents/compiler.py`
- `backend/app/utils/code_generator.py`
- `backend/tests/test_compiler.py`

**Estimated scope:** Small (3 files)

---

### Task 11: Dual-View Task Presentation UI

**Description:** Build the frontend Dual-View component displaying the visual Mermaid.js evaluation flow diagram as the primary view, with an expandable syntax-highlighted Inspect AI Python code viewer and copy/export options.

**Acceptance criteria:**
- [x] `frontend/src/components/visualization/DualView.tsx` provides tabbed/split view switching between Mermaid workflow diagram and Python task script.
- [x] `frontend/src/components/visualization/MermaidViewer.tsx` dynamically renders Mermaid diagrams with zoom, pan, and graceful error boundary fallback.
- [x] `frontend/src/components/visualization/CodeViewer.tsx` displays formatted Python code with one-click copy and file download (`task.py`).

**Verification:**
- [x] Tests pass: `cd frontend && npx tsc --noEmit`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Switching tabs smoothly transitions between interactive Mermaid flow diagram and formatted Python code.

**Dependencies:** Task 10

**Files touched:**
- `frontend/src/components/visualization/DualView.tsx`
- `frontend/src/components/visualization/MermaidViewer.tsx`
- `frontend/src/components/visualization/CodeViewer.tsx`

**Estimated scope:** Small (3 files)

---

### Checkpoint 3: Compiler, Scorers & Dual-View UI Verified
- [x] Inspect Task Compiler outputs 100% valid Python task scripts with multi-scorers and grouped metrics
- [x] Dual-view UI renders Mermaid.js sequence/flow diagram and Python code viewer
- [x] All compiler unit tests pass (`uv run pytest backend/tests/test_compiler.py`)

---

### Phase 4: Isolated Execution Engine & Live Streaming

---

### Task 12: Target ADK Agent Loader & Inspect Bridge

**Description:** Build the dynamic agent loader and bridge module that imports local Google ADK agents from filesystem paths and wraps them in Inspect AI solver interfaces while intercepting tool invocations and state.

**Acceptance criteria:**
- [x] `backend/app/core/bridge.py` dynamically imports ADK agents via string spec (e.g. `examples/customer_support_adk/agent.py:root_agent`).
- [x] Bridges ADK async execution with Inspect AI `Solver` protocol, preserving user input, model outputs, and detailed tool call arguments.
- [x] Captures tool errors, timeout exceptions, and invalid parameters into sample metadata.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_bridge.py`
- [x] Build succeeds: `uv run python -c "from app.core.bridge import load_adk_agent, adk_agent_solver"`
- [x] Manual check: Calling bridge with sample ADK agent returns valid Inspect solver response.

**Dependencies:** Task 8

**Files touched:**
- `backend/app/core/bridge.py`
- `backend/tests/test_bridge.py`

**Estimated scope:** Small (2 files)

---

### Task 13: Subprocess Worker Isolation & Sandbox Execution Runner

**Description:** Implement the isolated runner engine that executes `inspect_ai.eval()` in dedicated worker subprocesses with optional Docker container sandboxing, ensuring agent crashes or infinite loops never affect FastAPI.

**Acceptance criteria:**
- [x] `backend/app/core/sandbox.py` manages subprocess lifecycle, memory/time limits, and Inspect Docker sandbox configuration (`Sample.files`, `Sample.setup`).
- [x] `backend/app/core/runner.py` executes evaluations asynchronously in worker subprocesses, writing live logs and `EvalLog` files to disk.
- [x] Crashed worker subprocesses or unhandled agent exceptions are caught, logged, and surfaced as sample errors without crashing the main backend.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_sandbox_isolation.py`
- [x] Build succeeds: `uv run python -c "from app.core.runner import EvalRunner"`
- [x] Manual check: Inject a fatal crash into a mock target agent and verify the backend survives and records an error status.

**Dependencies:** Task 10, Task 12

**Files touched:**
- `backend/app/core/sandbox.py`
- `backend/app/core/runner.py`
- `backend/tests/test_sandbox_isolation.py`

**Estimated scope:** Medium (3 files)

---

### Task 14: Execution SSE Streaming API & Real-Time Progress UI

**Description:** Implement the Server-Sent Events (SSE) streaming API and the real-time execution progress UI displaying live sample execution progress, status badges, and terminal logs.

**Acceptance criteria:**
- [x] `backend/app/routers/evaluate.py` exposes `POST /api/eval/start`, `POST /api/eval/{eval_id}/cancel`, and `GET /api/eval/{eval_id}/stream` (SSE).
- [x] SSE emits typed events (`eval_started`, `sample_progress`, `sample_complete`, `log_chunk`, `eval_complete`, `eval_error`).
- [x] `frontend/src/hooks/useEvalStream.ts` manages EventSource lifecycle and reconnection.
- [x] `frontend/src/components/execution/LiveProgress.tsx` displays an animated progress bar, category counters, running sample cards, and live log terminal.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_sandbox_isolation.py`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Triggering evaluation updates progress bar and streams log lines in real-time in the browser.

**Dependencies:** Task 13

**Files touched:**
- `backend/app/routers/evaluate.py`
- `frontend/src/hooks/useEvalStream.ts`
- `frontend/src/components/execution/LiveProgress.tsx`

**Estimated scope:** Medium (3 files)

---

### Checkpoint 4: Isolated Execution & Live Progress Verified
- [x] Target agent runs in isolated worker subprocess with zero backend crash risk
- [x] Real-time SSE streams execution progress, per-sample updates, and logs
- [x] UI displays live progress bar and terminal logs smoothly

---

### Phase 5: Diagnostic Analysis, Historical Regression & Executive Scorecard

---

### Task 15: Suite & Run Storage Store for Repeatable Evals

**Description:** Implement the local JSON storage layer that persists evaluation suites, dataset snapshots, task definitions, and historical `EvalLog` references for repeatable testing and regression analysis.

**Acceptance criteria:**
- [x] `backend/app/storage/suite_store.py` provides CRUD methods for `Suite` records and `EvalRun` records.
- [x] Persists dataset snapshots, target agent configuration, timestamps, and paths to generated `EvalLog` files.
- [x] Supports querying baseline runs for comparative regression analysis.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_scorecard_router.py`
- [x] Build succeeds: `uv run python -c "from app.storage.suite_store import SuiteStore"`
- [x] Manual check: Saving a suite and two consecutive runs returns them properly in history query.

**Dependencies:** Task 2

**Files touched:**
- `backend/app/storage/suite_store.py`
- `backend/tests/test_scorecard_router.py`

**Estimated scope:** Small (2 files)

---

### Task 16: Inspect `EvalLog` Parser & Metric Summary Extractor

**Description:** Implement the log parser that parses Inspect AI `EvalLog` files, extracts per-sample transcripts, tool traces, judge reasoning, and aggregates `grouped()` category metrics into `MetricSummary`.

**Acceptance criteria:**
- [x] `backend/app/core/log_parser.py` parses `EvalLog` JSON/files into `MetricSummary` and `List[SampleInspectionResult]`.
- [x] Computes overall pass rate, category pass rates (from `grouped()` metrics), policy adherence score, tool accuracy, avg latency, and token costs.
- [x] Extracts detailed tool invocations, arguments, judge reasoning, and error messages for every sample.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_scorecard_router.py`
- [x] Build succeeds: `uv run python -c "from app.core.log_parser import parse_eval_log"`
- [x] Manual check: Parsing an `EvalLog` produces exact matching `MetricSummary` numbers.

**Dependencies:** Task 13

**Files touched:**
- `backend/app/core/log_parser.py`

**Estimated scope:** Small (2 files)

---

### Task 17: ADK Diagnostic Analysis Agent & Comparative Regression Engine

**Description:** Implement the ADK Diagnostic Analysis Agent using Gemini 2.5 on Vertex AI to cluster failure modes, diagnose root causes, compute `ComparativeRunDelta` against baseline runs, and generate actionable prompt/tool fixes.

**Acceptance criteria:**
- [x] `backend/app/agents/diagnostics.py` analyzes parsed `EvalLog` data, groups failed/errored samples into semantic `FailureCluster` items, and produces `ExecutiveScorecardReport`.
- [x] Generates concrete, copy-pasteable prompt and tool schema recommendations.
- [x] Computes `ComparativeRunDelta` when a baseline run is provided (pass rate deltas, newly failed samples, newly passed samples).

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_scorecard_router.py`
- [x] Build succeeds: `uv run python -c "from app.agents.diagnostics import DiagnosticAgent"`
- [x] Manual check: Diagnostic agent correctly identifies the deliberate refund flaw in `customer_support_adk` and recommends the exact prompt constraint fix.

**Dependencies:** Task 15, Task 16

**Files touched:**
- `backend/app/agents/diagnostics.py`
- `backend/tests/test_scorecard_router.py`

**Estimated scope:** Small (2 files)

---

### Task 18: Scorecard API & Executive Scorecard Dashboard UI

**Description:** Build the Scorecard API endpoints and the Executive Scorecard Dashboard UI featuring KPI cards, Recharts category breakdowns, regression comparison badges, semantic failure clusters, and an interactive sample inspector modal.

**Acceptance criteria:**
- [x] `backend/app/routers/scorecard.py` exposes `GET /api/scorecard/{eval_id}`, `GET /api/scorecard/{eval_id}/compare/{baseline_id}`, and export endpoints (`/export/json`, `/export/markdown`).
- [x] `frontend/src/components/scorecard/ScorecardDashboard.tsx` renders top KPI cards, category pass rate bar charts, regression delta indicators, and actionable recommendations.
- [x] `frontend/src/components/scorecard/FailureClusterList.tsx` displays failure clusters with affected sample counts, root-cause explanation, and copyable suggested fix.
- [x] `frontend/src/components/scorecard/SampleInspectorModal.tsx` provides full sample transcript inspection with judge reasoning and step-by-step tool traces.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_scorecard_router.py`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Scorecard loads with charts, clicking a failure cluster filters samples, and clicking a sample opens the inspector modal with full tool traces.

**Dependencies:** Task 17

**Files touched:**
- `backend/app/routers/scorecard.py`
- `frontend/src/components/scorecard/ScorecardDashboard.tsx`
- `frontend/src/components/scorecard/FailureClusterList.tsx`
- `frontend/src/components/scorecard/SampleInspectorModal.tsx`

**Estimated scope:** Medium (4 files)

---

### Checkpoint 5: Diagnostic Analysis, Regression & Scorecard Verified
- [x] Evaluation results parse into structured KPI summaries and category distributions
- [x] Diagnostic agent clusters failure modes and generates copy-pasteable fixes
- [x] Comparative regression delta highlights newly regressed samples against baseline
- [x] Executive Scorecard and Sample Inspector modal render seamlessly in the UI

---

### Phase 6: Wizard Integration, E2E Verification & Cloud Deployment

---

### Task 19: Full Wizard Application Shell & Navigation Flow

**Description:** Connect all 6 phases into a unified, responsive wizard application shell with step navigation, state persistence, error handling, and end-to-end user flows.

**Acceptance criteria:**
- [x] `frontend/src/App.tsx` coordinates state across all 6 wizard steps: 1. Ingest → 2. Elicitation Chat → 3. Dataset Grid → 4. Task View → 5. Live Execution → 6. Executive Scorecard.
- [x] `frontend/src/components/layout/Header.tsx` and `StepNavigator.tsx` provide intuitive navigation, step status indicators, and one-click re-evaluation.
- [x] Responsive, accessible design with dark themes and toast notifications.

**Verification:**
- [x] Tests pass: `cd frontend && npx tsc --noEmit`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: User can step back and forth through the wizard with preserved state.

**Dependencies:** Task 7, Task 11, Task 14, Task 18

**Files touched:**
- `frontend/src/App.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/StepNavigator.tsx`

**Estimated scope:** Medium (4 files)

---

### Task 20: End-to-End Integration Test Suite & Automated Evaluation Scenarios

**Description:** Implement comprehensive end-to-end integration tests verifying the full lifecycle from document ingestion through evaluation execution against `examples/customer_support_adk` to scorecard generation.

**Acceptance criteria:**
- [x] `backend/tests/test_e2e.py` contains automated integration test running full workflow against sample customer support agent.
- [x] Verifies fault tolerance when target agent crashes or times out.
- [x] Validates that all LLM calls use Vertex AI ADC without requiring API keys.

**Verification:**
- [x] Tests pass: `uv run pytest backend/tests/test_e2e.py -v`
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: End-to-end evaluation run completes with valid scorecard report.

**Dependencies:** Task 19

**Files touched:**
- `backend/tests/test_e2e.py`

**Estimated scope:** Medium (3 files)

---

### Task 21: Multi-Stage Dockerfile, Docker Compose & Google Cloud Deployment Artifacts

**Description:** Create multi-stage Docker build, Docker Compose configuration for local full-stack development, and deployment artifacts for `agents-cli deploy agent-runtime` and Google Cloud Run.

**Acceptance criteria:**
- [x] `Dockerfile` builds a production-ready container compiling frontend assets and serving FastAPI backend with non-root user.
- [x] `docker-compose.yaml` orchestrates backend, frontend, and Docker sandbox containers for local testing.
- [x] Deployment scripts and documentation support `agents-cli deploy agent-runtime` and Cloud Run deployment using GCP IAM service accounts and Vertex AI ADC.

**Verification:**
- [x] Dockerfile syntax verified
- [x] Deployment shell scripts in `deploy/` verified and executable
- [x] Manual check: Container configuration specifies ADC environment variables.

**Dependencies:** Task 20

**Files touched:**
- `Dockerfile`
- `docker-compose.yaml`
- `deploy/cloud_run_deploy.sh`
- `deploy/adk_runtime_deploy.sh`

**Estimated scope:** Medium (4 files)

---

### Checkpoint 6: Full System Verification & Deployment Ready
- [x] Full end-to-end workflow runs in < 10 minutes without code
- [x] All unit, integration, and isolation tests pass cleanly (`uv run pytest backend/tests/ -v`)
- [x] Production frontend builds cleanly (`cd frontend && npm run build`)
- [x] System is fully prepared for Google Cloud Agent Platform / Cloud Run deployment
