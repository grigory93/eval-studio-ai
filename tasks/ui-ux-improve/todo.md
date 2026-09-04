# EvalStudio AI — UI/UX & Functional Improvements: Progress & Task Tracker

<!--
Consolidated tracking file for EvalStudio AI UI/UX & Functional Improvements (Phase 1.5).
Follows the planning-and-task-breakdown specification.
-->

## Status Overview
- **Phase 1: Dedicated Target Agent Selection Step (Step 1)** -> [x] COMPLETED
- **Phase 2: Task View Code & Dataset Samples Decoupling (Step 5)** -> [x] COMPLETED
- **Phase 3: Socratic Elicitation Workbench Simplification (Step 3)** -> [x] COMPLETED
- **Phase 4: Scorecard Category-Grouped Filtering (Step 7)** -> [x] COMPLETED
- **Phase 5: Verification & Quality Gate** -> [ ] PENDING

---

## Detailed Task Breakdown

### Phase 1: Dedicated Target Agent Selection Step (Step 1)

---

### Task 1: Build Standalone AgentSelector Component

**Description:** Implement `frontend/src/components/agent/AgentSelector.tsx` to handle target ADK agent selection as the new first step in the wizard. The component displays pre-configured sample ADK agents with domain descriptions and declared tool chips, supports custom local entrypoint inputs (`path/to/agent.py:root_agent`) with live inspection via `inspectAgent()`, renders a summary card of detected tools and validation badge, and provides a prominent "Proceed to Specification Ingestion →" CTA.

**Acceptance criteria:**
- [x] Renders sample agent benchmark cards (`customer-support`, `hr-benefits`) with selection radio and tool badges.
- [x] Provides text input for custom local agent entrypoint with live validation status.
- [x] Displays inspected tools summary and triggers `onAgentSelected(spec, tools)` on CTA click.

**Verification:**
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Agent cards render and selection updates state.

**Dependencies:** None

**Files likely touched:**
- `frontend/src/components/agent/AgentSelector.tsx`

**Estimated scope:** Small (1 file)

---

### Task 2: Update StepNavigator for 7-Step Sequence

**Description:** Update `frontend/src/components/layout/StepNavigator.tsx` to include `1. Target Agent` as the first step, expanding the total step count from 6 to 7 (`1. Target Agent`, `2. Ingest Spec`, `3. Elicitation`, `4. Dataset Grid`, `5. Task View`, `6. Live Run`, `7. Scorecard`).

**Acceptance criteria:**
- [x] `STEPS` array defines all 7 steps with appropriate icons (`Bot`, `FileText`, `MessageSquare`, `Database`, `Layers`, `PlayCircle`, `Award`).
- [x] Navigation gates prevent clicking ahead past `maxStepReached`.
- [x] Active and completed states render accurately.

**Verification:**
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: All 7 step pills visible and clickable when reached.

**Dependencies:** Task 1

**Files likely touched:**
- `frontend/src/components/layout/StepNavigator.tsx`

**Estimated scope:** Small (1 file)

---

### Task 3: Refactor DocumentUploader & App State Machine

**Description:** Refactor `frontend/src/components/ingest/DocumentUploader.tsx` to remove the embedded agent selection card, refocusing it 100% on requirements and policy documents. Update `frontend/src/App.tsx` state machine to initialize at Step 1 (`AgentSelector`), wire `handleAgentSelected` to advance to Step 2, and shift all downstream step indices cleanly.

**Acceptance criteria:**
- [x] `DocumentUploader` has no agent selector card; header indicates "Step 2: Document & Requirement Ingestion".
- [x] `App.tsx` renders `AgentSelector` at step 1 and advances to step 2 upon selection.
- [x] Wizard state machine correctly handles transitions from Step 1 to Step 7.

**Verification:**
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: App loads on Step 1, selecting an agent advances to Step 2, ingesting spec advances to Step 3.

**Dependencies:** Task 1, Task 2

**Files likely touched:**
- `frontend/src/components/ingest/DocumentUploader.tsx`
- `frontend/src/App.tsx`

**Estimated scope:** Medium (2 files)

---

## Checkpoint: After Tasks 1-3 (Phase 1 Complete)
- [x] Frontend builds cleanly with 0 TypeScript errors (`cd frontend && npm run build`).
- [x] Step 1 allows selecting an agent and transitions smoothly to Step 2.
- [x] Document uploader on Step 2 is clean and free of agent selection clutter.
- [x] Review with user before proceeding to Phase 2.

---

### Phase 2: Task View Code & Dataset Samples Decoupling (Step 5)

---

### Task 4: Reorganize Task Code Generation in Backend

**Description:** Refactor `backend/app/utils/code_generator.py` so that the `@task` function, solvers, and multi-scorers are placed at the top of the file immediately below imports, with dataset loading structured into a helper function and `RAW_SAMPLES` placed cleanly at the bottom.

**Acceptance criteria:**
- [x] `@task` definition is rendered first in the generated Python script.
- [x] Dataset loading is structured via `get_dataset()` helper.
- [x] Python syntax compiles cleanly via `compile()`.

**Verification:**
- [x] Tests pass: `cd backend && uv run pytest tests/ -v`

**Dependencies:** None

**Files likely touched:**
- `backend/app/utils/code_generator.py`

**Estimated scope:** Small (1 file)

---

### Task 5: Multi-Tab CodeViewer & DualView Integration

**Description:** Update `frontend/src/components/visualization/CodeViewer.tsx` with a multi-file tab switcher (`task.py` vs `samples.json`), including sample count badges and file-specific copy/download actions. Update `frontend/src/components/visualization/DualView.tsx` to pass both task code and formatted dataset samples JSON to `CodeViewer`.

**Acceptance criteria:**
- [x] Sub-tabs `task.py` and `samples.json` toggle code views instantly.
- [x] `task.py` tab displays clean Inspect AI task code (~60 lines) without sample clutter.
- [x] `samples.json` tab displays formatted dataset sample records with count badge.
- [x] Copy and Download buttons operate on the active sub-tab.

**Verification:**
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: In Step 5, switching between tabs updates code and sample views cleanly.

**Dependencies:** Task 4

**Files likely touched:**
- `frontend/src/components/visualization/CodeViewer.tsx`
- `frontend/src/components/visualization/DualView.tsx`

**Estimated scope:** Medium (2 files)

---

## Checkpoint: After Tasks 4-5 (Phase 2 Complete)
- [x] Backend tests pass (`uv run pytest tests/ -v`).
- [x] Generated `task.py` has `@task` at top.
- [x] Multi-tab switcher in Task View allows inspecting task code without scrolling past samples.
- [x] Review with user before proceeding to Phase 3.

---

### Phase 3: Socratic Elicitation Workbench Simplification (Step 3)

---

### Task 6: Restructure ChatInterface to 2-Pane Split with Active Work Tabs

**Description:** Reorganize `frontend/src/components/chat/ChatInterface.tsx` from a cramped 3-column layout into a balanced 2-Pane Workspace (`lg:grid-cols-12`: 7 cols left, 5 cols right). The Left Pane provides tabbed switching between Tab 1 ("Detected Gaps & Ambiguities" with open badge counter) and Tab 2 ("Socratic Chat Assistant").

**Acceptance criteria:**
- [x] Left Pane (~60%) hosts tabs for "Detected Gaps & Ambiguities" and "Socratic Chat Assistant".
- [x] Ambiguity tab displays full-width cards with 1-click decision pills and inline custom resolution.
- [x] Socratic Chat tab provides conversational thread with Gemini 2.5 and quick-reply chips.
- [x] Open badge indicator live-updates as ambiguities are resolved.

**Verification:**
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Toggling tabs switches views smoothly without horizontal squeeze.

**Dependencies:** Task 3

**Files likely touched:**
- `frontend/src/components/chat/ChatInterface.tsx`
- `frontend/src/components/chat/ChatInterface.test.tsx`

**Estimated scope:** Medium (1 file)

---

### Task 7: Refactor Confirmed Criteria Results Blueprint & Actions

**Description:** Implement the Right Pane (~40%) in `frontend/src/components/chat/ChatInterface.tsx` as a persistent live blueprint of Confirmed Criteria (Tools, Business Rules, Safety Constraints, Edge Cases). Supports inline editing, deletion, and additions, with a sticky bottom progress bar and "Confirm Criteria & Synthesize Dataset →" CTA.

**Acceptance criteria:**
- [x] Confirmed criteria update reactively when rules are resolved from either active work tab.
- [x] Inline editing (`Edit3`), deleting (`Trash2`), and adding (`+ Add Rule`) work seamlessly.
- [x] Sticky bottom CTA shows progress ("N of M Gaps Addressed") and advances to Dataset Grid.

**Verification:**
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Resolving a gap or adding a rule reflects immediately in the right pane.

**Dependencies:** Task 6

**Files likely touched:**
- `frontend/src/components/chat/ChatInterface.tsx`
- `frontend/src/components/chat/ChatInterface.test.tsx`

**Estimated scope:** Medium (1 file)

---

## Checkpoint: After Tasks 6-7 (Phase 3 Complete)
- [x] Frontend builds cleanly (`npm run build`).
- [x] Step 3 displays a clean 2-Pane layout without visual congestion.
- [x] Real-time reactive synchronization between active work tabs and criteria pane verified.
- [x] Unit tests pass: `npx vitest run src/components/chat/ChatInterface.test.tsx`.

---

### Phase 4: Scorecard Category-Grouped Filtering (Step 7)

---

### Task 8: Interactive Category Pass Rate Distribution Bars

**Description:** Make the category bars in "Category Pass Rate Distribution" interactive in `frontend/src/components/scorecard/ScorecardDashboard.tsx`. Clicking any category row toggles `selectedCategory` state, with distinct hover and active highlight styles.

**Acceptance criteria:**
- [x] Category rows have hover effect and pointer cursor.
- [x] Active category shows highlighted background (`bg-sky-950/40`), border (`border-sky-500/50`), and selection indicator.
- [x] Clicking the selected category again deselects it.

**Verification:**
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Clicking category bars toggles selection state.

**Dependencies:** None

**Files likely touched:**
- `frontend/src/components/scorecard/ScorecardDashboard.tsx`
- `frontend/src/components/scorecard/ScorecardDashboard.test.tsx`

**Estimated scope:** Small (1 file)

---

### Task 9: Dual-Axis Sample Table Filtering & Smooth Deselect Toolbar

**Description:** Implement multiplicative filtering (`selectedCategory` + `filterPassed`) in the Sample Execution Inspector table in `frontend/src/components/scorecard/ScorecardDashboard.tsx`. Add an active category filter chip (`Category: [Name ✕]`) in the table toolbar with smooth deselecting, and dynamically recalculate `All`, `Passed`, and `Failed` count badges based on the active category.

**Acceptance criteria:**
- [x] Table toolbar displays active category chip with a 1-click clear (`✕`) button.
- [x] Deselecting via chip or re-clicking category bar clears filter smoothly without layout jitter.
- [x] Status buttons (`All`, `Passed`, `Failed`) dynamically update counts for the selected category.
- [x] Sample table rows filter accurately by both category and pass/fail status.

**Verification:**
- [x] Build succeeds: `cd frontend && npm run build`
- [x] Manual check: Select a category (e.g. `adversarial`), verify only those samples appear and counts match; click `✕` to verify smooth return to all samples.

**Dependencies:** Task 8

**Files likely touched:**
- `frontend/src/components/scorecard/ScorecardDashboard.tsx`
- `frontend/src/components/scorecard/ScorecardDashboard.test.tsx`

**Estimated scope:** Medium (1 file)

---

## Checkpoint: After Tasks 8-9 (Phase 4 Complete)
- [x] Frontend builds cleanly (`npm run build`).
- [x] Category selection and smooth deselection in Scorecard verified.
- [x] Dual-axis filtering and dynamic count recalculations verified.
- [x] Unit tests pass: `npx vitest run src/components/scorecard/ScorecardDashboard.test.tsx`.

---

### Phase 5: Verification & Quality Gate

---

### Task 10: Full Test Suite & End-to-End User Flow Verification

**Description:** Execute the complete backend test suite, frontend TypeScript checks and production build, and perform an end-to-end verification of the 7-step wizard across all four initiatives.

**Acceptance criteria:**
- [ ] `cd backend && uv run pytest tests/ -v` passes with 100% success.
- [ ] `cd frontend && npx tsc --noEmit && npm run build` exits with 0 errors.
- [ ] Complete 7-step evaluation flow runs from Target Agent to Filtered Scorecard without errors.

**Verification:**
- [ ] Automated tests pass.
- [ ] Production build succeeds.
- [ ] End-to-end user flow verified.

**Dependencies:** Tasks 1-9

**Files likely touched:**
- Test suites and full project build

**Estimated scope:** Medium

---

## Checkpoint: Final Completion
- [ ] All 10 tasks verified and checked off.
- [ ] All 5 checkpoints cleared.
- [ ] Clean git diff ready for user review.
