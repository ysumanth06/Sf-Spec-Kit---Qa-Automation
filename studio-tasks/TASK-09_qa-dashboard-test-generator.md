# TASK-09: QA — Test Dashboard & Story Test Generator

> **Phase:** 3 — QA Mode | **Priority:** P1 | **Effort:** 8 hours

## Objective

Build the QA Test Dashboard (landing screen) and the Story Test Generator that invokes `sfspeckit-e2e-story` to create `.test.json` files from developer stories.

## Prerequisites

- TASK-01 through TASK-05 complete (foundation, gateway, state engine)
- `.agents/skills/sfspeckit-e2e-story/SKILL.md` available

## Backend Skills Used

| Skill | Purpose |
|-------|---------|
| `sfspeckit-e2e-story` | Parse story → generate `.test.json` → execute via Playwright |
| `sfspeckit-e2e-baseline` | Scan org metadata → generate baseline tests |
| `sfspeckit-qa` | Technical QA verification with persona coverage |

## Acceptance Criteria

- [ ] Test Dashboard shows total tests, pass rate, last run timestamp
- [ ] Quick action buttons: "Generate Test", "Run All", "View Reports"
- [ ] Story Test Generator shows a list of stories to select from
- [ ] Clicking "Generate E2E Test" invokes `sfspeckit-e2e-story` via AI Gateway
- [ ] Generated `.test.json` is saved and appears in the test list
- [ ] Baseline Scanner provides a one-click org scan

## Implementation Steps

### Step 1: Create `client/src/modes/QA/TestDashboard.jsx`
- **Metrics Bar:** Total tests, pass rate %, last run date
- **Quick Actions:** Three large buttons (Generate, Run All, Reports)
- **Recent Runs Table:**
  - Columns: Test Name, Persona, Result (Pass/Fail badge), Duration, Date
  - Click a row → navigates to detailed results
- **Story Coverage:** Which stories have E2E tests vs. which don't

### Step 2: Create `client/src/modes/QA/StoryTestGenerator.jsx`
- **Story Selector:** List of `task_story_*.md` files from the active feature
  - Shows story title, status, and whether an E2E test already exists
- **"Generate E2E Test" Button:**
  - Sends story content to AI Gateway with `sfspeckit-e2e-story` skill
  - Shows progress: "Parsing story..." → "Scanning org metadata..." → "Generating tests..."
  - On completion, displays the generated test in a visual step preview
- **Test Preview Panel:**
  - Each step shown as a card: Action icon + Target + Value
  - Persona badges showing which personas will be tested
  - "Edit" button → opens Visual Test Editor (TASK-10)
  - "Run Now" button → triggers Playwright execution (TASK-11)
- **Baseline Scanner Button:**
  - Scope selector (Full Org / Specific Objects / Domain: Sales/Service)
  - Invokes `sfspeckit-e2e-baseline` skill
  - Shows generated baseline test count

### Step 3: Create API Routes
```
POST /api/qa/e2e-story
Body: { featureId, storyId }
Action:
  1. Read task_story_NN.md
  2. Load sfspeckit-e2e-story SKILL.md as system prompt
  3. Send to AI Gateway with story content as context
  4. Parse AI response as JSON
  5. Write to tests/stories/<storyId>.test.json
  6. Return { testPath, stepCount, personaCount }

POST /api/qa/e2e-baseline
Body: { orgAlias, scope, objects[] }
Action:
  1. Load sfspeckit-e2e-baseline SKILL.md
  2. Query org metadata via sf-provider
  3. Send metadata to AI Gateway for test generation
  4. Write baseline tests to tests/baseline/
  5. Return { testCount, objectsCovered }

GET /api/qa/tests
Action: Scan tests/stories/ and tests/baseline/ for all .test.json files
Return: Array of { name, path, stepCount, personas, lastRun }

GET /api/qa/test-results
Action: Scan reports/ for recent execution results
Return: Array of { testName, persona, result, duration, date, screenshotPath }
```

## Files Created

| File | Action |
|------|--------|
| `client/src/modes/QA/TestDashboard.jsx` | NEW |
| `client/src/modes/QA/StoryTestGenerator.jsx` | NEW |
| `client/src/modes/QA/TestPreview.jsx` | NEW |
| `server/routes/qa-routes.js` | NEW |

## Definition of Done

- [ ] Dashboard metrics are calculated from actual test result files
- [ ] Story list accurately reflects which stories have/don't have E2E tests
- [ ] Generated `.test.json` files are valid JSON matching the SFSpeckit DSL schema
- [ ] Baseline scanner creates tests for the selected scope
- [ ] All test files are written to the correct directories
