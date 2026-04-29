# SFSpeckit E2E Testing Framework: Technical Architecture & User Guide

## 1. Executive Summary

The **SFSpeckit E2E** framework is a standalone, AI-driven, enterprise-grade Salesforce testing automation tool built on top of Playwright. It was designed from the ground up to solve the specific, notorious challenges of testing Salesforce UIs—such as Shadow DOM constraints in Lightning Web Components (LWCs), dynamic loading spinners, nested iframes, unpredictable popups, and complex data setups.

Unlike traditional testing frameworks that require developers to write fragile scripts, SFSpeckit uses an **AI-driven JSON Domain Specific Language (DSL)**. QA testers provide natural language or Markdown stories, the AI generates a structured JSON execution plan, and a static Playwright execution engine runs the test. This completely eliminates the risk of AI hallucinating raw execution code while bringing unprecedented speed to test authoring.

## 2. Core Architectural Defenses & Solutions

We built specific architectural defenses to handle the complexity of Salesforce. Here is why we made these choices and the exact problems they solve:

### Defense 1: The JSON Action Engine (Stability over Hallucinations)
*   **The Problem:** Asking an AI to write raw Playwright code (`await page.locator(...).click()`) often results in syntax errors, missing `await` statements, or hallucinated methods that don't exist.
*   **The Solution:** The AI writes a strict JSON format (e.g., `{"action": "clickSave"}`). A static, human-written Playwright engine (`json-runner.spec.ts`) reads this JSON and safely executes it.
*   **What it solves:** Test execution is 100% deterministic. The AI handles the "what to test" (logic), and the hardened engine handles the "how to click it" (execution).

**Visual Comparison:**
*Instead of AI generating fragile code like this:*
```typescript
// AI Hallucination Risk
await page.locator('lightning-input[data-name="Amount"]').fill('500');
await page.locator('button[title="Save"]').click();
```
*The AI generates a strict, safe JSON DSL:*
```json
// Safe, Deterministic JSON DSL
"steps": [
  { "action": "fill", "target": "Amount", "value": "500" },
  { "action": "clickSave" }
]
```

### Defense 2: Auto-Navigation & "Chaos" Handlers
*   **The Problem:** Salesforce UIs are chaotic. Fields might be hidden under unexpanded accordions, or random popups (Guidance Center, surveys, "Lightning updates") appear and block clicks.
*   **The Solution:** 
    *   *Auto-Navigation:* The framework actively hunts for fields by clicking unselected tabs and expanding accordions before failing. 
    *   *Chaos Handler:* A live `MutationObserver` (`popup-handler.ts`) is injected into the browser. The millisecond a Salesforce popup touches the DOM, the observer swats it away or dismisses it without disrupting the test.

### Defense 3: Next-Gen Shadow-DOM Piercing Locators
*   **The Problem:** Salesforce SLDS classes change frequently, and LWCs hide elements inside impenetrable Shadow DOMs.
*   **The Solution:** A `DynamicLocatorEngine` utilizes Playwright’s native shadow-DOM piercing via ARIA labels (`getByLabel`) and visual proximity. This ensures cross-release compatibility and robust Custom LWC testing.

### Defense 4: The Iframe Context Engine
*   **The Problem:** Salesforce mixes modern Lightning UI with legacy Visualforce, Canvas apps, and Setup iframes. Playwright traditionally goes blind inside iframes.
*   **The Solution:** The `IframeEngine` recursively and silently hunts through `page.frames()`. QA testers can interact with fields buried in iframes without ever manually specifying frame locators.

### Defense 5: Tooling API "Spy" Agent
*   **The Problem:** Custom LWCs and Managed Packages have unpredictable UIs. Writing page objects for them is a slow, manual engineering task.
*   **The Solution:** An autonomous Playwright MCP agent logs into the UI, recursively pierces the DOM, extracts interactive elements, and *automatically writes a bespoke TypeScript Page Object*. 

### Defense 6: Data Pollution Prevention (The Clean Org Guarantee)
*   **The Problem:** E2E testing frameworks quickly pollute testing environments with junk records ("Test Account 1", "asdasd"), making the org unusable for manual QA.
*   **The Solution:** The framework uses an abstracted Data Factory (`dataPlan`). Every single record created by the framework is automatically prefixed with a `QA_PREFIX` (e.g., `QA-W0-`). A built-in cleanup utility (`npm run qa:cleanup`) automatically tracks and hard-deletes all generated data immediately after the test suite finishes—even if a test crashes mid-run.

### Defense 7: Native Visual Regression Testing
*   **The Problem:** CSS and styling regressions (like a button moving 10 pixels to the left, or a font color changing) are impossible to catch with standard click-and-assert testing.
*   **The Solution:** The framework integrates Playwright's native visual regression testing. It takes a pixel-perfect screenshot of the component and compares it to a baseline image. If the UI changes visually beyond an acceptable threshold, the test fails automatically.

---

## 3. Head-to-Head: SFSpeckit vs. Provar

How does SFSpeckit E2E compare to the industry standard, Provar?

| Feature / Dimension | SFSpeckit E2E | Provar | Winner |
| :--- | :--- | :--- | :--- |
| **Setup Time** | ~30 minutes | 2 - 4 hours | 🏆 SFSpeckit |
| **Cost** | **$0 (Open Source)** | $3,000 - $8,000 / seat / year | 🏆 SFSpeckit |
| **Test Authoring** | AI + JSON DSL (Instant) | Record & Playback (Manual) | 🏆 SFSpeckit |
| **Data Management** | Data Tree Import + CSV | CSV / Excel Data Mapping | 🏆 SFSpeckit |
| **Visual Regression** | Native (Free via Playwright) | Paid Add-on | 🏆 SFSpeckit |
| **CI/CD Integration**| Native Playwright (Fast) | Provar CLI (Heavy / Clunky) | 🏆 SFSpeckit |
| **Salesforce Coverage**| 100% (Spy Agent + Iframe Engine) | 100% (Full platform) | 🤝 Tie |
| **Parallel Execution** | True Data Isolation via Workers | Built-in | 🤝 Tie |
| **Reporting** | RCA Excel + HTML | Enterprise Jira Integration | 🏆 Provar |

**Bottom Line:** SFSpeckit E2E matches Provar in stability and platform coverage, while drastically outperforming it in speed, test authoring experience, cost, and CI/CD simplicity.

---

## 4. Initial Setup & Dependencies

Setting up SFSpeckit E2E is designed to be straightforward for both Developers and QA.

### Prerequisites
1. **Node.js**: Version 18 or higher.
2. **Google Chrome**: Installed locally.
3. **Salesforce CLI (`sf`)**: Installed and authenticated to your org.

### Step-by-Step Instructions

**Step 1: Install Dependencies**
Open your terminal, navigate to the framework directory, and install the Node packages:
```bash
cd .agents/skills/sfspeckit-e2e/framework/
npm install
```

**Step 2: Install Playwright Browsers**
Download the necessary browser binaries used by Playwright:
```bash
npx playwright install chromium
```

**Step 3: Environment Configuration**
Copy the `.env.example` file to create a `.env` file. You will need your Salesforce Admin to provide the Server-to-Server JWT integration details.
```env
SF_USERNAME=qa-automation@yourdomain.com
SF_CLIENT_ID=your_connected_app_client_id
SF_LOGIN_URL=https://test.salesforce.com
SF_JWT_KEY_FILE=./certs/server.key
```

**Step 4: Define Personas and Domains**
*   **`personas.json`**: Define the different user profiles the tests will log in as (e.g., Sales Rep, Support Agent).
*   **`domains.json`**: Define QA test clusters (e.g., grouping `Account`, `Opportunity`, and `Quote` under "Sales").

**Step 5: Run the Health Check**
Run the internal doctor utility to ensure everything is configured correctly:
```bash
npm run qa:doctor
```
*If all checks pass, you are ready to start testing!*

---

## 5. Full Repository Structure & File Dictionary

The framework is cleanly encapsulated inside `.agents/skills/sfspeckit-e2e/`.

### Directory Tree
```text
.agents/skills/sfspeckit-e2e/
├── SKILL.md                              # AI Instructions: Defines modes and the JSON DSL schema.
├── scoring-rubric.md                     # 150-point quality gate for test evaluation.
├── e2e-results-template.md               # Standard template for AI-generated test reports.
└── framework/
    ├── .env                              # Environment variables (Credentials).
    ├── domains.json                      # Custom object clusters (e.g., Sales, Service).
    ├── personas.json                     # Test user definitions for role-based testing.
    ├── playwright.config.ts              # Playwright configuration (Parallelism, Retries).
    ├── package.json                      # Node dependencies.
    ├── executor/
    │   └── json-runner.spec.ts           # THE ENGINE: Translates JSON tests into Playwright browser clicks.
    ├── generators/
    │   ├── story-parser.ts               # Parses SFSpeckit Markdown stories into Acceptance Criteria.
    │   ├── json-test-generator.ts        # AI script that converts criteria into the JSON DSL.
    │   └── baseline-scanner.ts           # Scans Salesforce metadata to build a regression baseline.
    ├── page-objects/
    │   ├── RecordPage.ts                 # Methods for interacting with Standard Salesforce Record pages.
    │   └── ScreenFlow.ts                 # Methods for navigating and asserting Salesforce Screen Flows.
    ├── reporters/
    │   └── rca-excel-reporter.ts         # Generates an Excel triage report with categorized failures.
    ├── tests/                            # Automatically generated JSON tests are saved here.
    │   ├── baseline/                     
    │   └── stories/                      
    └── utils/
        ├── auth.ts                       # Handles secure JWT authentication and cookie session bypass.
        ├── cleanup.ts                    # CLI tool to securely delete test data after runs.
        ├── data-factory.ts               # Hooks into `sf data tree` to build complex parent/child records.
        ├── doctor.ts                     # CLI environment health checker.
        ├── failure-analyzer.ts           # Analyzes errors and maps them to RCA categories (e.g., "UI Timeout").
        ├── internal-metadata-scanner.ts  # Parses org metadata to map dependencies.
        ├── popup-handler.ts              # The MutationObserver that kills Salesforce popups dynamically.
        ├── selectors.ts                  # Master dictionary of Shadow-DOM piercing locators.
        └── sf-helpers.ts                 # Intercepts network calls to ensure the UI is fully loaded.
```

### Detailed File Dictionary

| File Path | What It Does (Explanation) | Why It Was Created |
| :--- | :--- | :--- |
| **`SKILL.md`** | Master AI Instructions. Defines the 4 modes, the JSON DSL schema, and the 28 allowed action verbs. | To strictly constrain the AI from hallucinating code and ensure it only generates valid JSON tests. |
| **`scoring-rubric.md`** | A 150-point quality gate for test evaluation. | To enforce enterprise standards (like ensuring every test cleans up after itself). |
| **`framework/.env`** | Stores the Salesforce server-to-server JWT credentials. | To enable headless, password-less CI/CD authentication without locking accounts. |
| **`framework/domains.json`** | Defines custom object clusters (e.g., grouping `Account`, `Opportunity` into "Sales"). | Allows QA to run targeted regression tests on specific business domains instead of scanning the whole org. |
| **`framework/personas.json`** | Defines the test user profiles (e.g., Sales Rep, Admin). | To test Field-Level Security (FLS) and sharing rules by logging in as different roles. |
| **`framework/playwright.config.ts`** | The Playwright engine configuration. | Handles parallel execution (workers), visual regression thresholds, and retry logic. |
| **`executor/json-runner.spec.ts`** | **The Master Engine.** Translates the JSON DSL steps into actual Playwright browser clicks. | Acts as the "translation layer" so testers never have to write raw TypeScript. |
| **`generators/story-parser.ts`** | Parses SFSpeckit Markdown developer stories to extract Acceptance Criteria. | To automatically figure out exactly what needs to be tested based on the Jira/Markdown story. |
| **`generators/json-test-generator.ts`** | Converts the parsed Acceptance Criteria into the `.test.json` DSL format. | To automate test writing. It handles the heavy lifting of generating the test structure. |
| **`generators/baseline-scanner.ts`** | Scans the Salesforce org's metadata to map dependencies (Validation Rules, Record Types). | To automatically build a massive foundational regression suite without human effort. |
| **`page-objects/RecordPage.ts`** | Contains 26 methods for interacting with Standard Salesforce Record pages (e.g., clicking edit, filling fields). | Centralizes the logic for complex UI interactions so they aren't repeated in every test. |
| **`page-objects/ScreenFlow.ts`** | Methods for navigating and asserting Salesforce Screen Flows. | To handle the specific nested iframes and "Next/Previous" buttons unique to flows. |
| **`reporters/rca-excel-reporter.ts`** | Generates an Excel triage report with categorized failures after a test run. | To provide non-technical QA managers with a business-readable Pass/Fail spreadsheet. |
| **`utils/auth.ts`** | Handles the secure JWT authentication and cookie session bypass. | Bypasses the slow Salesforce login screen by directly injecting session cookies. |
| **`utils/cleanup.ts`** | CLI tool to securely delete test data after runs. | Prevents the testing environment from becoming polluted with thousands of dummy records. |
| **`utils/data-factory.ts`** | Hooks into the `sf data tree` command to build complex parent/child records instantly. | Removes the need for slow UI-based data creation; builds complex data structures in milliseconds via API. |
| **`utils/failure-analyzer.ts`** | Intercepts stack traces and maps them to human-readable RCA categories (e.g., "UI Timeout"). | Stops QA from having to read code errors; tells them exactly what went wrong in plain English. |
| **`utils/internal-metadata-scanner.ts`**| Parses org metadata to map dependencies like which triggers fire on which objects. | Allows the framework to know *what else* might break when a change is made to an object. |
| **`utils/popup-handler.ts`** | A `MutationObserver` that actively watches for and closes Salesforce popups. | Prevents random "Guidance Center" or "Survey" popups from stealing focus and failing a test. |
| **`utils/selectors.ts`** | The master dictionary of Shadow-DOM piercing locators for the entire Salesforce UI. | Centralizes locators so that if Salesforce changes a class name, you only update it in one file. |
| **`utils/sf-helpers.ts`** | Intercepts network calls (`**/aura`, `**/graphql`) to ensure the UI is fully loaded. | Cures "flaky tests" by forcing Playwright to wait for background API calls to finish before clicking. |

---

## 6. QA Workflow Guide: The 4 Modes

QA Testers interact with the framework exclusively using IDE Slash Commands. You do not need to write code.

### What Happens When You Run a Command?
The process is entirely automated and headless by default. Here is the exact physical timeline:
1. **The Route:** The Intelligent Router parses your command and decides which mode to run.
2. **The Generation:** The AI writes the JSON DSL test file (takes 10-20 seconds).
3. **The Execution:** A Chromium browser spins up. It securely logs into Salesforce using Server-to-Server JWT (no passwords needed). It reads the JSON file and clicks through the UI just like a human. 
4. **The Teardown:** The browser closes, and the data cleanup script removes the test records.
5. **The Report:** You receive an Excel Root Cause Analysis report with exact pass/fail metrics.

### Mode 1: Feature Testing (`/sfspeckit-e2e-story`)
**Goal:** Test a brand new feature built by a developer.
**How it works:**
1. You run: `/sfspeckit-e2e-story TS-01.md`
2. The AI reads the Markdown developer story (`TS-01.md`).
3. It parses the Acceptance Criteria (Given/When/Then).
4. It generates a `.test.json` file in `tests/stories/`.
5. It automatically executes the test in a browser.
6. It provides you with an Excel report showing Pass/Fail metrics.

### Mode 2: Baseline Generation (`/sfspeckit-e2e-baseline`)
**Goal:** Generate regression tests for the entire org or specific areas automatically.
**How it works:**
1. You run: `/sfspeckit-e2e-baseline for Account and Contact`
2. The `baseline-scanner.ts` looks at your Salesforce org's metadata.
3. It maps all dependencies (Validation Rules, Record Types, Child Objects).
4. It generates hundreds of JSON tests for standard CRUD operations and saves them to `tests/baseline/`.

### Mode 3: Full Regression (`/sfspeckit-e2e-regression`)
**Goal:** Run the entire test suite to ensure nothing is broken before a release.
**How it works:**
1. You run: `/sfspeckit-e2e-regression`
2. Playwright spins up multiple parallel browser workers.
3. It executes every JSON test across all personas.
4. Generates a master HTML report and the Root Cause Analysis (RCA) Excel file.

### Mode 4: UI Discovery & Selector Refresh (`/sfspeckit-e2e-discover`)
**Goal:** Fix existing broken locators (self-healing) OR map entirely new Custom LWCs or heavily customized Managed Package UIs (like CPQ or Conga) using the Spy Agent.

#### 1. To Fix an Existing Broken Locator (Self-Healing)
Use keywords like **fix**, **repair**, **update**, or **broken** and point it to the specific element or page that failed in your test report.

*   `/e2e-discover repair the global Save button on the Record Page`
*   `/e2e-discover fix the broken locator for the Account Industry picklist`
*   `/e2e-discover update selectors.ts because the Winter '26 release changed the Setup menu`

**What it does:** It opens the browser, navigates to the element, finds the new DOM path, and updates your `framework/utils/selectors.ts` file without touching any page objects.

#### 2. To Map a New Custom UI (Spy Agent)
Use keywords like **map**, **learn**, **spy**, or **generate** and name the specific Custom LWC, Managed Package, or complex Visualforce page.

*   `/e2e-discover map the new Smart Grid custom LWC`
*   `/e2e-discover learn the Conga Quote Generator screen`
*   `/e2e-discover use the spy agent to generate a page object for the Community checkout flow`

**What it does:** It opens the browser, navigates to the component, recursively pierces the Shadow DOM to identify all buttons/inputs/tables, writes a brand new TypeScript Page Object file, and registers the new actions with the JSON runner.

> **Pro-Tip:** Because it's an AI agent, it's very forgiving. If you just paste in the error from your RCA Excel report like: `/e2e-discover test failed due to UI/DOM Timeout on clickSave for Opportunity`, it will instantly know it needs to run a repair on that specific locator!

---

## 7. Advanced: Troubleshooting & Root Cause Analysis (RCA)

When a test fails, the framework's `failure-analyzer.ts` intercepts the stack trace and translates it into human-readable business terms in the Excel report.

| RCA Category in Report | What it Means | What QA Should Do |
| :--- | :--- | :--- |
| **UI/DOM Timeout** | A button or field couldn't be found on the screen. | Run `/e2e-discover` to have the AI fix the broken locator. |
| **Assertion Failure** | The test expected "Active" but found "Inactive". | This is a real bug! Log a ticket in Jira for the developer. |
| **Database Mismatch** | The UI showed success, but the SOQL database check failed. | Log a critical backend defect ticket. |
| **Framework Limitation** | The JSON requested an action the runner doesn't know. | Use the Spy Agent (`/e2e-discover`) to teach the framework the new action. |
