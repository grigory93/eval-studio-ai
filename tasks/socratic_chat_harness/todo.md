# Task List: Socratic Agentic Elicitation Harness

- [x] Task 1: Enriched Pydantic Data Contracts & Schemas
  - Acceptance: `backend/app/models/elicitation.py` defines `ClauseReference`, `EvaluationSeed`, `TaxonomyCoverage`, updates `ConfirmedCriteriaModel` with `clauses`, `test_seeds`, `taxonomy_coverage`, and updates response models without breaking backward compatibility.
  - Verify: `cd backend && uv run python -c "from app.models.elicitation import ConfirmedCriteriaModel, EvaluationSeed, ClauseReference; print('Models valid')"`
  - Files: `backend/app/models/elicitation.py`

- [x] Task 2: Frontend TypeScript Interfaces
  - Acceptance: `frontend/src/types/index.ts` exports TypeScript interfaces matching `ClauseReference`, `EvaluationSeed`, `TaxonomyCoverage`, and updated `ConfirmedCriteriaModel`.
  - Verify: `cd frontend && npm run build` (type checking succeeds)
  - Files: `frontend/src/types/index.ts`

- [x] Task 3: Socratic Agentic Harness Engine & Clause Indexer
  - Acceptance: `ElicitationAgent` in `backend/app/agents/elicitation.py` segments ingested documents into citeable `ClauseReference` objects, audits 7-category taxonomy coverage, generates structured `EvaluationSeed` proposal cards grounded in clauses, supports dual-mode operation (walkthrough vs free-form chat), and provides deterministic fallback generation.
  - Verify: `cd backend && uv run pytest tests/test_elicitation.py -v`
  - Files: `backend/app/agents/elicitation.py`

- [x] Task 4: Elicitation Router Endpoints for Seed Lifecycle & Deep Dives
  - Acceptance: `backend/app/routers/elicitation.py` provides endpoints to accept proposed seeds (`/seeds/{seed_id}/accept`), dismiss seeds (`/seeds/{seed_id}/dismiss`), add/edit custom seeds (`/seeds`), and trigger category deep dives (`/deep-dive`).
  - Verify: `cd backend && uv run pytest tests/test_elicitation.py -k "test_elicitation_router" -v`
  - Files: `backend/app/routers/elicitation.py`

- [x] Task 5: Prime Step 4 Dataset Synthesizer with Distilled Seeds
  - Acceptance: `DatasetSynthesizerAgent` in `backend/app/agents/synthesizer.py` consumes accepted seeds and category rubrics from `ConfirmedCriteriaModel.test_seeds` as priority exemplars and boundary constraints when generating the 50–200 samples.
  - Verify: `cd backend && uv run pytest tests/test_synthesizer.py -v`
  - Files: `backend/app/agents/synthesizer.py`

- [x] Task 6: Backend Unit & Integration Test Suite
  - Acceptance: All tests in `backend/tests/test_elicitation.py` pass, validating clause segmentation, taxonomy coverage math, seed acceptance lifecycle, and backward compatibility.
  - Verify: `cd backend && uv run pytest tests/test_elicitation.py tests/test_synthesizer.py -v`
  - Files: `backend/tests/test_elicitation.py`

- [x] Task 7: Frontend API Client Functions
  - Acceptance: `frontend/src/services/api.ts` defines functions for accepting seeds, dismissing seeds, triggering deep dives, and updating criteria seeds.
  - Verify: `cd frontend && npm run build`
  - Files: `frontend/src/services/api.ts`

- [x] Task 8: Scenario Proposal Card & Taxonomy Coverage Meter Components
  - Acceptance: Components `ScenarioProposalCard.tsx` and `TaxonomyCoverageMeter.tsx` are created with clear visual status, category color coding, clause badges, and 1-click action buttons.
  - Verify: Components render cleanly with unit test or type check `cd frontend && npm run build`
  - Files: `frontend/src/components/chat/ScenarioProposalCard.tsx`, `frontend/src/components/chat/TaxonomyCoverageMeter.tsx`

- [x] Task 9: Split-Screen Workbench UI in `ChatInterface.tsx`
  - Acceptance: `ChatInterface.tsx` provides a split-screen workbench: left canvas with Dual-Mode switcher (`⚡ Autonomous Walkthrough`, `💬 Socratic Chat`, `⚠️ Detected Gaps`), message stream with interactive Scenario Proposal Cards; right pane with live Evaluation Blueprint tabbed across 7 categories, real-time coverage gauge, and synthesis CTA.
  - Verify: Open browser / run `cd frontend && npm run test` & `npm run build`
  - Files: `frontend/src/components/chat/ChatInterface.tsx`

- [x] Task 10: End-to-End Workflow Verification & Quality Check
  - Acceptance: End-to-end flow from Step 2 Ingest Spec -> Step 3 Dual-Mode Socratic Workbench -> Step 4 Primed Dataset Synthesis operates smoothly with zero console errors, zero runtime crashes, and full test passage.
  - Verify: `cd backend && uv run pytest -v` and `cd frontend && npm run build`
  - Files: Full system
