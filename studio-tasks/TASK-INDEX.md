# SFSpeckit Studio — Task Index

> 14 Tasks | 4 Phases | ~80 hours estimated effort

---

## Dependency Graph

```
TASK-01 (Scaffold + Design) ⛔ BLOCKS ALL
├── TASK-02 (Mode Switcher + Nav)
├── TASK-03 (AI Gateway Client)
├── TASK-04 (Org + Git Integration)
└── TASK-05 (State Engine)
    │
    ├── TASK-06 (TPO: Feature Dashboard + Specify)  ── Phase 2
    │   └── TASK-07 (TPO: Clarify + Plan)
    │       └── TASK-08 (TPO: Stories + Change + Release)
    │
    ├── TASK-09 (QA: Dashboard + Test Generator)     ── Phase 3
    │   └── TASK-10 (QA: Visual Test Editor)
    │   └── TASK-11 (QA: Live Test Runner)
    │       └── TASK-12 (QA: RCA + Scoring)
    │
    └── TASK-13 (Shared: AI Chat Panel)              ── Phase 4
        └── TASK-14 (Polish: File Watcher + Electron)
```

---

## Phase 1: Foundation (Weeks 1–2)

| Task | Title | Effort | Status |
|------|-------|--------|--------|
| [TASK-01](./TASK-01_scaffold-and-design-system.md) | Scaffold Project & Design System | 8h | ⬜ TODO |
| [TASK-02](./TASK-02_mode-switcher-navigation.md) | Mode Switcher & Navigation | 4h | ⬜ TODO |
| [TASK-03](./TASK-03_ai-gateway-client.md) | Enterprise AI Gateway Client | 6h | ⬜ TODO |
| [TASK-04](./TASK-04_org-connection-git.md) | Salesforce Org & Git Integration | 6h | ⬜ TODO |
| [TASK-05](./TASK-05_state-engine.md) | Feature Lifecycle State Engine | 4h | ⬜ TODO |

**Phase 1 Total: 28 hours**

---

## Phase 2: TPO Mode (Weeks 3–4)

| Task | Title | Effort | Status |
|------|-------|--------|--------|
| [TASK-06](./TASK-06_tpo-feature-dashboard.md) | Feature Dashboard & Specify Wizard | 8h | ⬜ TODO |
| [TASK-07](./TASK-07_tpo-clarify-plan.md) | Clarification Center & Architecture Viewer | 8h | ⬜ TODO |
| [TASK-08](./TASK-08_tpo-stories-change-release.md) | Story Board, Change Request & Release Notes | 8h | ⬜ TODO |

**Phase 2 Total: 24 hours**

---

## Phase 3: QA Mode (Weeks 5–6)

| Task | Title | Effort | Status |
|------|-------|--------|--------|
| [TASK-09](./TASK-09_qa-dashboard-test-generator.md) | Test Dashboard & Story Test Generator | 8h | ⬜ TODO |
| [TASK-10](./TASK-10_qa-visual-test-editor.md) | Visual Test Editor (Drag & Drop) | 6h | ⬜ TODO |
| [TASK-11](./TASK-11_qa-live-test-runner.md) | Live Test Runner & Playwright Streaming | 6h | ⬜ TODO |
| [TASK-12](./TASK-12_qa-rca-scoring.md) | RCA Triage & Quality Scoring Dashboard | 6h | ⬜ TODO |

**Phase 3 Total: 26 hours**

---

## Phase 4: Polish & Enterprise (Weeks 7–8)

| Task | Title | Effort | Status |
|------|-------|--------|--------|
| [TASK-13](./TASK-13_shared-ai-chat-panel.md) | Shared AI Chat Panel (Cursor-like) | 6h | ⬜ TODO |
| [TASK-14](./TASK-14_filewatcher-audit-electron.md) | File Watcher, Audit Logging & Electron | 6h | ⬜ TODO |

**Phase 4 Total: 12 hours**

---

## Grand Total: ~90 hours across 8 weeks

## Skills Covered

| Skill | Task(s) | Mode |
|-------|---------|------|
| `sfspeckit-constitution` | TASK-06 | TPO |
| `sfspeckit-specify` | TASK-06 | TPO |
| `sfspeckit-clarify` | TASK-07 | TPO |
| `sfspeckit-plan` | TASK-07 | TPO |
| `sfspeckit-stories` | TASK-08 | TPO |
| `sfspeckit-review` | TASK-08 | TPO |
| `sfspeckit-change` | TASK-08 | TPO |
| `sfspeckit-release-notes` | TASK-08 | TPO |
| `sfspeckit-e2e-story` | TASK-09 | QA |
| `sfspeckit-e2e-baseline` | TASK-09 | QA |
| `sfspeckit-e2e-regression` | TASK-11 | QA |
| `sfspeckit-e2e-discover` | TASK-11 | QA |
| `sfspeckit-qa` | TASK-09, TASK-12 | QA |
| `sfspeckit-uat` | TASK-12 | QA |
| `sfspeckit-score` | TASK-12 | QA |
