---
name: sfspeckit-e2e-story
description: "Generate and run E2E tests for a specific SFSpeckit developer story. Parses the story file, extracts acceptance criteria and security matrix, generates JSON DSL test files, executes them via Playwright across all personas, and produces a results report with RCA breakdown."
---

# /sfspeckit-e2e-story — Story E2E Testing

## Overview

Parse an SFSpeckit developer story file and generate + execute E2E browser tests for it. This is the primary QA workflow: you give it a story, it tests every Acceptance Criterion across every persona.

## Who Runs This

**QA Tester** (non-technical). No coding required.

## Prerequisites

- Framework installed: `npm install` in `.agents/skills/sfspeckit-e2e/framework/`
- `personas.json` and `.env` configured
- `npm run qa:doctor` passes all checks

## Input

Path to a story file. Examples:
- `/sfspeckit-e2e-story sfspeckit-data/specs/001-smart-grid/task_story_01.md`
- `/sfspeckit-e2e-story TS-04`

## Execution Steps

### Step 1: Parse the Story

Read the story markdown file and extract:
- **ALL** Given/When/Then Acceptance Criteria
- The **Security & Access Matrix** (which personas to test)
- Test cases (Positive, Negative, Bulk)
- Implementation layers (objects, fields, flows, Apex classes, LWC components)

Use the story parser at: `.agents/skills/sfspeckit-e2e/framework/generators/story-parser.ts`

### Step 2: Scan Org Metadata

Use the internal metadata scanner to query the Salesforce org for objects referenced in the story:
- Field-Level Security (FLS) per profile
- Active Validation Rules and their error messages
- Picklist values (active, default, dependent)
- Record Types

Scanner location: `.agents/skills/sfspeckit-e2e/framework/utils/internal-metadata-scanner.ts`

### Step 3: Generate JSON DSL Test File

> **CRITICAL**: Generate ONLY `.test.json` files. NEVER generate raw `.spec.ts` TypeScript.

Use the JSON test generator at: `.agents/skills/sfspeckit-e2e/framework/generators/json-test-generator.ts`

For **EACH** Acceptance Criterion:
- Generate a positive test per persona with ALLOW access
- Generate a negative test per persona with DENY access
- Include `verifyDatabase` steps to prove UI saves match DB state

> **CRITICAL RULE (DATA ISOLATION)**: Ensure generated test data (e.g., in `dataFactory` or `fill` steps) uses `{{QA_PREFIX}}` and dynamic timestamps `{{@timestamp}}` to guarantee tests are isolated and won't fail with `UNABLE_TO_LOCK_ROW` during parallel execution. Never hardcode static names for unique records.

For **metadata-enriched** tests:
- Test each Validation Rule triggers with invalid data
- Test picklist values are selectable
- Test FLS visibility per persona

Save output to: `framework/tests/stories/<story-id>.test.json`

### Step 4: Execute Tests

Run from the framework directory (`.agents/skills/sfspeckit-e2e/framework/`):

```bash
npx playwright test executor/json-runner.spec.ts
```

For a specific persona only:
```bash
npx playwright test executor/json-runner.spec.ts --project "Admin"
```

### Step 5: Generate Results Report

Read the template at `.agents/skills/sfspeckit-e2e/e2e-results-template.md` and populate:
- Pass/fail counts per persona
- AC traceability (which AC passed/failed)
- Failed test details with RCA categories
- Database verification results

Save to: `sfspeckit-data/specs/NNN-feature/task_story_NN_e2e_results.md`

## Scoring Gate

Self-score the generated JSON tests against `.agents/skills/sfspeckit-e2e/scoring-rubric.md`.
Minimum passing score: **120/150**.

## JSON DSL Reference

All tests must use ONLY the supported action verbs. Read the full schema and action table in:
`.agents/skills/sfspeckit-e2e/SKILL.md` → "JSON DSL Schema" section.

## Output

- **JSON Test File**: `framework/tests/stories/<story-id>.test.json`
- **Results Report**: `sfspeckit-data/specs/NNN-feature/task_story_NN_e2e_results.md`
- **RCA Excel**: `framework/reports/Test_Results_RCA.xlsx`
