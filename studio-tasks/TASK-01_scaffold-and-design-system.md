# TASK-01: Scaffold Studio Project & Design System

> **Phase:** 1 — Foundation | **Priority:** P0 (Blocks Everything) | **Effort:** 8 hours

## Objective

Initialize the `studio/` directory with a Vite (React 19) frontend and an Express backend. Create the premium dark-mode design system that all subsequent UI tasks will consume.

## Prerequisites

- Node.js 20+ installed
- `SFSpeckit/` directory exists in the repository

## Acceptance Criteria

- [ ] Running `npm run studio` from `SFSpeckit/` starts both the Express server (port 3001) and Vite dev server (port 3000)
- [ ] Browser opens to `http://localhost:3000` showing a shell layout with sidebar, main content, and right panel placeholders
- [ ] Dark mode is the default theme with premium aesthetics (gradients, glassmorphism, smooth transitions)
- [ ] Design tokens (colors, spacing, typography, shadows) are defined in `tokens.css`
- [ ] Base component styles (buttons, cards, inputs, badges, modals) are defined in `components.css`
- [ ] Google Font "Inter" is loaded for typography

## Implementation Steps

### Step 1: Initialize Vite + React Frontend
```bash
cd SFSpeckit/studio
npx -y create-vite@latest client --template react
cd client && npm install
```

### Step 2: Initialize Express Backend
```bash
cd SFSpeckit/studio
mkdir server
npm init -y
npm install express cors socket.io chokidar dotenv
```

### Step 3: Create `studio/package.json` (Root)
A root `package.json` with a `concurrently` script to start both servers:
```json
{
  "name": "sfspeckit-studio",
  "scripts": {
    "studio": "concurrently \"npm run server\" \"npm run client\"",
    "server": "node server/index.js",
    "client": "cd client && npm run dev"
  }
}
```

### Step 4: Create `server/index.js`
Minimal Express server:
- Serves on port 3001
- CORS enabled for `localhost:3000`
- Health check route: `GET /api/health`
- Socket.io attached for future WebSocket use

### Step 5: Create Design System — `client/src/design/tokens.css`
Define all CSS custom properties:
- **Colors:** Background (dark grays), surfaces (glassmorphism), accents (blue/purple gradients), status colors (green/amber/red)
- **Typography:** Inter font, 5 size scales (xs, sm, md, lg, xl)
- **Spacing:** 4px base unit scale (4, 8, 12, 16, 24, 32, 48, 64)
- **Shadows:** Subtle elevation shadows for cards and modals
- **Borders:** Radius tokens (sm: 6px, md: 10px, lg: 16px, full: 9999px)
- **Transitions:** Default ease timing (150ms, 200ms, 300ms)

### Step 6: Create Design System — `client/src/design/components.css`
Style base components:
- **Buttons:** Primary (gradient), secondary (outline), danger, ghost. Hover/active states with micro-animations.
- **Cards:** Glassmorphism background, subtle border, hover lift effect.
- **Inputs:** Dark-themed text inputs, textareas, selects with focus glow.
- **Badges:** Status badges (DRAFT, CLARIFIED, PLANNED, READY, ACTIVE, DONE) with color coding.
- **Modal:** Overlay with backdrop blur and centered card.

### Step 7: Create Shell Layout — `client/src/App.jsx`
The root layout with three panels:
- **Left Sidebar (240px):** Navigation placeholder
- **Main Content (flex-grow):** Content area placeholder
- **Right Panel (360px, collapsible):** AI Chat placeholder
- **Bottom Bar (collapsible):** Terminal output placeholder

## Files Created/Modified

| File | Action |
|------|--------|
| `studio/package.json` | NEW |
| `studio/server/index.js` | NEW |
| `studio/client/` | NEW (Vite scaffold) |
| `studio/client/src/design/tokens.css` | NEW |
| `studio/client/src/design/components.css` | NEW |
| `studio/client/src/App.jsx` | MODIFIED |
| `studio/client/src/App.css` | MODIFIED (layout) |
| `SFSpeckit/package.json` | MODIFIED (add `studio` script) |

## Definition of Done

- [ ] `npm run studio` starts without errors on Mac and Windows
- [ ] Shell layout renders with all three panels visible
- [ ] Dark mode looks premium (no default browser styling visible)
- [ ] All CSS tokens are documented with comments
- [ ] No `tailwind` or external CSS frameworks used
