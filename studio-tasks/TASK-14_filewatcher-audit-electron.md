# TASK-14: File Watcher, Audit Logging & Electron Packaging

> **Phase:** 4 — Polish & Enterprise | **Priority:** P2 | **Effort:** 6 hours

## Objective

Build the real-time file watcher for automatic UI updates, the compliance audit logger, and the optional Electron desktop packaging for a "double-click to launch" experience.

## Prerequisites

- All previous tasks complete (full Studio functional)

## Acceptance Criteria

- [ ] UI auto-refreshes when files change on disk (e.g., developer pushes a new story)
- [ ] Every AI interaction is logged to `studio/logs/ai-audit.jsonl`
- [ ] Logs include: timestamp, user, mode, skill, token counts, feature
- [ ] (Optional) Electron wrapper packages the app as `.dmg` (Mac) and `.exe` (Windows)
- [ ] Settings page allows configuring Gateway URL and default org

## Implementation Steps

### Step 1: Create `server/file-watcher.js`
Uses `chokidar` to monitor directories:
```javascript
// Watched paths:
//   sfspeckit-data/specs/  → TPO artifacts
//   tests/                 → QA test files
//   .agents/skills/        → Skill definitions (rare changes)

// Events emitted via WebSocket:
//   file:created  → { path, type: "story" | "test" | "spec" }
//   file:modified → { path, type }
//   file:deleted  → { path, type }
```
- Frontend listens on `ws://localhost:3001/ws/files`
- On `file:created` or `file:modified`: relevant components re-fetch data
- Debounce: 500ms to avoid rapid-fire events during git operations

### Step 2: Enhance `server/audit-logger.js`
Ensure every API call that touches the AI Gateway is logged:
- **Format:** JSONL (one JSON object per line, append-only)
- **Location:** `studio/logs/ai-audit.jsonl`
- **Rotation:** New file per day (`ai-audit-2026-05-13.jsonl`)
- **Fields:** timestamp, mode (TPO/QA), skill, featureId, promptTokens, completionTokens, durationMs, success/error
- **Gitignore:** `studio/logs/` is added to `.gitignore`

### Step 3: Create `client/src/shared/Settings.jsx`
Settings page accessible from the gear icon in the header:
- **Gateway URL:** Text input (pre-populated from `.env`)
- **Default Org:** Dropdown of connected orgs
- **Default Branch:** Text input (default: `main`)
- **Theme:** Toggle (Dark / Light — future)
- **"Save Settings" Button:** Writes to `studio/.env` or `studio/config.json`

### Step 4: (Optional) Electron Wrapper
If the team wants a desktop app:
```bash
npm install --save-dev electron electron-builder
```
- `studio/electron/main.js`: Electron main process
  - Starts the Express server as a child process
  - Opens a BrowserWindow pointing to `http://localhost:3000`
  - Tray icon with "Quit" option
- Build scripts:
  - `npm run build:mac` → `.dmg` file
  - `npm run build:win` → `.exe` file

## Files Created

| File | Action |
|------|--------|
| `studio/server/file-watcher.js` | NEW |
| `studio/server/audit-logger.js` | MODIFIED (add rotation + fields) |
| `studio/client/src/shared/Settings.jsx` | NEW |
| `studio/electron/main.js` | NEW (optional) |
| `studio/.gitignore` | MODIFIED (add logs/) |

## Definition of Done

- [ ] Modifying a file on disk causes the UI to refresh within 1 second
- [ ] Audit log file is created and appended to correctly
- [ ] Settings page saves and loads configuration
- [ ] (If Electron) Double-clicking the app launches the Studio without terminal
- [ ] File watcher does not cause performance issues (debounced correctly)
