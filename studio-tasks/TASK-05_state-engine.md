# TASK-05: Feature Lifecycle State Engine

> **Phase:** 1 — Foundation | **Priority:** P0 | **Effort:** 4 hours

## Objective

Build the backend `state-engine.js` that scans `sfspeckit-data/specs/` and determines the lifecycle state of each feature. This powers every status badge and workflow gate in the UI.

## Prerequisites

- TASK-01 complete (Express server)
- `sfspeckit-data/specs/` directory exists with at least one feature

## Acceptance Criteria

- [ ] `GET /api/features` returns a list of all features with their current state
- [ ] `GET /api/features/:id/state` returns the detailed state of a single feature
- [ ] State detection is accurate for all 10 lifecycle states
- [ ] API response includes file inventory (which files exist)

## State Detection Rules

| State | Detection Logic |
|-------|----------------|
| `EMPTY` | Feature directory exists but no `spec.md` |
| `DRAFT` | `spec.md` exists, no `clarification-report*.md` |
| `CLARIFIED` | `clarification-report*.md` exists |
| `PLANNED` | `plan.md` exists, architect sign-off is empty |
| `ARCHITECT_REVIEW` | `plan.md` exists, sign-off section present but unchecked |
| `STORIES_READY` | `task_story_*.md` files exist, all have `DRAFT` status |
| `REVIEWED` | All stories have `READY` status |
| `ACTIVE` | Any story has `IMPLEMENTING` or `REVIEW` status |
| `QA_IN_PROGRESS` | Any `*.test.json` or `*_e2e_results.md` exists |
| `RELEASED` | `RELEASE_NOTES.md` exists |

## Implementation Steps

### Step 1: Create `server/state-engine.js`
```javascript
// Core functions:
listFeatures()              // Scan sfspeckit-data/specs/ for directories
getFeatureState(featureId)  // Determine lifecycle state for one feature
getFileInventory(featureId) // List all files in the feature directory
parseStoryStatuses(dir)     // Read all task_story_*.md and extract Status field
checkArchitectSignOff(dir)  // Parse plan.md for sign-off checkbox
```

### Step 2: Create `server/markdown-parser.js`
Utility to extract structured data from SFSpeckit markdown files:
- `extractField(content, fieldName)` — Finds `**Field:** value` patterns
- `extractStatus(content)` — Finds the Status field in story files
- `extractSignOff(content)` — Checks for `[x] APPROVED` in plan.md
- `extractClarificationMarkers(content)` — Counts `[NEEDS CLARIFICATION]` markers

### Step 3: Create API Routes
```
GET /api/features           → state-engine.listFeatures()
GET /api/features/:id       → Full feature detail (state + files + stories)
GET /api/features/:id/state → state-engine.getFeatureState()
```

### Step 4: Response Shape
```json
{
  "features": [
    {
      "id": "001-invoice-mgmt",
      "name": "Invoice Management",
      "state": "ACTIVE",
      "stateLabel": "Development In Progress",
      "stateColor": "blue",
      "files": {
        "spec": true,
        "clarification": true,
        "plan": true,
        "dataModel": true,
        "stories": 4,
        "tests": 2,
        "releaseNotes": false
      },
      "stories": [
        { "id": "task_story_00", "title": "Foundation", "status": "DONE" },
        { "id": "task_story_01", "title": "Invoice UI", "status": "IMPLEMENTING" }
      ]
    }
  ]
}
```

## Files Created

| File | Action |
|------|--------|
| `studio/server/state-engine.js` | NEW |
| `studio/server/markdown-parser.js` | NEW |
| `studio/server/routes/feature-routes.js` | NEW |

## Definition of Done

- [ ] API correctly identifies the state for features at every lifecycle stage
- [ ] Story statuses are accurately extracted from markdown files
- [ ] Architect sign-off detection works for both checked and unchecked states
- [ ] Empty or malformed directories don't crash the engine (graceful fallback)
