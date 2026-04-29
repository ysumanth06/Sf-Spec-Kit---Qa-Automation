---
name: sfspeckit-e2e
description: "Standard Agentforce E2E testing framework home. Contains the shared Playwright framework, JSON runner engine, selectors, page objects, and utilities. For direct usage, invoke one of the 4 dedicated mode skills: sfspeckit-e2e-story, sfspeckit-e2e-baseline, sfspeckit-e2e-regression, or sfspeckit-e2e-discover."
---

# /sfspeckit-e2e — Salesforce E2E Framework Home

## Overview

This is the **shared framework home** for the SFSpeckit E2E testing system. It contains the Playwright engine, page objects, selectors, utilities, and JSON DSL schema that all 4 E2E skills share.

> **CRITICAL RULE**: You must NEVER generate raw `.spec.ts` Playwright files. ALL test output MUST be structured JSON DSL files (`.test.json`). The static `json-runner.spec.ts` engine executes these files.

---

## ⚠️ If You Are Here Directly

If the user invoked `/sfspeckit-e2e` without specifying a mode, **ask them which mode they need**:

> "The E2E framework has 4 modes. Which one would you like to run?
>
> 1. **`/sfspeckit-e2e-story`** — Test a specific developer story (e.g., TS-01, TS-04)
> 2. **`/sfspeckit-e2e-baseline`** — Generate baseline regression tests from org metadata
> 3. **`/sfspeckit-e2e-regression`** — Run ALL existing tests across all personas
> 4. **`/sfspeckit-e2e-discover`** — Fix broken selectors or write new tests from live DOM"

Do NOT attempt to execute any mode. Wait for the user to choose, then read the corresponding skill's SKILL.md.

---

## Slash Commands

| Slash Command | Purpose |
|--------------|---------|
| `/sfspeckit-e2e-story` | Parse a story → generate JSON tests → execute → report |
| `/sfspeckit-e2e-baseline` | Scan org metadata → generate baseline regression tests |
| `/sfspeckit-e2e-regression` | Run ALL tests across ALL personas → RCA report |
| `/sfspeckit-e2e-discover` | Live DOM scan → fix selectors → optional test scripting |

---

## Prerequisites (Shared)

- Node.js v18+ and Google Chrome installed
- `npm install` completed in `.agents/skills/sfspeckit-e2e/framework/`
- `personas.json` configured with Salesforce test users
- `.env` configured with JWT credentials or `E2E_ADMIN_ALIAS`
- `npm run qa:doctor` passes all checks

---

## JSON DSL Schema (Shared Reference)

All 4 skills generate tests conforming to this exact schema. The sub-skills reference this section.

```json
{
  "name": "Story TS-01: Verify Provider Status Update",
  "storyId": "task_story_01",
  "personas": ["Admin", "Standard Rep"],
  "setup": {
    "dataFactory": [
      {
        "variable": "@accountId",
        "object": "Account",
        "fields": { "Name": "QA-Test Account" }
      }
    ],
    "apex": "// Optional: Anonymous Apex for complex setup"
  },
  "tests": [
    {
      "id": "TC-001",
      "title": "Admin can update Provider Status to Active",
      "persona": "Admin",
      "tags": ["positive", "AC-1"],
      "steps": [
        { "action": "openRecord", "object": "Account", "recordId": "@accountId" },
        { "action": "clickEdit" },
        { "action": "selectPicklist", "target": "Provider Status", "value": "Active" },
        { "action": "clickSave" },
        { "action": "assertToast", "contains": "was saved" },
        {
          "action": "verifyDatabase",
          "query": "SELECT Provider_Status__c FROM Account WHERE Id = '@accountId'",
          "expect": { "Provider_Status__c": "Active" }
        }
      ]
    }
  ]
}
```

### Supported Actions

| Action | Parameters | Description |
|--------|-----------|-------------|
| `openRecord` | `object`, `recordId` | Navigate to a record detail page |
| `openNewRecord` | `object`, `recordTypeId?` | Open the new record form |
| `openObjectHome` | `object` | Navigate to object list view |
| `launchFlow` | `flowApiName` | Open a Screen Flow |
| `switchApp` | `appName` | Switch app via App Launcher |
| `openTab` | `tabName` | Click a navigation tab |
| `switchTab` | `tabTitle` | Switch workspace tabs (Console) |
| `clickEdit` | — | Click the Edit button on a record |
| `clickSave` | — | Click the Save button |
| `clickCancel` | — | Click the Cancel button |
| `clickDelete` | — | Click Delete from actions menu |
| `clickButton` | `target` | Click any button by visible label |
| `clickAction` | `target` | Click a quick action menu item |
| `selectRecordType` | `recordTypeName` | Select record type in picker dialog |
| `fill` | `target`, `value` | Fill a text/number input field |
| `selectPicklist` | `target`, `value` | Select a picklist option |
| `selectMultiPicklist` | `target`, `values` | Select multi-picklist values (array) |
| `fillLookup` | `target`, `searchTerm` | Search and select a lookup value |
| `fillDate` | `target`, `value` | Fill a date field |
| `fillRichText` | `target`, `value` | Fill a rich text editor |
| `setCheckbox` | `target`, `checked` | Check or uncheck a checkbox |
| `uploadFile` | `filePath` | Upload a file via file input |
| `dragAndDrop` | `sourceSelector`, `targetSelector` | Drag element to target |
| `scrollTo` | `selector?`, `direction?`, `pixels?` | Scroll to element or direction |
| `assertToast` | `contains` | Assert toast message text |
| `assertFieldValue` | `target`, `expected` | Assert a field shows a specific value |
| `assertFieldVisible` | `target`, `visible` | Assert field visibility (true/false) |
| `assertFieldEditable` | `target`, `editable` | Assert field editability (no side effects) |
| `assertFieldRequired` | `target`, `required` | Assert field is required |
| `assertErrorMessage` | `contains` | Assert a page/field error message |
| `assertUrl` | `contains` | Assert current URL contains text |
| `assertRowCount` | `target?`, `expected?`, `min?`, `max?` | Assert datatable row count |
| `assertListViewRow` | `searchColumn`, `searchValue` | Assert row exists in list view |
| `assertVisualSnapshot` | `name`, `fullPage?`, `maxDiffRatio?` | Visual regression screenshot comparison |
| `verifyDatabase` | `query`, `expect` | Execute SOQL and assert DB state |
| `wait` | `ms` | Wait for a specified duration |
| `screenshot` | `name` | Capture a screenshot |
| `flowNext` | — | Click Next in a Screen Flow |
| `flowPrevious` | — | Click Previous in a Screen Flow |
| `flowFinish` | — | Click Finish in a Screen Flow |

> **Step Retry**: Actions like `selectPicklist`, `fillLookup`, `assertToast`, and navigation actions automatically retry with exponential backoff. Override with a `"retries"` field per step.

> If you need an action not listed above, do NOT invent it. Instead, use the closest available action and add a `"_comment"` field explaining what the ideal action would be. The framework will throw `FRAMEWORK_LIMITATION` for truly unknown actions, which is the correct behavior.

---

## Scoring Gate (Shared Reference)

Generated JSON tests are scored against the rubric in `scoring-rubric.md`. The minimum passing score is **120/150**.

Read `.agents/skills/sfspeckit-e2e/scoring-rubric.md` and self-score the generated tests before presenting results.

---

## Framework Directory Structure

```
framework/
├── .env.example               ← Environment template
├── domains.json               ← Domain clusters for baseline scoping
├── personas.example.json      ← Persona template
├── playwright.config.ts       ← Playwright config (parallel, visual regression)
├── package.json               ← Dependencies
├── snapshots/                 ← Visual regression baseline screenshots
├── executor/
│   └── json-runner.spec.ts    ← THE ENGINE — DO NOT MODIFY
├── generators/
│   ├── story-parser.ts        ← Story markdown parser
│   ├── json-test-generator.ts ← JSON DSL test generator
│   └── baseline-scanner.ts    ← Baseline regression scanner
├── page-objects/
│   ├── RecordPage.ts          ← Record page interactions (30 methods + retry)
│   ├── ScreenFlow.ts          ← Screen flow interactions (20 methods)
│   ├── ListView.ts            ← List view search, sort, select, mass actions
│   ├── AppLauncher.ts         ← App switching, navigation, global search
│   ├── ConsoleLayout.ts       ← Workspace tabs, utility bar, split view
│   ├── CommunityPage.ts       ← Experience Cloud login, navigation, forms
│   └── ReportPage.ts          ← Reports, dashboards, filters, totals
├── reporters/
│   └── rca-excel-reporter.ts  ← Excel RCA triage reporter
├── tests/
│   ├── baseline/              ← Generated baseline tests
│   └── stories/               ← Generated story tests
└── utils/
    ├── auth.ts                ← JWT + cookie authentication
    ├── cleanup.ts             ← QA data cleanup CLI
    ├── doctor.ts              ← Environment health check CLI
    ├── failure-analyzer.ts    ← RCA classification (12 categories)
    ├── global-teardown.ts     ← Playwright global teardown (auto-cleanup)
    ├── internal-metadata-scanner.ts ← Org metadata scanner
    ├── internal-soql-verifier.ts    ← Database verification
    ├── popup-handler.ts       ← Session/tour/consent dismissal
    ├── selectors.ts           ← Salesforce Lightning + Dynamic Forms selectors
    ├── sf-helpers.ts          ← Network interception + worker-aware QA prefix
    └── test-data.ts           ← Test record lifecycle (SOQL-injection safe)
```

## Notes

- The JSON runner (`json-runner.spec.ts`) is a static, human-written engine. Do NOT modify it.
- All test data records MUST be prefixed with the `QA_PREFIX` from `.env` for cleanup.
- The `verifyDatabase` action uses `sf data query` CLI under the hood.
- For managed package UIs (Conga, CPQ), use `/sfspeckit-e2e-discover` first to map selectors before writing story tests.
