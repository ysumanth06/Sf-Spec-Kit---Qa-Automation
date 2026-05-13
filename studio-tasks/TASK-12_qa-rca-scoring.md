# TASK-12: QA — RCA Triage Dashboard & Quality Scoring

> **Phase:** 3 — QA Mode | **Priority:** P1 | **Effort:** 6 hours

## Objective

Build the RCA Triage Dashboard for failed test analysis and the Quality Scoring Dashboard that invokes `sfspeckit-score`.

## Prerequisites

- TASK-11 complete (tests can be executed and results collected)

## Backend Skills Used

| Skill | Purpose |
|-------|---------|
| `sfspeckit-score` | 555-point quality scoring across all layers |
| `sfspeckit-qa` | Technical QA with persona coverage matrix |
| `sfspeckit-uat` | Business UAT script generation |

## Acceptance Criteria

- [ ] RCA Dashboard shows failed tests with screenshots side-by-side with AI explanation
- [ ] 12-category RCA classification displayed for each failure
- [ ] "Auto-Fix" button sends failure context to AI and proposes a JSON fix
- [ ] Quality Scoring Dashboard shows feature-level and per-story scores
- [ ] Score breakdown by layer: Metadata (120), Apex (150), LWC (165), Testing (120)
- [ ] "Top Improvements" section lists actionable recommendations

## Implementation Steps

### Step 1: Create `client/src/modes/QA/RCATriage.jsx`
- **Failed Test List:** Sidebar listing all failed tests from the last run
- **Detail Panel:** For each failed test:
  - **Screenshot:** Full-size failure screenshot
  - **Failed Step:** Highlighted step card with error message
  - **RCA Category:** Badge showing the root cause category:
    - SELECTOR_STALE, TIMING_RACE, DATA_MISSING, FLS_DENIED,
    - VALIDATION_RULE, FLOW_ERROR, APEX_ERROR, NETWORK_TIMEOUT,
    - ISOLATION_DATA_CONFLICT, ENVIRONMENT_VIEWPORT, UNKNOWN, INFRASTRUCTURE
  - **AI Explanation:** Natural language explanation from the gateway
  - **"Auto-Fix" Button:** Sends the error + test JSON to AI, receives a corrected JSON
  - **"Apply Fix" Button:** Saves the corrected JSON and offers to re-run

### Step 2: Create `client/src/modes/QA/QualityScoring.jsx`
- **Feature Selector:** Dropdown to choose a feature
- **"Run Scoring" Button:** Invokes `sfspeckit-score` via gateway
- **Overall Score Card:** Large circular progress showing total/555
- **Layer Breakdown:** Four horizontal bars (Metadata, Apex, LWC, Testing)
- **Per-Story Table:** Each story with its individual scores
- **Top Improvements:** Ranked list of specific recommendations with point gains
- **Code Coverage Table:** Per-class coverage with pass/fail indicators
- **Readiness Indicator:** "Ready for Deployment" or "Improvements Needed"

### Step 3: Create API Routes
```
GET /api/qa/rca/:runId
Action: Parse RCA report from the last Playwright run
Return: Array of { testName, step, error, category, screenshotPath }

POST /api/qa/rca/explain
Body: { testName, error, testJson }
Action: Send to AI Gateway for natural language explanation
Return: { explanation, suggestedFix }

POST /api/qa/rca/auto-fix
Body: { testPath, error, currentJson }
Action: Send to AI Gateway with sfspeckit-e2e skill for fix proposal
Return: { fixedJson, changesDescription }

POST /api/qa/score
Body: { featureId }
Action: Load sfspeckit-score skill, analyze feature codebase
Return: { overall, metadata, apex, lwc, testing, perStory[], improvements[] }

POST /api/qa/uat
Body: { featureId, storyId }
Action: Load sfspeckit-uat skill, generate business UAT scripts
Return: { uatPath }
```

## Files Created

| File | Action |
|------|--------|
| `client/src/modes/QA/RCATriage.jsx` | NEW |
| `client/src/modes/QA/FailureDetail.jsx` | NEW |
| `client/src/modes/QA/QualityScoring.jsx` | NEW |
| `client/src/modes/QA/ScoreBreakdown.jsx` | NEW |
| `server/routes/qa-routes.js` | MODIFIED (add RCA + score routes) |

## Definition of Done

- [ ] Failed tests are displayed with screenshots and AI explanations
- [ ] Auto-fix generates valid corrected JSON that passes validation
- [ ] Quality scores match the scoring rubrics defined in each skill
- [ ] Recommendations are specific and actionable (not generic advice)
- [ ] UAT scripts are generated in business-friendly language
