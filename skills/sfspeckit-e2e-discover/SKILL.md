---
name: sfspeckit-e2e-discover
description: "Use Playwright MCP to repair broken Salesforce DOM selectors or map new UI components. Opens a browser, authenticates as a persona, captures the live DOM snapshot, identifies broken selectors, and updates the selectors file. Can also generate test scripts from QA's verbal description of what they see on screen."
---

# /sfspeckit-e2e-discover — UI Discovery & Selector Refresh

## Overview

When tests fail with TIMEOUT errors, it usually means the Salesforce DOM has changed (e.g., after a release or package update). This command opens a live browser, captures the current DOM structure, and updates the selector file so tests work again.

It also serves as the **Tooling API Spy Agent**, capable of traversing heavily customized UIs (like CPQ Quote Line Editor, Omnistudio, or Custom LWCs) to automatically generate bespoke Page Objects and register them into the JSON runner without manual coding.

Also used to **write new test scripts** by having the QA tester verbally describe what they see on screen while the AI maps the live DOM into JSON DSL steps.

## Who Runs This

**QA Tester** (non-technical). No coding required.

## Prerequisites

- Framework installed: `npm install` in `.agents/skills/sfspeckit-e2e/framework/`
- `personas.json` and `.env` configured
- Playwright MCP tools available (browser_navigate, browser_snapshot)

## Input

Natural language description of what to scan. Examples:

```
/sfspeckit-e2e-discover scan the Account record page
/sfspeckit-e2e-discover update selectors for the Case edit form
/sfspeckit-e2e-discover map the Conga Agreement page as Admin
/sfspeckit-e2e-discover generate a Page Object for the Smart Grid custom LWC using the Spy Agent
/sfspeckit-e2e-discover write a test for creating a new Opportunity — I'll describe the steps
```

## Execution Steps

### Step 1: Open Browser & Authenticate

Use Playwright MCP tools to:
1. Open a browser window
2. Authenticate as the requested persona (default: Admin) using JWT cookie injection
3. Navigate to the specified Salesforce page

The QA tester should see the browser open on their screen.

### Step 2: Capture DOM Snapshot

Use `browser_snapshot` to capture the current page structure. This provides:
- All visible elements with their roles and labels
- ARIA attributes for accessibility selectors
- Data attributes used by Lightning components
- Form field labels and input types

### Step 3: Identify Broken Selectors

Compare the captured DOM against the current selector file at:
`.agents/skills/sfspeckit-e2e/framework/utils/selectors.ts`

Look for:
- Selectors that no longer match any DOM element
- New UI components not yet mapped
- Changed attribute names or structures
- Package-specific (namespaced) components

### Step 4: Update Selectors

Update `selectors.ts` with corrected or new selectors. Follow these rules:
- Prefer `getByRole()` and `getByLabel()` (ARIA-based, most stable)
- Use `data-*` attributes as second choice
- Use CSS class selectors as last resort (most brittle)
- Add comments documenting which Salesforce component each selector targets

### Step 5: The Tooling API Spy Agent (For Complex Custom UIs)

If the user asks to map a **custom LWC, managed package, or complex UI** (where `selectors.ts` is insufficient):

1. **Invoke the Spy Agent** using the framework's generator script:
   Execute `npx ts-node ../sfspeckit-e2e/framework/generators/spy-agent.ts <RecordId_or_URL> <PageObjectName>` from within the `framework` directory.
2. **What the Agent Does Natively:**
   - It will automatically log into Salesforce and navigate to the page.
   - It will inject a recursive script to pierce all shadow DOM roots.
   - It will automatically generate `framework/page-objects/<PageObjectName>.ts` containing all actions.
   - It will automatically update `framework/executor/json-runner.spec.ts` to register the new actions (e.g., `"action": "SmartGridPage:fillDiscountPercentage"`).
3. **Notify the User:** Inform the user that the Page Object was generated and registered, and provide an example of how they can now use the new actions in their JSON tests.

### Step 6 (Optional): Generate Test Script from Verbal Description

If the QA tester says they want to "write a test" or "create a test script":

1. Ask the QA tester to describe what they want to test step by step
2. As they describe each step, map it to the live DOM elements visible in the snapshot
3. Generate a `.test.json` file using the JSON DSL actions
4. Save to `framework/tests/stories/<descriptive-name>.test.json`

> **CRITICAL**: Generate ONLY `.test.json` files. NEVER generate raw `.spec.ts` TypeScript.

## Selector Best Practices

| Priority | Selector Type | Example | Stability |
|----------|--------------|---------|-----------|
| 1st | Role-based | `getByRole('button', { name: 'Save' })` | ⭐⭐⭐ Most stable |
| 2nd | Label-based | `getByLabel('Account Name')` | ⭐⭐⭐ Most stable |
| 3rd | Data attribute | `[data-field-id="Name"]` | ⭐⭐ Stable |
| 4th | Component tag | `lightning-input-field` | ⭐⭐ Moderate |
| 5th | CSS class | `.slds-form-element` | ⭐ Brittle |

## Output

- **Updated Selectors**: `framework/utils/selectors.ts`
- **New Test File** (if requested): `framework/tests/stories/<name>.test.json`
- **Console Log**: Summary of selectors added/updated/removed
