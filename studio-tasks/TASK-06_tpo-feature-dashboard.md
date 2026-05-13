# TASK-06: TPO — Feature Dashboard & Specification Wizard

> **Phase:** 2 — TPO Mode | **Priority:** P1 | **Effort:** 8 hours

## Objective

Build the TPO Feature Dashboard (landing screen) and the Specification Wizard that invokes `sfspeckit-specify` through the AI Gateway.

## Prerequisites

- TASK-01 through TASK-05 complete (shell, navigation, gateway, state engine)

## Backend Skills Used

| Skill | Purpose |
|-------|---------|
| `sfspeckit-constitution` | Read project principles for context |
| `sfspeckit-specify` | Generate `spec.md` from user requirements |

## Acceptance Criteria

- [ ] Feature Dashboard shows all features as cards with lifecycle status badges
- [ ] "New Feature" button opens the Specification Wizard
- [ ] Wizard has a multi-step form: Name → Personas → User Stories → Platform Context
- [ ] AI Chat sidebar can assist with each wizard step
- [ ] On completion, wizard sends data to gateway (using `sfspeckit-specify` skill) and saves `spec.md`
- [ ] New feature appears on the dashboard with "DRAFT" badge

## Implementation Steps

### Step 1: Create `client/src/modes/TPO/FeatureDashboard.jsx`
- Fetches features from `GET /api/features`
- Renders a grid of feature cards
- Each card shows: Feature name, state badge, story count, last modified
- "New Feature +" button in the top-right corner
- Click a card → navigates to the feature detail view

### Step 2: Create `client/src/modes/TPO/SpecifyWizard.jsx`
Multi-step form (4 steps):

**Step 1 — Basics:**
- Feature Name (text input)
- Feature Description (textarea)
- Target Org Type (radio: Production / Sandbox / Scratch)

**Step 2 — Personas:**
- Add personas with name + role (e.g., "Sales Rep", "Admin")
- Each persona gets a "What do they need?" textarea

**Step 3 — User Stories:**
- For each persona, generate "As a [persona], I want to [action], so that [benefit]"
- AI Chat can suggest stories based on the description
- Priority selector (P1 / P2 / P3) for each story

**Step 4 — Platform Context:**
- Automation preference (Flow-first / Apex-first / Mixed)
- Data volume estimates (dropdown: <1K, 1K-100K, 100K-1M, 1M+)
- Security model (OWD: Private / Public Read / Public Read-Write)

### Step 3: Create `server/routes/tpo-routes.js`
```
POST /api/tpo/specify
Body: { featureName, description, personas, userStories, platformContext }
Action:
  1. Load sfspeckit-specify SKILL.md as system prompt
  2. Build context (constitution.md + sfdx-project.json)
  3. Format user input as the "feature description"
  4. Send to AI Gateway
  5. Write AI response to sfspeckit-data/specs/NNN-feature/spec.md
  6. Return { featureId, specPath }
```

### Step 4: Create Feature Directory Logic
When a new spec is created:
1. Scan `sfspeckit-data/specs/` for the next available number (e.g., `002`)
2. Create slug from feature name (lowercase, hyphens)
3. Create directory: `sfspeckit-data/specs/002-feature-slug/`
4. Write `spec.md` to the new directory

## Files Created

| File | Action |
|------|--------|
| `client/src/modes/TPO/FeatureDashboard.jsx` | NEW |
| `client/src/modes/TPO/SpecifyWizard.jsx` | NEW |
| `client/src/modes/TPO/FeatureCard.jsx` | NEW |
| `server/routes/tpo-routes.js` | NEW |

## Definition of Done

- [ ] Dashboard renders features with correct state badges
- [ ] Wizard collects all inputs and generates a valid `spec.md`
- [ ] AI Chat assists with user story generation during the wizard
- [ ] New feature directory is created in the correct location
- [ ] Empty state ("No features yet") is handled gracefully
