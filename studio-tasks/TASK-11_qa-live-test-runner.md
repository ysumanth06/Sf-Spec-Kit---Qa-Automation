# TASK-11: QA — Live Test Runner & Playwright Streaming

> **Phase:** 3 — QA Mode | **Priority:** P1 | **Effort:** 6 hours

## Objective

Build the Live Test Runner that executes Playwright tests and streams real-time results (pass/fail per step, screenshots, logs) back to the Studio UI via WebSocket.

## Prerequisites

- TASK-09 complete (test files exist)
- Playwright framework installed in the E2E directory
- `personas.json` and `.env` configured for the target org

## Backend Skills Used

| Skill | Purpose |
|-------|---------|
| `sfspeckit-e2e-regression` | Full regression suite execution |
| `sfspeckit-e2e-discover` | Record & playback (codegen bridge) |

## Acceptance Criteria

- [ ] "Run Test" button spawns Playwright and streams live output
- [ ] Per-step progress bar shows pass/fail as each step completes
- [ ] Screenshots captured on failure are displayed inline
- [ ] Persona selector allows running a test as a specific user
- [ ] "Run All" triggers full regression and shows aggregate results
- [ ] "Cancel" button terminates a running test
- [ ] Terminal panel shows raw Playwright output for debugging

## Implementation Steps

### Step 1: Create `server/test-runner.js`
Manages Playwright process lifecycle:
```javascript
// Core functions:
runTest(testPath, persona, orgAlias)   // Run a single .test.json
runRegression(suite, orgAlias)         // Run all tests in a suite
cancelRun(runId)                       // Kill the child process
getRunStatus(runId)                    // Check if still running

// Execution:
// 1. Spawns: npx playwright test executor/json-runner.spec.ts
//    with env vars: TEST_FILE=<path>, PERSONA=<name>, TARGET_ORG=<alias>
// 2. Captures stdout line-by-line
// 3. Parses Playwright JSON reporter output for step-level results
// 4. Emits WebSocket events per step: { step, status, screenshot?, duration }
```

### Step 2: Create WebSocket Channel — `/ws/test-runner`
Events emitted to frontend:
```
test:start      → { runId, testName, totalSteps }
step:pass       → { runId, stepIndex, stepName, duration }
step:fail       → { runId, stepIndex, stepName, error, screenshotPath }
test:complete   → { runId, passed, failed, duration }
test:error      → { runId, error }
```

### Step 3: Create `client/src/modes/QA/LiveTestRunner.jsx`
- **Test Selector:** Dropdown of available test files
- **Persona Selector:** Multi-select from `personas.json`
- **"Run" Button:** Starts execution, shows progress
- **Step Timeline:** Vertical list of steps with live status:
  - ⏳ Pending (gray)
  - ▶️ Running (blue, animated pulse)
  - ✅ Passed (green)
  - ❌ Failed (red, with expandable error + screenshot)
- **Progress Bar:** Overall percentage (steps completed / total)
- **Duration Timer:** Live elapsed time counter
- **"Cancel" Button:** Visible only during execution

### Step 4: Create `client/src/modes/QA/ScreenshotViewer.jsx`
- Modal that shows failure screenshots at full size
- Side-by-side comparison (expected vs. actual) when available
- Zoom and pan controls
- "Download" button to save screenshot locally

### Step 5: Create API Routes
```
POST /api/qa/run
Body: { testPath, persona, orgAlias }
Action: Spawn Playwright, return runId
Response: { runId }

POST /api/qa/run-regression
Body: { suite: "stories" | "baseline" | "all", orgAlias }
Action: Run full suite, return runId

POST /api/qa/run/:runId/cancel
Action: Kill the child process

GET /api/qa/run/:runId/status
Action: Return current run state + step results
```

## Files Created

| File | Action |
|------|--------|
| `studio/server/test-runner.js` | NEW |
| `client/src/modes/QA/LiveTestRunner.jsx` | NEW |
| `client/src/modes/QA/StepTimeline.jsx` | NEW |
| `client/src/modes/QA/ScreenshotViewer.jsx` | NEW |
| `server/routes/qa-routes.js` | MODIFIED (add run routes) |

## Definition of Done

- [ ] Playwright launches and executes tests from the Studio UI
- [ ] Per-step results stream in real-time without polling
- [ ] Failed steps show the error message and screenshot inline
- [ ] Cancel button successfully terminates a running test
- [ ] Multiple concurrent runs are tracked independently
