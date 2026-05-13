# TASK-02: Mode Switcher & Navigation

> **Phase:** 1 — Foundation | **Priority:** P0 | **Effort:** 4 hours

## Objective

Build the top-level Mode Switcher (TPO / QA toggle) and the sidebar navigation system that changes dynamically based on the active mode.

## Prerequisites

- TASK-01 complete (shell layout and design system exist)

## Acceptance Criteria

- [ ] A toggle in the header switches between "TPO" and "QA" mode
- [ ] Sidebar navigation items change based on the active mode
- [ ] Active nav item is visually highlighted
- [ ] Mode preference persists across page refreshes (localStorage)
- [ ] Smooth transition animation when switching modes

## TPO Mode Navigation Items

| Icon | Label | Route |
|------|-------|-------|
| 📋 | Features | `/tpo/features` |
| 🔍 | Clarification | `/tpo/clarify` |
| 🏗️ | Architecture | `/tpo/plan` |
| 📝 | Story Board | `/tpo/stories` |
| 🔄 | Change Request | `/tpo/change` |
| 📄 | Release Notes | `/tpo/release` |

## QA Mode Navigation Items

| Icon | Label | Route |
|------|-------|-------|
| 📊 | Dashboard | `/qa/dashboard` |
| 🧪 | Story Tests | `/qa/e2e-story` |
| 🔎 | Baseline Scan | `/qa/baseline` |
| ▶️ | Regression | `/qa/regression` |
| 🛠️ | UI Discovery | `/qa/discover` |
| ⭐ | Quality Score | `/qa/score` |

## Implementation Steps

### Step 1: Install React Router
```bash
cd studio/client && npm install react-router-dom
```

### Step 2: Create `ModeSwitcher.jsx`
- Pill-shaped toggle with "TPO" and "QA" labels
- Active mode has gradient background, inactive is transparent
- Click toggles the mode and updates localStorage
- Emits mode change to parent via callback

### Step 3: Create `Sidebar.jsx`
- Reads current mode from context
- Renders the appropriate nav items list
- Each item is a `NavLink` from react-router-dom
- Active item has left accent border and highlighted background
- Smooth slide-in animation on mode change

### Step 4: Create `AppRouter.jsx`
- Define routes for all TPO and QA screens
- Each route renders a placeholder page component
- 404 fallback redirects to the active mode's default route

### Step 5: Create `ModeContext.jsx`
- React Context for sharing the current mode across components
- Provider wraps the entire app
- Exposes `mode`, `setMode`, and `isTPO`/`isQA` helpers

## Files Created

| File | Action |
|------|--------|
| `client/src/shared/ModeSwitcher.jsx` | NEW |
| `client/src/shared/Sidebar.jsx` | NEW |
| `client/src/AppRouter.jsx` | NEW |
| `client/src/context/ModeContext.jsx` | NEW |
| `client/src/App.jsx` | MODIFIED (integrate router + mode) |

## Definition of Done

- [ ] Clicking "TPO" shows TPO nav items; clicking "QA" shows QA nav items
- [ ] Navigating to a route renders the correct placeholder page
- [ ] Refreshing the browser preserves the last selected mode
- [ ] No layout shift or flicker during mode switch
