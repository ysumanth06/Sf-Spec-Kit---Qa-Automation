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

### Defense 6: Data Pollution & Isolation (The Clean Org Guarantee)
*   **The Problem:** E2E testing frameworks quickly pollute testing environments with junk records. Furthermore, running tests in parallel causes `UNABLE_TO_LOCK_ROW` collisions when tests fight over the same static data (e.g., "QA-Test Account").
*   **The Solution:** The framework enforces strict **Data Isolation by Design**. The JSON generators mandate dynamic timestamps (`{{QA_PREFIX}}-{{@timestamp}}`) for all unique data creation. A built-in cleanup utility (`npm run qa:cleanup`) automatically tracks and hard-deletes all generated data immediately after the test suite finishes.

### Defense 7: Native Visual Regression Testing
*   **The Problem:** CSS and styling regressions (like a button moving 10 pixels to the left, or a font color changing) are impossible to catch with standard click-and-assert testing.
*   **The Solution:** The framework integrates Playwright's native visual regression testing. It takes a pixel-perfect screenshot of the component and compares it to a baseline image. If the UI changes visually beyond an acceptable threshold, the test fails automatically.

### Defense 8: Runtime Auto-Healing (Smart Retries)
*   **The Problem:** Transient Salesforce UI and Data issues—like elements briefly hidden by responsive layouts or background row locks (`UNABLE_TO_LOCK_ROW`)—cause tests to fail randomly.
*   **The Solution:** The `sf-helpers.ts` engine intercepts these specific Playwright and Salesforce errors mid-flight. It injects randomized jitter to break data lock deadlocks, automatically scrolls hidden elements into view, and waits for LWS caching to settle before retrying, all without failing the CI step.

### Defense 9: Cross-Browser & Mobile Cloud Execution
*   **The Problem:** Testing Salesforce Experience Cloud and Service Console across Mac, Windows, iOS, and different browsers is incredibly difficult to maintain locally.
*   **The Solution:** Seamless BrowserStack integration via `playwright.config.ts`. Simply setting `USE_BROWSERSTACK=true` dynamically routes the execution matrix to run against `chrome-cloud`, `safari-cloud`, and `mobile-ios` instances automatically.

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
| **Cross-Browser/Mobile**| Native BrowserStack Cloud Matrix | Complex remote node setup | 🏆 SFSpeckit |
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

#### 3. To Auto-Heal Flaky Taxonomy Tests
Use keywords like **heal**, **isolate**, or **fix flaky** to address tests that failed due to data concurrency or responsive viewport issues.

*   `/e2e-discover fix TS-04 which failed with ISOLATION_DATA_CONFLICT`
*   `/e2e-discover heal the flaky test that failed due to row lock`

**What it does:** It intelligently targets the `.test.json` DSL file instead of the selectors. For data conflicts, it auto-injects dynamic `@timestamp` prefixes to test data to ensure isolation. For viewport issues, it injects explicit scroll commands into the DSL.

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
| **Flaky: ISOLATION_DATA_CONFLICT** | Test failed due to a database row lock or concurrent data access. | The test design is flawed. Run `/e2e-discover` to inject dynamic `@timestamp` data isolation. |
| **Flaky: ENVIRONMENT_VIEWPORT** | Playwright could not click an element because it was pushed off-screen by responsive layouts. | Let the Runtime Healer scroll it, or run `/e2e-discover` to hardcode a scroll step. |
| **Flaky: INFRASTRUCTURE_CACHE** | Salesforce Lightning Web Security served a stale component state. | The Runtime Healer will wait, but consider refreshing the org or clearing cache. |

---

## 8. Third-Party Integrations Explained

### BrowserStack (The Device Farm)
BrowserStack is a paid, third-party cloud infrastructure service. It is not built into Playwright.
*   **Playwright's Limitation**: Playwright runs tests locally. It can emulate mobile devices by resizing the screen, but it is not running a real iOS or Android operating system.
*   **The BrowserStack Advantage**: BrowserStack hosts thousands of real physical devices (iPhones, Androids) and native operating systems (Windows 11, macOS) in data centers. 
*   **Why we integrated it**: If a Salesforce Experience Cloud bug only occurs on a real Apple GPU or inside the native iOS WebKit engine, Playwright's local emulation will miss it. Enabling `USE_BROWSERSTACK=true` securely routes the Playwright execution to a real device in the cloud.

### TestRail (The Management Dashboard)
TestRail is a paid, third-party Test Case Management System (TCMS).
*   **Playwright's Limitation**: Playwright is an *execution engine*. It runs code and outputs Pass/Fail logs. It does not know *why* a test exists, it cannot track manual testing, and it does not provide historical reporting.
*   **TestRail's Advantage**: TestRail acts as a "System of Record" for QA (like Jira for testing). It stores all test cases, links them to Jira requirements for auditing, and provides dashboards for non-technical managers.
*   **Why we DON'T need it**: We built the SFSpeckit ecosystem to replace TestRail completely using a **Docs-as-Code** strategy, saving thousands of dollars in licensing fees.

---

## 9. Docs-as-Code: The Git-Backed Test Management System

The SFSpeckit ecosystem provides a native, completely free alternative to TestRail by turning your Git repository into the System of Record.

1. **The System of Record**: Instead of storing tests in a cloud database, your Developer Story Markdown files (`task_story_01.md`) and the generated `.test.json` files serve as the permanent record. Because they live in Git, you have cryptographically secure version control and timestamped history for compliance auditors.
2. **Manual Testing Scripts (`/sfspeckit-qa`)**: QA testers don't need TestRail to execute manual tests. The `/sfspeckit-qa` skill automatically reads the story and generates a `task_story_NN_test_scripts.md` file containing a step-by-step clickpath matrix. QA testers execute the steps in Salesforce, check off the markdown checkboxes, and commit the file as their official sign-off.
3. **Traceability & Auditing (`/sfspeckit-release-notes`)**: The `/sfspeckit-e2e-story` skill automatically generates a Traceability Matrix (`task_story_NN_e2e_results.md`) mapping every AC to a Pass/Fail result. At the end of a sprint, the TPO runs `/sfspeckit-release-notes` to aggregate all manual sign-offs and automated results into a single, auditor-ready `RELEASE_NOTES.md` dashboard.

---

## 10. Git Strategies for SFSpeckit E2E Workflow

When scaling testing across multiple developers and QA engineers, you must align the SFSpeckit workflow with your Git branching strategy. Below are the two primary models.

### Strategy A: Shared Dev Sandbox (The Consolidated Pipeline)
**Environment Setup**: Multiple developers write code in the *same* `dev` sandbox. Code is promoted to `int` (Integration) and then `qa`.

1. **Development**: Developers work on separate feature branches (`feat/TS-01`, `feat/TS-02`) locally but push metadata to the shared `dev` sandbox.
2. **Story Hand-off**: When developers finish, their branches are merged into a consolidated `release/sprint-1` branch, and the combined code is deployed to the `qa` sandbox.
3. **QA Testing (Parallel)**: 
    * Multiple QA testers pull the `release/sprint-1` branch locally.
    * Tester A runs `/sfspeckit-qa` and `/sfspeckit-e2e-story` against `TS-01`.
    * Tester B runs `/sfspeckit-qa` and `/sfspeckit-e2e-story` against `TS-02`.
    * **Committing**: Because they are testing in parallel against the *same* `qa` sandbox, they execute their tests and commit their generated artifacts (`task_story_01_test_scripts.md`, `task_story_01_e2e_results.md`) directly back to the `release/sprint-1` branch. Git handles the merges seamlessly since they are editing different markdown files.
4. **QA Lead Regression**: Once all testers have committed their passing artifacts, the QA Lead pulls the `release/sprint-1` branch. They run the master `/sfspeckit-e2e-regression` against the QA sandbox to ensure the combined code didn't break anything else in the org. They commit the final `Test_Results_RCA.xlsx`.
5. **Release**: The Release Manager runs `/sfspeckit-release-notes` on the branch, commits the final Master Dashboard, and the branch is merged to `main`.

### Strategy B: Individual Dev Sandboxes (The Isolated Pipeline)
**Environment Setup**: Every developer has their own isolated sandbox (`dev1`, `dev2`). Code is promoted to `int`, then `qa`.

1. **Development**: Developer 1 works in `dev1` on branch `feat/TS-01`. They write code and the `task_story_01.md` file, but they *do not* run the E2E framework. They commit their code and push.
2. **Integration (INT)**: `feat/TS-01` and `feat/TS-02` are merged into the `int` branch and deployed to the `int` sandbox to ensure the code compiles together.
3. **QA Sandbox**: The `int` branch is promoted to `release/sprint-1` and deployed to the formal `qa` sandbox.
4. **Formal QA Testing (Generation & Execution)**: 
    * The QA team checks out `release/sprint-1`.
    * **Automation**: QA runs `/sfspeckit-e2e-story TS-01`. The AI reads the story, generates the `.test.json` DSL, and executes the test against the `qa` sandbox. 
    * **Manual**: QA runs `/sfspeckit-qa` to generate manual scripts and executes them in the `qa` sandbox.
    * **Committing**: QA commits the generated `.test.json` tests, the manual `_test_scripts.md` sign-offs, and the `_results.md` back to the `release/sprint-1` branch. 
5. **QA Lead Regression**: The QA Lead runs `/sfspeckit-e2e-regression` against the `qa` sandbox, commits the RCA, generates the release notes, and signs off for Production.

---

## 11. CI/CD Integration (GitHub Actions)

Once the JSON tests are generated and committed to the repository by the QA team, they can be executed automatically in your CI/CD pipeline (e.g., GitHub Actions) to prevent regressions on future Pull Requests.

Because SFSpeckit E2E is built on Playwright, it integrates natively into GitHub Actions. Below is a standard `.github/workflows/e2e-regression.yml` configuration:

```yaml
name: SFSpeckit E2E Regression

on:
  pull_request:
    branches: [ main, release/* ]

jobs:
  test:
    name: Run Salesforce Playwright Tests
    timeout-minutes: 60
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout Repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 18

    - name: Install Dependencies
      working-directory: .agents/skills/sfspeckit-e2e/framework
      run: npm ci

    - name: Install Playwright Browsers
      working-directory: .agents/skills/sfspeckit-e2e/framework
      run: npx playwright install --with-deps chromium

    - name: Run E2E Regression Suite
      working-directory: .agents/skills/sfspeckit-e2e/framework
      env:
        # Securely inject Server-to-Server JWT credentials from GitHub Secrets
        SF_USERNAME: ${{ secrets.SF_USERNAME }}
        SF_CLIENT_ID: ${{ secrets.SF_CLIENT_ID }}
        SF_LOGIN_URL: ${{ secrets.SF_LOGIN_URL }}
        SF_JWT_KEY: ${{ secrets.SF_JWT_KEY }} 
        # Optional: Enable BrowserStack for cloud testing
        USE_BROWSERSTACK: false 
      run: npx playwright test executor/json-runner.spec.ts

    - name: Upload RCA Excel Report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: sfspeckit-rca-report
        path: .agents/skills/sfspeckit-e2e/framework/reports/Test_Results_RCA.xlsx
        retention-days: 14
```

**Key CI/CD Benefits:**
* **Headless Execution**: The tests run completely headless in the Ubuntu runner.
* **Secret Injection**: The Salesforce JWT credentials are pulled securely from GitHub Secrets, meaning no passwords are hardcoded in the repo.
* **Artifact Upload**: If the test fails, the pipeline automatically uploads the `Test_Results_RCA.xlsx` file. Your developers can download it directly from the GitHub Actions UI to see exactly which test failed and the human-readable RCA category.
