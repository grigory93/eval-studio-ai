# Task List: EvalStudio AI (Phase 1)

<!--
Tracking file for EvalStudio AI Phase 1 implementation.
Follows the planning-and-task-breakdown specification.
-->

## Phase 1: Foundation & Core Contracts

---

## Task 1: Environment & Project Scaffolding

**Description:** Initialize the backend Python project with `uv` (`pyproject.toml`, FastAPI, Uvicorn, Inspect AI, Google ADK, Pydantic) and the frontend with Vite, React 18, TypeScript, and Tailwind CSS.

**Acceptance criteria:**
- [ ] `pyproject.toml` defines all required backend dependencies (`fastapi`, `uvicorn`, `inspect-ai>=0.3.50`, `google-agents`, `google-genai`, `pydantic>=2.0`, `pypdf`, `python-multipart`, `sse-starlette`, `pytest`, `pytest-asyncio`, `pytest-cov`) and resolves with `uv lock`.
- [ ] `backend/app/main.py` starts a FastAPI app with CORS middleware and health check endpoint `/api/health`.
- [ ] `frontend/` is initialized with React 18, TypeScript, Vite, Tailwind CSS, Lucide React, and Radix UI primitives.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: `curl http://localhost:8000/api/health` returns `{"status": "ok"}`.

**Dependencies:** None

**Files likely touched:**
- `pyproject.toml`
- `backend/app/main.py`
- `backend/app/__init__.py`
- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tailwind.config.js`

**Estimated scope:** Medium (4-5 files)

---

## Task 2: Core Data Contracts & Schemas

**Description:** Implement the complete set of Pydantic v2 data models in the backend and matching TypeScript interfaces in the frontend for datasets, samples, elicitation, tasks, scorecard reports, and regression deltas.

**Acceptance criteria:**
- [ ] `backend/app/models/dataset.py` implements `EvalCategory` (7 categories), `EvalSampleMetadata`, `EvalSampleModel`, and `EvalDatasetModel` directly compatible with Inspect AI `Sample`.
- [ ] `backend/app/models/elicitation.py` implements `RequirementDocModel`, `ElicitationMessage`, `AmbiguityFinding`, and `ConfirmedCriteriaModel`.
- [ ] `backend/app/models/task.py` implements `InspectTaskConfig`, `ScorerConfig`, and `MermaidDiagramModel`.
- [ ] `backend/app/models/scorecard.py` implements `MetricSummary`, `FailureCluster`, `SampleInspectionResult`, `ComparativeRunDelta`, and `ExecutiveScorecardReport`.
- [ ] TypeScript definitions in `frontend/src/types/` mirror all backend schemas exactly.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_models.py`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: Serialization and deserialization of a 7-category sample dataset succeeds with roundtrip equality.

**Dependencies:** Task 1

**Files likely touched:**
- `backend/app/models/dataset.py`
- `backend/app/models/elicitation.py`
- `backend/app/models/task.py`
- `backend/app/models/scorecard.py`
- `frontend/src/types/index.ts`

**Estimated scope:** Medium (5 files)

---

## Task 3: Config, Document Parsers & Ingestion API

**Description:** Build runtime configuration management (Vertex AI ADC validation), document parsers for PDF/Markdown/Text files, and the file ingestion API router.

**Acceptance criteria:**
- [ ] `backend/app/config.py` loads and validates Google Cloud Vertex AI settings (`GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`) and sandbox settings without hardcoded API keys.
- [ ] `backend/app/utils/pdf_parser.py` extracts text and document sections from PDF, Markdown, and text uploads using `pypdf`.
- [ ] `backend/app/routers/ingest.py` exposes `POST /api/ingest/upload` and `POST /api/ingest/text` returning parsed structured requirements.
- [ ] Frontend document uploader component (`frontend/src/components/ingest/DocumentUploader.tsx`) handles drag-and-drop file upload with progress feedback.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_ingest.py`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: Uploading a sample policy PDF returns extracted text sections in API response.

**Dependencies:** Task 2

**Files likely touched:**
- `backend/app/config.py`
- `backend/app/utils/pdf_parser.py`
- `backend/app/routers/ingest.py`
- `frontend/src/components/ingest/DocumentUploader.tsx`

**Estimated scope:** Medium (4 files)

---

## Checkpoint 1: Foundation, Data Contracts & Document Ingestion
- [ ] All unit tests for models and document ingestion pass (`uv run pytest`)
- [ ] FastAPI backend starts without error (`uv run uvicorn app.main:app`)
- [ ] Frontend TypeScript builds clean without type errors (`npm run build`)
- [ ] Policy upload and text extraction work end-to-end

---

## Phase 2: Socratic Elicitation & Multi-Category Dataset Synthesis

---

## Task 4: Socratic Elicitation & Gap-Detection Agent

**Description:** Implement the ADK sub-agent using Gemini 2.5 on Vertex AI (via ADC) that analyzes domain requirements, executes Socratic knowledge probing to detect unstated edge cases, conflicting policies, or missing ground truth, and outputs formal criteria and rubrics.

**Acceptance criteria:**
- [ ] `backend/app/agents/elicitation.py` implements the ADK `ElicitationAgent` using `google-agents` and Gemini 2.5 on Vertex AI.
- [ ] Agent extracts domain rules, detects ambiguities, formulates targeted clarification questions, and converts answers into formal `ConfirmedCriteriaModel`.
- [ ] Handles fallbacks and mock responses cleanly when running in test mode without Vertex AI credentials.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_elicitation.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.agents.elicitation import ElicitationAgent"`
- [ ] Manual check: Pass a vague customer refund policy text and verify the agent returns at least 3 high-value probing questions (e.g. opened items, unauthorized chargebacks).

**Dependencies:** Task 3

**Files likely touched:**
- `backend/app/agents/elicitation.py`
- `backend/tests/test_elicitation.py`

**Estimated scope:** Small (2 files)

---

## Task 5: Interactive Elicitation Chat API & UI Components

**Description:** Build the interactive elicitation chat API endpoint and UI interface where users can chat with the Socratic Elicitation Agent, answer probing questions, and confirm evaluation criteria.

**Acceptance criteria:**
- [ ] `backend/app/routers/ingest.py` provides `POST /api/elicitation/chat` for conversational Q&A and `POST /api/elicitation/confirm` to finalize criteria.
- [ ] `frontend/src/components/chat/ChatInterface.tsx` displays conversational turns, suggested clarification responses, and a confirmation summary banner.
- [ ] `frontend/src/services/api.ts` implements API calls with error handling and toast notifications.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_elicitation.py`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: Multi-turn chat successfully refines vague requirements and produces a confirmed criteria summary in the UI.

**Dependencies:** Task 4

**Files likely touched:**
- `backend/app/routers/ingest.py`
- `frontend/src/components/chat/ChatInterface.tsx`
- `frontend/src/services/api.ts`

**Estimated scope:** Medium (3 files)

---

## Task 6: Multi-Category Dataset Synthesizer Agent (50–200 Samples)

**Description:** Implement the ADK Dataset Synthesizer Agent that generates a balanced matrix of 50–200 test cases categorized across all 7 taxonomy categories (`happy_path`, `edge_case`, `adversarial`, `tool_usage`, `exception`, `policy_compliance`, `multi_turn`) in native Inspect AI `Sample` schema.

**Acceptance criteria:**
- [ ] `backend/app/agents/synthesizer.py` generates datasets structured in `EvalDatasetModel` containing 50–200 `EvalSampleModel` records.
- [ ] Every sample contains `id`, `input`, `target`, and `metadata` with `category`, `grading_rubric`, `expected_tools`, and `difficulty`.
- [ ] Distribution is balanced across all 7 taxonomy categories.
- [ ] Includes streaming/batch generation to handle high sample volume within timeout limits.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_synthesizer.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.agents.synthesizer import DatasetSynthesizerAgent"`
- [ ] Manual check: Synthesize a dataset and verify category distribution covers all 7 categories with non-empty rubrics.

**Dependencies:** Task 5

**Files likely touched:**
- `backend/app/agents/synthesizer.py`
- `backend/tests/test_synthesizer.py`

**Estimated scope:** Small (2 files)

---

## Task 7: Dataset Management API & Interactive Editable Data Grid UI

**Description:** Build dataset CRUD endpoints and the interactive editable data grid UI allowing users to inspect, filter by category, edit inputs/targets/rubrics, and add/delete test samples.

**Acceptance criteria:**
- [ ] `backend/app/routers/dataset.py` provides `POST /api/dataset/synthesize`, `GET /api/dataset/{dataset_id}`, `PUT /api/dataset/{dataset_id}/samples/{sample_id}`, and `DELETE /api/dataset/{dataset_id}/samples/{sample_id}`.
- [ ] `frontend/src/components/dataset/DatasetGrid.tsx` renders a paginated, searchable, category-filtered table with category badges, inline editing, and sample detail modal.
- [ ] Users can add custom test samples or delete existing samples directly in the UI before execution.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_dataset_router.py`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: Filtering by `adversarial` isolates attack samples; editing a target updates the sample state and persists to backend.

**Dependencies:** Task 6

**Files likely touched:**
- `backend/app/routers/dataset.py`
- `frontend/src/components/dataset/DatasetGrid.tsx`
- `frontend/src/components/dataset/SampleEditModal.tsx`

**Estimated scope:** Medium (3 files)

---

## Checkpoint 2: Elicitation & Dataset Synthesis Verified
- [ ] Socratic elicitation chat functions cleanly with requirement refinement
- [ ] 50–200 sample dataset synthesizes across all 7 categories with rubrics
- [ ] Frontend dataset grid allows full inspection, category filtering, and inline editing
- [ ] All tests pass: `uv run pytest` and `npm run build`

---

## Phase 3: Inspect AI Task Compilation & Dual-View Presentation

---

## Task 8: Sample ADK Target Agents for Evaluation & Testing

**Description:** Create reference local Google ADK target agent projects (`customer_support_adk` and `hr_benefits_adk`) with tools, policies, and deliberate known flaws to serve as realistic test targets.

**Acceptance criteria:**
- [ ] `examples/customer_support_adk/` contains `agent.py` (ADK agent with Gemini 2.5), `tools.py` (`lookup_order`, `process_refund`, `escalate_to_human`), and `policy.md`. Contains deliberate flaw (violates policy by approving refunds on opened hygiene items).
- [ ] `examples/hr_benefits_adk/` contains `agent.py`, `tools.py`, and `policy.md` (HR handbook QA agent).
- [ ] Both agents can be loaded programmatically via entrypoint format `path/to/agent:root_agent`.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_example_agents.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from examples.customer_support_adk.agent import root_agent"`
- [ ] Manual check: Invocations of sample agents return appropriate message and tool call responses.

**Dependencies:** Task 2

**Files likely touched:**
- `examples/customer_support_adk/agent.py`
- `examples/customer_support_adk/tools.py`
- `examples/customer_support_adk/policy.md`
- `examples/hr_benefits_adk/agent.py`
- `examples/hr_benefits_adk/tools.py`

**Estimated scope:** Medium (5 files)

---

## Task 9: Custom Inspect AI Scorers & Grouped Metric Helpers

**Description:** Implement custom Inspect AI scorers and grouped diagnostic metric aggregators for model-graded QA, policy adherence, tool verification, and statistical confidence intervals.

**Acceptance criteria:**
- [ ] `backend/app/core/scorers.py` implements:
  - `model_graded_qa_scorer`: Model-graded judge evaluating response quality against sample rubric.
  - `policy_adherence_scorer`: Evaluates adherence to negative constraints and boundary enforcement.
  - `tool_verification_scorer`: Deterministically verifies expected tool names and arguments against `expected_tools`.
- [ ] Attaches grouped metrics: `grouped(accuracy(), "category")`, `grouped(mean(), "category")`, `stderr()`, `ci()`.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_scorers.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.core.scorers import create_evaluation_scorers"`
- [ ] Manual check: Unit test against mock transcript confirms tool scorer passes when expected tool is called and fails when wrong tool is called.

**Dependencies:** Task 8

**Files likely touched:**
- `backend/app/core/scorers.py`
- `backend/tests/test_scorers.py`

**Estimated scope:** Small (2 files)

---

## Task 10: Inspect Task & Mermaid Flow Compiler

**Description:** Implement the Inspect Task Compiler that transforms dataset samples and target agent configuration into runnable Python task code (`task.py`) and high-level Mermaid.js sequence/flow diagrams (`diagram.mmd`).

**Acceptance criteria:**
- [ ] `backend/app/agents/compiler.py` generates executable Python task script using native Inspect AI `Task`, `MemoryDataset`, solvers, and multi-scorers with `fail_on_error=False`.
- [ ] `backend/app/utils/code_generator.py` formats valid, PEP-8 compliant Python code runnable independently with `inspect eval task.py`.
- [ ] Generates a high-level business Mermaid.js diagram illustrating user personas, target agent, tool interactions, and model-graded judges.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_compiler.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.agents.compiler import TaskCompiler"`
- [ ] Manual check: Generated `task.py` code string parses without syntax errors (`ast.parse(code)`).

**Dependencies:** Task 7, Task 9

**Files likely touched:**
- `backend/app/agents/compiler.py`
- `backend/app/utils/code_generator.py`
- `backend/tests/test_compiler.py`

**Estimated scope:** Small (3 files)

---

## Task 11: Dual-View Task Presentation UI

**Description:** Build the frontend Dual-View component displaying the visual Mermaid.js evaluation flow diagram as the primary view, with an expandable syntax-highlighted Inspect AI Python code viewer and copy/export options.

**Acceptance criteria:**
- [ ] `frontend/src/components/visualization/DualView.tsx` provides tabbed/split view switching between Mermaid workflow diagram and Python task script.
- [ ] `frontend/src/components/visualization/MermaidViewer.tsx` dynamically renders Mermaid diagrams with zoom, pan, and graceful error boundary fallback.
- [ ] `frontend/src/components/visualization/CodeViewer.tsx` displays formatted Python code with one-click copy and file download (`task.py`).

**Verification:**
- [ ] Tests pass: `cd frontend && npm run test`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: Switching tabs smoothly transitions between interactive Mermaid flow diagram and formatted Python code.

**Dependencies:** Task 10

**Files likely touched:**
- `frontend/src/components/visualization/DualView.tsx`
- `frontend/src/components/visualization/MermaidViewer.tsx`
- `frontend/src/components/visualization/CodeViewer.tsx`

**Estimated scope:** Small (3 files)

---

## Checkpoint 3: Compiler, Scorers & Dual-View UI Verified
- [ ] Inspect Task Compiler outputs 100% valid Python task scripts with multi-scorers and grouped metrics
- [ ] Dual-view UI renders Mermaid.js sequence/flow diagram and Python code viewer
- [ ] All compiler unit tests pass (`uv run pytest tests/test_compiler.py`)

---

## Phase 4: Isolated Execution Engine & Live Streaming

---

## Task 12: Target ADK Agent Loader & Inspect Bridge

**Description:** Build the dynamic agent loader and bridge module that imports local Google ADK agents from filesystem paths and wraps them in Inspect AI solver interfaces while intercepting tool invocations and state.

**Acceptance criteria:**
- [ ] `backend/app/core/bridge.py` dynamically imports ADK agents via string spec (e.g. `examples/customer_support_adk/agent.py:root_agent`).
- [ ] Bridges ADK async execution with Inspect AI `Solver` / `agent_bridge` protocol, preserving user input, model outputs, and detailed tool call arguments.
- [ ] Captures tool errors, timeout exceptions, and invalid parameters into sample metadata.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_bridge.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.core.bridge import load_adk_agent, adk_agent_solver"`
- [ ] Manual check: Calling bridge with sample ADK agent returns valid Inspect solver response.

**Dependencies:** Task 8

**Files likely touched:**
- `backend/app/core/bridge.py`
- `backend/tests/test_bridge.py`

**Estimated scope:** Small (2 files)

---

## Task 13: Subprocess Worker Isolation & Sandbox Execution Runner

**Description:** Implement the isolated runner engine that executes `inspect_ai.eval()` in dedicated worker subprocesses with optional Docker container sandboxing, ensuring agent crashes or infinite loops never affect FastAPI.

**Acceptance criteria:**
- [ ] `backend/app/core/sandbox.py` manages subprocess lifecycle, memory/time limits, and Inspect Docker sandbox configuration (`Sample.files`, `Sample.setup`).
- [ ] `backend/app/core/runner.py` executes evaluations asynchronously in worker subprocesses, writing live logs and `EvalLog` files to disk.
- [ ] Crashed worker subprocesses or unhandled agent exceptions are caught, logged, and surfaced as sample errors without crashing the main backend.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_sandbox_isolation.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.core.runner import EvalRunner"`
- [ ] Manual check: Inject a fatal crash (`sys.exit(1)` or infinite loop) into a mock target agent and verify the backend survives and records an error status.

**Dependencies:** Task 10, Task 12

**Files likely touched:**
- `backend/app/core/sandbox.py`
- `backend/app/core/runner.py`
- `backend/tests/test_sandbox_isolation.py`

**Estimated scope:** Medium (3 files)

---

## Task 14: Execution SSE Streaming API & Real-Time Progress UI

**Description:** Implement the Server-Sent Events (SSE) streaming API and the real-time execution progress UI displaying live sample execution progress, status badges, and terminal logs.

**Acceptance criteria:**
- [ ] `backend/app/routers/evaluate.py` exposes `POST /api/eval/start`, `POST /api/eval/{eval_id}/cancel`, and `GET /api/eval/{eval_id}/stream` (SSE).
- [ ] SSE emits typed events (`eval_started`, `sample_progress`, `sample_complete`, `log_chunk`, `eval_complete`, `eval_error`).
- [ ] `frontend/src/hooks/useEvalStream.ts` manages EventSource lifecycle and reconnection.
- [ ] `frontend/src/components/execution/LiveProgress.tsx` displays an animated progress bar, category counters, running sample cards, and live log terminal.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_evaluate_router.py`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: Triggering evaluation updates progress bar and streams log lines in real-time in the browser.

**Dependencies:** Task 13

**Files likely touched:**
- `backend/app/routers/evaluate.py`
- `frontend/src/hooks/useEvalStream.ts`
- `frontend/src/components/execution/LiveProgress.tsx`

**Estimated scope:** Medium (3 files)

---

## Checkpoint 4: Isolated Execution & Live Progress Verified
- [ ] Target agent runs in isolated worker subprocess with zero backend crash risk
- [ ] Real-time SSE streams execution progress, per-sample updates, and logs
- [ ] UI displays live progress bar and terminal logs smoothly

---

## Phase 5: Diagnostic Analysis, Historical Regression & Executive Scorecard

---

## Task 15: Suite & Run Storage Store for Repeatable Evals

**Description:** Implement the local JSON/SQLite storage layer that persists evaluation suites, dataset snapshots, task definitions, and historical `EvalLog` references for repeatable testing and regression analysis.

**Acceptance criteria:**
- [ ] `backend/app/storage/suite_store.py` provides CRUD methods for `Suite` records and `EvalRun` records.
- [ ] Persists dataset snapshots, target agent configuration, timestamps, and paths to generated `EvalLog` files.
- [ ] Supports querying baseline runs for comparative regression analysis.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_suite_store.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.storage.suite_store import SuiteStore"`
- [ ] Manual check: Saving a suite and two consecutive runs returns them properly in history query.

**Dependencies:** Task 2

**Files likely touched:**
- `backend/app/storage/suite_store.py`
- `backend/tests/test_suite_store.py`

**Estimated scope:** Small (2 files)

---

## Task 16: Inspect `EvalLog` Parser & Metric Summary Extractor

**Description:** Implement the log parser that parses Inspect AI `EvalLog` files, extracts per-sample transcripts, tool traces, judge reasoning, and aggregates `grouped()` category metrics into `MetricSummary`.

**Acceptance criteria:**
- [ ] `backend/app/core/log_parser.py` parses `EvalLog` JSON/files into `MetricSummary` and `List[SampleInspectionResult]`.
- [ ] Computes overall pass rate, category pass rates (from `grouped()` metrics), policy adherence score, tool accuracy, avg latency, and token costs.
- [ ] Extracts detailed tool invocations, arguments, judge reasoning, and error messages for every sample.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_log_parser.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.core.log_parser import parse_eval_log"`
- [ ] Manual check: Parsing a mock `EvalLog` produces exact matching `MetricSummary` numbers.

**Dependencies:** Task 13

**Files likely touched:**
- `backend/app/core/log_parser.py`
- `backend/tests/test_log_parser.py`

**Estimated scope:** Small (2 files)

---

## Task 17: ADK Diagnostic Analysis Agent & Comparative Regression Engine

**Description:** Implement the ADK Diagnostic Analysis Agent using Gemini 2.5 on Vertex AI to cluster failure modes, diagnose root causes, compute `ComparativeRunDelta` against baseline runs, and generate actionable prompt/tool fixes.

**Acceptance criteria:**
- [ ] `backend/app/agents/diagnostics.py` analyzes parsed `EvalLog` data, groups failed/errored samples into semantic `FailureCluster` items, and produces `ExecutiveScorecardReport`.
- [ ] Generates concrete, copy-pasteable prompt and tool schema recommendations.
- [ ] Computes `ComparativeRunDelta` when a baseline run is provided (pass rate deltas, newly failed samples, newly passed samples).

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_diagnostics.py`
- [ ] Build succeeds: `cd backend && uv run python -c "from app.agents.diagnostics import DiagnosticAgent"`
- [ ] Manual check: Diagnostic agent correctly identifies the deliberate refund flaw in `customer_support_adk` and recommends the exact prompt constraint fix.

**Dependencies:** Task 15, Task 16

**Files likely touched:**
- `backend/app/agents/diagnostics.py`
- `backend/tests/test_diagnostics.py`

**Estimated scope:** Small (2 files)

---

## Task 18: Scorecard API & Executive Scorecard Dashboard UI

**Description:** Build the Scorecard API endpoints and the Executive Scorecard Dashboard UI featuring KPI cards, Recharts category breakdowns, regression comparison badges, semantic failure clusters, and an interactive sample inspector modal.

**Acceptance criteria:**
- [ ] `backend/app/routers/scorecard.py` exposes `GET /api/scorecard/{eval_id}`, `GET /api/scorecard/{eval_id}/compare/{baseline_id}`, and export endpoints (`/export/json`, `/export/markdown`).
- [ ] `frontend/src/components/scorecard/ScorecardDashboard.tsx` renders top KPI cards, category pass rate bar/radar charts (Recharts), regression delta indicators, and actionable recommendations.
- [ ] `frontend/src/components/scorecard/FailureClusterList.tsx` displays failure clusters with affected sample counts, root-cause explanation, and copyable suggested fix.
- [ ] `frontend/src/components/scorecard/SampleInspectorModal.tsx` provides full sample transcript inspection with judge reasoning and step-by-step tool traces.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/test_scorecard_router.py`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: Scorecard loads with charts, clicking a failure cluster filters samples, and clicking a sample opens the inspector modal with full tool traces.

**Dependencies:** Task 17

**Files likely touched:**
- `backend/app/routers/scorecard.py`
- `frontend/src/components/scorecard/ScorecardDashboard.tsx`
- `frontend/src/components/scorecard/FailureClusterList.tsx`
- `frontend/src/components/scorecard/SampleInspectorModal.tsx`

**Estimated scope:** Medium (4 files)

---

## Checkpoint 5: Diagnostic Analysis, Regression & Scorecard Verified
- [ ] Evaluation results parse into structured KPI summaries and category distributions
- [ ] Diagnostic agent clusters failure modes and generates copy-pasteable fixes
- [ ] Comparative regression delta highlights newly regressed samples against baseline
- [ ] Executive Scorecard and Sample Inspector modal render seamlessly in the UI

---

## Phase 6: Wizard Integration, E2E Verification & Cloud Deployment

---

## Task 19: Full Wizard Application Shell & Navigation Flow

**Description:** Connect all 6 phases into a unified, responsive wizard application shell with step navigation, state persistence, error handling, and end-to-end user flows.

**Acceptance criteria:**
- [ ] `frontend/src/App.tsx` coordinates state across all 6 wizard steps: 1. Ingest → 2. Elicitation Chat → 3. Dataset Grid → 4. Task View → 5. Live Execution → 6. Executive Scorecard.
- [ ] `frontend/src/components/layout/Header.tsx` and `StepNavigator.tsx` provide intuitive navigation, step status indicators, and one-click re-evaluation.
- [ ] Responsive, accessible design with dark/light themes and toast notifications.

**Verification:**
- [ ] Tests pass: `cd frontend && npm run test`
- [ ] Build succeeds: `cd frontend && npm run build`
- [ ] Manual check: User can step back and forth through the wizard with preserved state.

**Dependencies:** Task 7, Task 11, Task 14, Task 18

**Files likely touched:**
- `frontend/src/App.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/StepNavigator.tsx`
- `frontend/src/components/layout/Layout.tsx`

**Estimated scope:** Medium (4 files)

---

## Task 20: End-to-End Integration Test Suite & Automated Evaluation Scenarios

**Description:** Implement comprehensive end-to-end integration tests verifying the full lifecycle from document ingestion through evaluation execution against `examples/customer_support_adk` to scorecard generation in < 10 minutes.

**Acceptance criteria:**
- [ ] `backend/tests/test_runner.py` contains automated integration test `test_customer_support_adk` running full workflow against sample customer support agent.
- [ ] Verifies fault tolerance when target agent crashes or times out.
- [ ] Validates that all LLM calls use Vertex AI ADC without requiring API keys.

**Verification:**
- [ ] Tests pass: `cd backend && uv run pytest tests/ -v --cov=app`
- [ ] Build succeeds: `cd frontend && npm run test`
- [ ] Manual check: End-to-end evaluation run completes with valid scorecard report.

**Dependencies:** Task 19

**Files likely touched:**
- `backend/tests/test_runner.py`
- `backend/tests/test_e2e.py`
- `backend/tests/conftest.py`

**Estimated scope:** Medium (3 files)

---

## Task 21: Multi-Stage Dockerfile, Docker Compose & Google Cloud Deployment Artifacts

**Description:** Create multi-stage Docker build, Docker Compose configuration for local full-stack development, and deployment artifacts for `agents-cli deploy agent-runtime` and Google Cloud Run.

**Acceptance criteria:**
- [ ] `Dockerfile` builds a production-ready container compiling frontend assets and serving FastAPI backend with non-root user.
- [ ] `docker-compose.yaml` orchestrates backend, frontend, and Docker sandbox containers for local testing.
- [ ] Deployment scripts and documentation support `agents-cli deploy agent-runtime` and Cloud Run deployment using GCP IAM service accounts and Vertex AI ADC.

**Verification:**
- [ ] Tests pass: `docker build -t eval-studio-ai .`
- [ ] Build succeeds: `docker compose config`
- [ ] Manual check: Container starts and health check passes at `http://localhost:8000/api/health`.

**Dependencies:** Task 20

**Files likely touched:**
- `Dockerfile`
- `docker-compose.yaml`
- `deploy/cloud_run_deploy.sh`
- `deploy/adk_runtime_deploy.sh`

**Estimated scope:** Medium (4 files)

---

## Checkpoint 6: Full System Verification & Deployment Ready
- [ ] Full end-to-end workflow runs in < 10 minutes without code
- [ ] All unit, integration, and isolation tests pass cleanly (`uv run pytest tests/ -v`)
- [ ] Docker image builds and runs successfully
- [ ] System is fully prepared for Google Cloud Agent Platform / Cloud Run deployment
