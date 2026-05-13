# TASK-07: TPO — Clarification Center & Architecture Viewer

> **Phase:** 2 — TPO Mode | **Priority:** P1 | **Effort:** 8 hours

## Objective

Build the interactive Clarification Center (invoking `sfspeckit-clarify`) and the Architecture Viewer with Architect Sign-Off gate (invoking `sfspeckit-plan`).

## Prerequisites

- TASK-06 complete (Feature Dashboard exists, specs can be created)

## Backend Skills Used

| Skill | Purpose |
|-------|---------|
| `sfspeckit-clarify` | Gap analysis, 10-point checklist, org drift audit |
| `sfspeckit-plan` | Technical architecture, data model, deployment order |

## Acceptance Criteria

- [ ] Clarification Center shows all `[NEEDS CLARIFICATION]` markers as interactive cards
- [ ] TPO can answer questions directly in the UI; answers update `spec.md` via AI
- [ ] Org Drift scan runs `sf` CLI commands and displays results
- [ ] Architecture Viewer renders `data-model.md` as a Mermaid ERD
- [ ] Architect Sign-Off Gate has digital checkboxes that update `plan.md`
- [ ] Impact Analysis matrix shows blast radius with risk colors

## Implementation Steps

### Step 1: Create `client/src/modes/TPO/ClarificationCenter.jsx`
- Fetches `spec.md` content and parses `[NEEDS CLARIFICATION]` markers
- Each marker becomes a **Question Card** with:
  - Context (why it was flagged)
  - Input field for the TPO's answer
  - "Resolve" button → sends answer to gateway with `sfspeckit-clarify` skill
  - Visual status: Pending (amber) → Resolved (green)
- **Org Drift Panel:** Button to trigger CLI scan, results shown in a collapsible table
- **Sign-Off Section:** TPO name + date + "Approve Clarification" button

### Step 2: Create `client/src/modes/TPO/ArchitectureViewer.jsx`
- Fetches `plan.md` and `data-model.md`
- **ERD Diagram:** Renders Mermaid.js diagram from data model relationships
- **Deployment Order Timeline:** Visual 7-phase timeline from plan
- **Impact Analysis Matrix:** Table with risk levels (High=red, Medium=amber, Low=green)
- **Architect Sign-Off Gate:**
  - Checklist of review items (from `sfspeckit-review` checklist)
  - "Approve Plan" button → writes `[x] APPROVED` to `plan.md`
  - Gate blocks story generation until approved

### Step 3: Create `client/src/shared/MermaidRenderer.jsx`
- Wrapper component for rendering Mermaid diagrams
- Accepts raw Mermaid syntax as a prop
- Renders SVG with zoom/pan capabilities
- Dark-mode compatible theme

### Step 4: Create API Routes
```
POST /api/tpo/clarify
Body: { featureId, answers: [{ marker, answer }] }
Action: Load sfspeckit-clarify skill, send answers, update spec.md

POST /api/tpo/plan
Body: { featureId, techStackPrefs }
Action: Load sfspeckit-plan skill, generate plan.md + data-model.md

POST /api/tpo/plan/sign-off
Body: { featureId, architectName, approved: true }
Action: Update plan.md sign-off section

POST /api/tpo/clarify/drift-scan
Body: { featureId, orgAlias }
Action: Run sf metadata list + sf project deploy preview, return drift results
```

## Files Created

| File | Action |
|------|--------|
| `client/src/modes/TPO/ClarificationCenter.jsx` | NEW |
| `client/src/modes/TPO/ArchitectureViewer.jsx` | NEW |
| `client/src/shared/MermaidRenderer.jsx` | NEW |
| `server/routes/tpo-routes.js` | MODIFIED (add clarify + plan routes) |

## Definition of Done

- [ ] Clarification cards are interactive and resolve correctly
- [ ] Mermaid ERD renders accurately from data-model.md
- [ ] Architect sign-off gate blocks story generation when unchecked
- [ ] Drift scan results display in a readable table format
- [ ] All changes persist to the filesystem markdown files
