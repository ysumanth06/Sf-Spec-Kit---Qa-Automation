# TASK-04: Salesforce Org Connection & Git Integration

> **Phase:** 1 — Foundation | **Priority:** P0 | **Effort:** 6 hours

## Objective

Build the backend providers for Salesforce CLI and Git CLI, plus the frontend Org Switcher and Git Controls components. These enable QA/TPO to connect orgs and sync code without a terminal.

## Prerequisites

- TASK-01 complete (Express server + shell layout)
- Salesforce CLI (`sf`) installed on the user's machine
- Git installed and repo initialized

## Acceptance Criteria

- [ ] "Connect Org" button triggers `sf org login web` and displays org info on success
- [ ] Org Switcher dropdown lists all authenticated orgs from `sf org list`
- [ ] "Pull Latest" button runs `git pull` and refreshes the file explorer
- [ ] "Commit & Push" accepts a message, runs `git add/commit/push`
- [ ] "Git Status" shows changed files with add/modify/delete icons
- [ ] All CLI output streams to the Terminal Output panel

## Implementation Steps

### Step 1: Create `server/sf-provider.js`
```javascript
// Core functions:
listOrgs()        // sf org list --json → parsed array
getOrgInfo(alias) // sf org display --target-org <alias> --json
connectOrg()      // sf org login web --set-default-org (spawns browser)
runQuery(alias, soql)  // sf data query --query <soql> --target-org <alias> --json
runTests(alias, classes) // sf apex run test --class-names <> --target-org <alias>
```

### Step 2: Create `server/git-provider.js`
```javascript
// Core functions:
getStatus()           // git status --porcelain → parsed file list
pull(branch)          // git pull origin <branch>
commitAndPush(msg)    // git add . && git commit -m <msg> && git push
listBranches()        // git branch --list
switchBranch(name)    // git checkout <name>
createBranch(name)    // git checkout -b <name>
getRecentLog(n)       // git log --oneline -<n>
hasConflicts()        // Detects merge conflict markers
```

### Step 3: Create API Routes
```
GET    /api/orgs              → sf-provider.listOrgs()
GET    /api/orgs/:alias/info  → sf-provider.getOrgInfo()
POST   /api/orgs/connect      → sf-provider.connectOrg()
GET    /api/git/status        → git-provider.getStatus()
POST   /api/git/pull          → git-provider.pull()
POST   /api/git/commit        → git-provider.commitAndPush()
GET    /api/git/branches      → git-provider.listBranches()
POST   /api/git/switch        → git-provider.switchBranch()
```

### Step 4: Create `client/src/shared/OrgSwitcher.jsx`
- Dropdown showing connected orgs (alias + username)
- "Connect New Org" button at the bottom
- Selected org stored in context and sent with every API call
- Org info tooltip (Edition, API Version, Instance URL)

### Step 5: Create `client/src/shared/GitControls.jsx`
- **Status indicator:** Green dot (clean) / Orange dot (changes) / Red dot (conflicts)
- **Pull button:** Runs git pull, shows toast on success
- **Commit panel:** Text input for commit message + "Commit & Push" button
- **Branch selector:** Dropdown of local branches
- **Changed files list:** Expandable panel showing modified files

### Step 6: Create `client/src/shared/TerminalOutput.jsx`
- Collapsible bottom panel showing live CLI output
- WebSocket connection to `ws://localhost:3001/ws/logs`
- Auto-scrolls to bottom on new output
- Color-coded: stdout (white), stderr (red), info (blue)
- "Clear" button to reset the log

## Files Created

| File | Action |
|------|--------|
| `studio/server/sf-provider.js` | NEW |
| `studio/server/git-provider.js` | NEW |
| `studio/server/routes/org-routes.js` | NEW |
| `studio/server/routes/git-routes.js` | NEW |
| `studio/client/src/shared/OrgSwitcher.jsx` | NEW |
| `studio/client/src/shared/GitControls.jsx` | NEW |
| `studio/client/src/shared/TerminalOutput.jsx` | NEW |

## Definition of Done

- [ ] Connected org info displays correctly in the header
- [ ] Git pull/push operations work and output streams to the terminal
- [ ] Changed files are accurately listed
- [ ] Errors from `sf` or `git` CLI are caught and shown as toast notifications
- [ ] No hardcoded paths or credentials in any file
