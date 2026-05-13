# TASK-08: TPO — Story Board, Change Request & Release Notes

> **Phase:** 2 — TPO Mode | **Priority:** P1 | **Effort:** 8 hours

## Objective

Build the Story Board (Kanban + dependency graph), the Change Request screen, and the Release Notes generator. These complete the full TPO lifecycle.

## Prerequisites

- TASK-07 complete (plans can be created and signed off)

## Backend Skills Used

| Skill | Purpose |
|-------|---------|
| `sfspeckit-stories` | Decompose plan into developer story files |
| `sfspeckit-review` | Validate story decomposition |
| `sfspeckit-change` | Mid-sprint change impact analysis |
| `sfspeckit-release-notes` | Aggregate stories into release notes |

## Acceptance Criteria

- [ ] Story Board shows stories in Kanban columns (DRAFT → READY → IMPLEMENTING → QA → DONE)
- [ ] Dependency graph renders as a Mermaid flowchart
- [ ] "Generate Stories" button invokes `sfspeckit-stories` and creates `task_story_*.md` files
- [ ] Change Request screen accepts a change description and shows impact report
- [ ] Release Notes screen generates `RELEASE_NOTES.md` with one click

## Implementation Steps

### Step 1: Create `client/src/modes/TPO/StoryBoard.jsx`
- **Kanban View:** Columns for each story status
  - Each story is a draggable card showing: title, type (FULL/DECLARATIVE), effort estimate
  - Cards are color-coded by status
- **Dependency Graph View:** Toggle to a Mermaid flowchart
  - Shows `task_story_00 → task_story_01, 02, 03` relationships
  - Parallel stories marked with `[P]`
- **"Generate Stories" Button:** Only enabled when plan has architect sign-off
  - Calls `POST /api/tpo/stories`
  - Shows progress spinner while AI generates stories
  - Refreshes board when done
- **Sprint Planning View:** Suggested sprint allocation based on dependencies and effort

### Step 2: Create `client/src/modes/TPO/ChangeRequest.jsx`
- **Change Description:** Large textarea for the TPO to describe the change
- **"Analyze Impact" Button:** Sends to AI with `sfspeckit-change` skill
- **Impact Report Display:**
  - Summary table (Spec/Plan/Data Model impact levels)
  - Affected stories table with severity color coding (🔴 Major, 🟡 Minor, ⚪ None)
  - New stories needed (if any)
  - Destructive changes alert (if any fields/objects to delete)
  - Estimation impact (+X hours)
- **"Apply Changes" Button:** Updates all affected files via AI

### Step 3: Create `client/src/modes/TPO/ReleaseNotes.jsx`
- **Feature Selector:** Dropdown to choose a feature
- **"Generate Release Notes" Button:** Invokes `sfspeckit-release-notes`
- **Preview Panel:** Renders the generated `RELEASE_NOTES.md` with:
  - Executive summary
  - Functional highlights per story
  - Quality & assurance snapshot (scoring table)
  - Technical inventory (new objects, classes, components)
- **Export Options:** "Copy as Markdown" and "Download as PDF" buttons

### Step 4: Create API Routes
```
POST /api/tpo/stories
Body: { featureId }
Action: Load sfspeckit-stories skill, generate task_story_*.md files

POST /api/tpo/review
Body: { featureId }
Action: Load sfspeckit-review skill, validate stories

POST /api/tpo/change
Body: { featureId, changeDescription }
Action: Load sfspeckit-change skill, generate impact report

POST /api/tpo/release-notes
Body: { featureId }
Action: Load sfspeckit-release-notes skill, generate RELEASE_NOTES.md
```

## Files Created

| File | Action |
|------|--------|
| `client/src/modes/TPO/StoryBoard.jsx` | NEW |
| `client/src/modes/TPO/StoryCard.jsx` | NEW |
| `client/src/modes/TPO/DependencyGraph.jsx` | NEW |
| `client/src/modes/TPO/ChangeRequest.jsx` | NEW |
| `client/src/modes/TPO/ReleaseNotes.jsx` | NEW |
| `server/routes/tpo-routes.js` | MODIFIED (add stories/change/release routes) |

## Definition of Done

- [ ] Kanban board correctly categorizes stories by status
- [ ] Dependency graph accurately reflects story relationships
- [ ] Change request impact report is actionable and visually clear
- [ ] Release notes preview matches the `sfspeckit-release-notes` output format
- [ ] All operations persist changes to the correct markdown files
