# TASK-10: QA — Visual Test Editor

> **Phase:** 3 — QA Mode | **Priority:** P1 | **Effort:** 6 hours

## Objective

Build a drag-and-drop Visual Test Editor that allows QA testers to create and modify `.test.json` files without ever seeing raw JSON.

## Prerequisites

- TASK-09 complete (test files exist and can be listed)

## Acceptance Criteria

- [ ] Test steps displayed as a vertical timeline of action cards
- [ ] Each card has: Action type dropdown, Target field, Value field, Persona badge
- [ ] Drag-and-drop to reorder steps
- [ ] "Add Step" button inserts a new card at any position
- [ ] "Delete Step" removes a card with confirmation
- [ ] Real-time JSON preview panel (collapsible, for power users)
- [ ] "Save" button writes the updated `.test.json` to disk
- [ ] Schema validation: invalid steps show red border + error tooltip

## Supported Actions (from SFSpeckit JSON DSL)

| Action | Fields | Icon |
|--------|--------|------|
| `navigate` | url | 🌐 |
| `click` | target | 👆 |
| `fill` | target, value | ✏️ |
| `selectPicklist` | target, value | 📋 |
| `checkCheckbox` | target | ☑️ |
| `uploadFile` | target, filePath | 📎 |
| `assertToast` | expectedMessage | ✅ |
| `assertFieldValue` | target, expectedValue | 🔍 |
| `verifyDatabase` | soql, field, expected | 🗄️ |
| `wait` | duration | ⏳ |
| `screenshot` | name | 📸 |
| `scrollTo` | target | ⬇️ |

## Implementation Steps

### Step 1: Create `client/src/modes/QA/VisualTestEditor.jsx`
Main editor container:
- Loads `.test.json` from the backend
- Parses steps into an ordered array
- Renders the step timeline + JSON preview
- Manages drag-and-drop state

### Step 2: Create `client/src/modes/QA/StepCard.jsx`
Individual step card component:
- **Action dropdown:** Lists all supported DSL actions
- **Dynamic fields:** Changes based on selected action
  - `fill` → shows Target + Value inputs
  - `assertToast` → shows only Expected Message
  - `verifyDatabase` → shows SOQL + Field + Expected
- **Drag handle** on the left edge
- **Delete button** (trash icon) on the right
- **Validation indicator:** Green check (valid) or red X (invalid)

### Step 3: Create `client/src/modes/QA/JsonPreview.jsx`
- Collapsible right panel showing the live JSON output
- Syntax highlighted (using a lightweight highlighter)
- Read-only (editing happens through the visual cards)
- "Copy JSON" button for clipboard export

### Step 4: Create API Routes
```
GET  /api/qa/tests/:testId        → Read a specific .test.json file
PUT  /api/qa/tests/:testId        → Write updated .test.json file
POST /api/qa/tests/:testId/validate → Validate JSON against DSL schema
```

### Step 5: Implement Drag-and-Drop
- Use a lightweight library (e.g., `@dnd-kit/core`) for drag-and-drop
- Reorder updates the step array index
- Visual drop indicator shows where the step will land

## Files Created

| File | Action |
|------|--------|
| `client/src/modes/QA/VisualTestEditor.jsx` | NEW |
| `client/src/modes/QA/StepCard.jsx` | NEW |
| `client/src/modes/QA/JsonPreview.jsx` | NEW |
| `server/routes/qa-routes.js` | MODIFIED (add test CRUD routes) |

## Definition of Done

- [ ] Steps can be added, removed, reordered, and edited
- [ ] JSON preview updates in real-time as steps change
- [ ] Saved `.test.json` is valid and executable by the Playwright runner
- [ ] Invalid configurations show clear error messages
- [ ] Drag-and-drop works smoothly without layout jank
