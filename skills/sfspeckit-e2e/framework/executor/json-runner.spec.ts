/**
 * json-runner.spec.ts — The Master Execution Engine
 *
 * This is the single, static Playwright test file that executes ALL JSON DSL test files.
 * It reads structured JSON instructions and translates them into real Playwright actions.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DO NOT let AI modify this file.                            ║
 * ║  Only a human developer should add new action verbs here.   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';
import { RecordPage } from '../page-objects/RecordPage';
import { ScreenFlow } from '../page-objects/ScreenFlow';
import { ListView } from '../page-objects/ListView';
import {
  authenticatePage,
  getPersona,
  getConnection,
} from '../utils/auth';
import {
  waitForPageReady,
  waitForSalesforceNetwork,
  buildSalesforceUrl,
  getToastMessage,
  retryAction,
  qaPrefix,
} from '../utils/sf-helpers';
import { installPopupHandler } from '../utils/popup-handler';
import { createTestRecord, registerCreatedRecord, cleanupTestRecords, importDataTree } from '../utils/test-data';
import { classifyFailure } from '../utils/failure-analyzer';
import { verifyDatabase } from '../utils/internal-soql-verifier';
import { parseCsv, csvRowToVariables, resolveDataSourcePath, type CsvRow } from '../utils/csv-loader';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface TestStep {
  action: string;
  /** Number of retry attempts for this step (default: action-specific) */
  retries?: number;
  [key: string]: any;
}

interface TestCase {
  id: string;
  title: string;
  persona: string;
  tags?: string[];
  steps: TestStep[];
}

interface DataFactoryItem {
  variable: string;
  object: string;
  fields: Record<string, any>;
}

interface TestSuite {
  name: string;
  storyId?: string;
  personas: string[];
  /** Optional CSV data source for data-driven test parameterization */
  dataSource?: string;
  /** When true with dataSource, iterates each test for every CSV row */
  iterateRows?: boolean;
  setup?: {
    /** Simple array of records to create */
    dataFactory?: DataFactoryItem[];
    /** Path to a Salesforce CLI JSON data plan for complex relational data */
    dataPlan?: string;
    apex?: string;
  };
  tests: TestCase[];
}

// ═══════════════════════════════════════════════════════════
// Retry Configuration — per action defaults
// ═══════════════════════════════════════════════════════════

const DEFAULT_RETRIES: Record<string, number> = {
  selectPicklist: 3,
  selectMultiPicklist: 3,
  fillLookup: 3,
  assertToast: 2,
  clickEdit: 2,
  clickSave: 2,
  clickDelete: 2,
  openRecord: 2,
  openNewRecord: 2,
  openObjectHome: 2,
};

// ═══════════════════════════════════════════════════════════
// Test File Discovery
// ═══════════════════════════════════════════════════════════

const TESTS_DIR = path.resolve(__dirname, '..', 'tests');

function discoverTestFiles(): string[] {
  const files: string[] = [];
  const targetTest = process.env.E2E_TEST_FILE;

  if (targetTest) {
    // Run a specific test file
    const resolved = path.resolve(TESTS_DIR, targetTest);
    if (fs.existsSync(resolved)) {
      files.push(resolved);
    }
    return files;
  }

  // Discover all .test.json files
  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.test.json')) {
        files.push(fullPath);
      }
    }
  }

  walk(path.join(TESTS_DIR, 'baseline'));
  walk(path.join(TESTS_DIR, 'stories'));
  return files;
}

// ═══════════════════════════════════════════════════════════
// Variable Resolution
// ═══════════════════════════════════════════════════════════

function resolveVariables(value: any, variables: Map<string, string>): any {
  if (typeof value !== 'string') return value;
  let resolved = value;
  for (const [key, val] of variables) {
    resolved = resolved.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), val);
  }
  // Process faker tokens: {{@faker.person.firstName}}
  resolved = resolved.replace(/\{\{@faker\.([\w.]+)\}\}/g, (match, path) => {
    try {
      const parts = path.split('.');
      let obj: any = faker;
      for (const p of parts) {
        if (obj === undefined) break;
        obj = obj[p];
      }
      if (typeof obj === 'function') {
        return obj();
      }
      return match;
    } catch (e) {
      return match;
    }
  });
  return resolved;
}

function resolveStepVariables(step: TestStep, variables: Map<string, string>): TestStep {
  const resolved: TestStep = { ...step };
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      resolved[key] = resolveVariables(value, variables);
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = JSON.parse(resolveVariables(JSON.stringify(value), variables));
    }
  }
  return resolved;
}

// ═══════════════════════════════════════════════════════════
// The Engine: Action Executor
// ═══════════════════════════════════════════════════════════

async function executeStep(
  step: TestStep,
  page: any,
  recordPage: RecordPage,
  screenFlow: ScreenFlow,
  listView: ListView,
  conn: any,
  variables: Map<string, string>,
): Promise<void> {
  const resolved = resolveStepVariables(step, variables);

  switch (resolved.action) {
    // ── Navigation ────────────────────────────────────────
    case 'openRecord': {
      const url = buildSalesforceUrl(
        conn.instanceUrl,
        `/lightning/r/${resolved.object}/${resolved.recordId}/view`,
      );
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForPageReady(page);
      await waitForSalesforceNetwork(page);
      break;
    }
    case 'openNewRecord': {
      let url = `/lightning/o/${resolved.object}/new`;
      if (resolved.recordTypeId) url += `?recordTypeId=${resolved.recordTypeId}`;
      await page.goto(buildSalesforceUrl(conn.instanceUrl, url), { waitUntil: 'domcontentloaded' });
      await waitForPageReady(page);
      await waitForSalesforceNetwork(page);
      break;
    }
    case 'openObjectHome': {
      await page.goto(
        buildSalesforceUrl(conn.instanceUrl, `/lightning/o/${resolved.object}/list`),
        { waitUntil: 'domcontentloaded' },
      );
      await waitForPageReady(page);
      await waitForSalesforceNetwork(page);
      break;
    }
    case 'launchFlow': {
      await page.goto(
        buildSalesforceUrl(conn.instanceUrl, `/flow/${resolved.flowApiName}`),
        { waitUntil: 'domcontentloaded' },
      );
      await waitForPageReady(page);
      break;
    }
    case 'switchApp': {
      // Click the App Launcher waffle icon and select an app
      await page.locator('button[class*="appLauncher"], div.slds-icon-waffle').first().click();
      await page.waitForTimeout(500);
      const searchInput = page.locator('input[placeholder*="Search apps"], input[type="search"]').first();
      await searchInput.fill(resolved.appName);
      await page.waitForTimeout(1_000);
      await page.getByRole('option', { name: resolved.appName, exact: false }).first().click();
      await waitForPageReady(page);
      await waitForSalesforceNetwork(page);
      break;
    }

    // ── Tab / Console Navigation ──────────────────────────
    case 'openTab': {
      // Open a workspace tab (Console apps)
      const navTab = page.locator('one-app-nav-bar-item-root', {
        has: page.getByText(resolved.tabName, { exact: true }),
      });
      await navTab.click();
      await waitForPageReady(page);
      break;
    }
    case 'switchTab': {
      // Switch between open workspace tabs in Console layout
      const tab = page.locator('li[role="presentation"] a[role="tab"]', {
        has: page.getByText(resolved.tabTitle, { exact: false }),
      });
      await tab.click();
      await waitForPageReady(page);
      break;
    }

    // ── Record Page Actions ───────────────────────────────
    case 'clickEdit':
      await recordPage.clickEdit();
      break;
    case 'clickSave':
      await recordPage.clickSave();
      await waitForSalesforceNetwork(page);
      break;
    case 'clickCancel':
      await recordPage.clickCancel();
      break;
    case 'clickDelete':
      await recordPage.clickDelete();
      await waitForSalesforceNetwork(page);
      break;
    case 'clickButton':
      await page.getByRole('button', { name: resolved.target, exact: false }).click();
      await waitForSalesforceNetwork(page);
      break;
    case 'clickAction':
      await recordPage.clickAction(resolved.target);
      await waitForSalesforceNetwork(page);
      break;

    // ── Record Type Selection ─────────────────────────────
    case 'selectRecordType': {
      // Handle the Record Type picker modal during record creation
      const modal = page.locator('.slds-modal__container, section[role="dialog"]');
      await modal.waitFor({ state: 'visible', timeout: 10_000 });
      const rtRadio = modal.getByLabel(resolved.recordTypeName, { exact: false });
      await rtRadio.click();
      const nextOrContinue = modal.getByRole('button', { name: /next|continue/i });
      await nextOrContinue.click();
      await waitForPageReady(page);
      break;
    }

    // ── Field Interactions ────────────────────────────────
    case 'fill':
      await recordPage.fillField(resolved.target, resolved.value);
      break;
    case 'selectPicklist':
      await recordPage.selectPicklist(resolved.target, resolved.value);
      break;
    case 'selectMultiPicklist': {
      // Multi-select picklist: move items from Available to Selected
      const dualListbox = page.locator('lightning-dual-listbox', {
        has: page.getByText(resolved.target),
      });
      const values = Array.isArray(resolved.values) ? resolved.values : [resolved.values];
      for (const val of values) {
        const option = dualListbox.locator('div[role="option"]', {
          has: page.getByText(val, { exact: true }),
        });
        await option.click();
      }
      // Click move-to-selected button
      await dualListbox.locator('button[title*="Move selection to"]').first().click();
      await waitForSalesforceNetwork(page, { settleMs: 300 });
      break;
    }
    case 'fillLookup':
      await recordPage.fillLookup(resolved.target, resolved.searchTerm);
      break;
    case 'fillDate':
      await recordPage.fillField(resolved.target, resolved.value);
      break;
    case 'fillRichText': {
      // Rich text editor — uses contenteditable iframe or lightning-input-rich-text
      const richText = page.locator('lightning-input-rich-text', {
        has: page.getByText(resolved.target),
      });
      const editor = richText.locator('[contenteditable="true"], .ql-editor').first();
      await editor.click();
      await editor.fill(resolved.value);
      break;
    }
    case 'setCheckbox': {
      const checkbox = page.getByLabel(resolved.target);
      const isChecked = await checkbox.isChecked();
      if (resolved.checked && !isChecked) await checkbox.check();
      if (!resolved.checked && isChecked) await checkbox.uncheck();
      break;
    }
    case 'uploadFile': {
      // File upload via input[type=file] or lightning-file-upload
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(resolved.filePath);
      await waitForSalesforceNetwork(page);
      break;
    }

    // ── Drag and Drop ─────────────────────────────────────
    case 'dragAndDrop': {
      const source = page.locator(resolved.sourceSelector);
      const target = page.locator(resolved.targetSelector);
      await source.dragTo(target);
      await waitForSalesforceNetwork(page);
      break;
    }

    // ── Scroll ────────────────────────────────────────────
    case 'scrollTo': {
      if (resolved.selector) {
        await page.locator(resolved.selector).scrollIntoViewIfNeeded();
      } else if (resolved.direction === 'bottom') {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } else if (resolved.direction === 'top') {
        await page.evaluate(() => window.scrollTo(0, 0));
      } else {
        await page.evaluate((pixels: number) => window.scrollBy(0, pixels), resolved.pixels || 500);
      }
      await page.waitForTimeout(300);
      break;
    }

    // ── Assertions ────────────────────────────────────────
    case 'assertToast': {
      const toast = await getToastMessage(page);
      expect(toast).toContain(resolved.contains);
      break;
    }
    case 'assertFieldValue': {
      const value = await recordPage.getFieldValue(resolved.target);
      expect(value).toContain(resolved.expected);
      break;
    }
    case 'assertFieldVisible': {
      const visible = await recordPage.isFieldVisible(resolved.target);
      expect(visible).toBe(resolved.visible);
      break;
    }
    case 'assertFieldEditable': {
      const editable = await recordPage.isFieldEditable(resolved.target);
      expect(editable).toBe(resolved.editable);
      break;
    }
    case 'assertFieldRequired': {
      const required = await recordPage.isFieldRequired(resolved.target);
      expect(required).toBe(resolved.required);
      break;
    }
    case 'assertErrorMessage': {
      const error = await recordPage.getErrorMessage();
      expect(error).toContain(resolved.contains);
      break;
    }
    case 'assertUrl': {
      expect(page.url()).toContain(resolved.contains);
      break;
    }
    case 'assertRowCount': {
      // Assert number of rows in a datatable or related list
      const rows = await listView.getRowCount(resolved.target);
      if (resolved.expected !== undefined) {
        expect(rows).toBe(resolved.expected);
      }
      if (resolved.min !== undefined) {
        expect(rows).toBeGreaterThanOrEqual(resolved.min);
      }
      if (resolved.max !== undefined) {
        expect(rows).toBeLessThanOrEqual(resolved.max);
      }
      break;
    }
    case 'assertListViewRow': {
      // Assert a specific row exists in a list view
      const found = await listView.assertRowExists(resolved.searchColumn, resolved.searchValue);
      expect(found).toBe(true);
      break;
    }

    // ── Visual Regression ─────────────────────────────────
    case 'assertVisualSnapshot': {
      const snapshotName = resolved.name || 'visual-snapshot';
      await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
        fullPage: resolved.fullPage ?? false,
        maxDiffPixelRatio: resolved.maxDiffRatio ?? 0.01,
        threshold: resolved.threshold ?? 0.2,
        animations: 'disabled',
      });
      break;
    }

    // ── Database Verification ─────────────────────────────
    case 'verifyDatabase': {
      const result = await verifyDatabase(resolved.query, resolved.expect);
      expect(result.passed).toBe(true);
      break;
    }

    // ── Flow Navigation ───────────────────────────────────
    case 'flowNext':
      await screenFlow.clickNext();
      await waitForSalesforceNetwork(page);
      break;
    case 'flowPrevious':
      await screenFlow.clickPrevious();
      break;
    case 'flowFinish':
      await screenFlow.clickFinish();
      await waitForSalesforceNetwork(page);
      break;

    // ── API Integration ───────────────────────────────────
    case 'apiRequest': {
      const { url, method, headers, body, assertStatus } = resolved;
      const response = await page.request.fetch(url, {
        method: method || 'GET',
        headers: headers || {},
        data: body,
      });
      if (assertStatus) {
        expect(response.status()).toBe(assertStatus);
      }
      break;
    }

    // ── Salesforce MCP Integration ────────────────────────
    case 'mcpExecute': {
      const mcpAvailable = process.env.SF_MCP_ENABLED === 'true';
      if (!mcpAvailable) {
        console.warn(`⚠️ MCP_UNAVAILABLE: Salesforce MCP is not enabled. Falling back to dataFactory if provided.`);
        if (resolved.fallbackFactory && Array.isArray(resolved.fallbackFactory)) {
          for (const item of resolved.fallbackFactory) {
            const resolvedFields = { ...item.fields };
            for (const [fk, fv] of Object.entries(resolvedFields)) {
              if (typeof fv === 'string') {
                resolvedFields[fk] = resolveVariables(fv, variables);
              }
            }
            const record = await createTestRecord(conn, item.object, resolvedFields);
            variables.set(item.variable, record.id);
            registerCreatedRecord(record);
          }
        } else {
          throw new Error('🛑 MCP_UNAVAILABLE and no fallbackFactory provided for mcpExecute step.');
        }
      } else {
        console.log(`[MCP] Executing instruction: ${resolved.instruction}`);
        // Placeholder for actual MCP client execution
      }
      break;
    }

    // ── Vision Assertions ─────────────────────────────────
    case 'assertVision': {
      console.log(`👁️  Vision Assertion: ${resolved.prompt}`);
      const screenshotPath = path.join('screenshots', `vision-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.warn(`⚠️ assertVision is a stub. Visual validation requires external LLM integration to process ${screenshotPath}.`);
      break;
    }

    // ── Utility ───────────────────────────────────────────
    case 'wait':
      await page.waitForTimeout(resolved.ms || 2000);
      break;
    case 'screenshot':
      await page.screenshot({
        path: path.join('screenshots', `${resolved.name || 'screenshot'}.png`),
        fullPage: true,
      });
      break;

    // ── FRAMEWORK LIMITATION TRAP ─────────────────────────
    default:
      throw new Error(
        `🛑 FRAMEWORK_LIMITATION: The AI attempted to use an unknown UI interaction verb: "${resolved.action}". ` +
        `A developer needs to add this capability to the json-runner.spec.ts engine. ` +
        `Step details: ${JSON.stringify(resolved)}`,
      );
  }
}

// ═══════════════════════════════════════════════════════════
// Step Executor with Retry
// ═══════════════════════════════════════════════════════════

async function executeStepWithRetry(
  step: TestStep,
  page: any,
  recordPage: RecordPage,
  screenFlow: ScreenFlow,
  listView: ListView,
  conn: any,
  variables: Map<string, string>,
): Promise<void> {
  const maxRetries = step.retries ?? DEFAULT_RETRIES[step.action] ?? 0;

  // Conversational trace logging
  let stepName = `[AGENT] Executing ${step.action} on ${step.target || step.object || ''}`;
  if (step.action === 'clickButton') stepName = `[AGENT] Identified '${step.target}' button; clicking it.`;
  else if (step.action === 'fill') stepName = `[AGENT] Found '${step.target}' input; entering text.`;
  else if (step.action === 'assertToast') stepName = `[AGENT] Waiting for toast containing '${step.contains}' to validate success.`;
  else if (step.action === 'verifyDatabase') stepName = `[AGENT] Querying database to verify backend state.`;
  else if (step.action === 'apiRequest') stepName = `[AGENT] Making API Call to ${step.url}.`;
  else if (step.action === 'mcpExecute') stepName = `[AGENT] Delegating to MCP: ${step.instruction}`;
  else if (step.action === 'assertVision') stepName = `[AGENT] Using Vision to assert: ${step.prompt}`;

  await test.step(stepName, async () => {
    if (maxRetries <= 0) {
      // No retry — execute directly
      await executeStep(step, page, recordPage, screenFlow, listView, conn, variables);
      return;
    }

    await retryAction(
      () => executeStep(step, page, recordPage, screenFlow, listView, conn, variables),
      maxRetries,
      1_000,
      page,
    );
  });
}

// ═══════════════════════════════════════════════════════════
// CSV Data-Driven Test Registration
// ═══════════════════════════════════════════════════════════

/**
 * Load and validate CSV data source if specified in the suite.
 */
function loadCsvDataSource(suite: TestSuite, testFilePath: string): CsvRow[] | null {
  if (!suite.dataSource) return null;

  const csvPath = resolveDataSourcePath(suite.dataSource, testFilePath);
  try {
    const rows = parseCsv(csvPath);
    console.log(`📊 Loaded ${rows.length} data rows from ${suite.dataSource}`);
    return rows;
  } catch (err) {
    console.error(`❌ Failed to load CSV data source "${suite.dataSource}": ${err}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// Test Registration
// ═══════════════════════════════════════════════════════════

const testFiles = discoverTestFiles();

for (const filePath of testFiles) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let suite: TestSuite;
  try {
    suite = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse ${filePath}: ${err}`);
    continue;
  }

  // Load CSV data source if specified
  const csvRows = loadCsvDataSource(suite, filePath);
  const shouldIterate = suite.iterateRows && csvRows && csvRows.length > 0;

  test.describe(suite.name, () => {
    // ── Automated Cleanup — runs after all tests in this suite ──
    test.afterAll(async () => {
      try {
        const deleted = await cleanupTestRecords();
        if (deleted > 0) {
          console.log(`🧹 Cleaned up ${deleted} test record(s) for suite: ${suite.name}`);
        }
      } catch (err) {
        console.warn(`⚠️ Cleanup failed for suite ${suite.name}: ${err}`);
      }
    });

    // ── Register tests ──
    if (shouldIterate && csvRows) {
      // ═══════════════════════════════════════════════════════
      // Data-Driven Mode: iterate each test × each CSV row
      // ═══════════════════════════════════════════════════════
      for (const tc of suite.tests) {
        for (let rowIdx = 0; rowIdx < csvRows.length; rowIdx++) {
          const row = csvRows[rowIdx];
          const rowLabel = row['Name'] || row['Id'] || `Row ${rowIdx + 1}`;

          test(`[${tc.persona}] ${tc.id}: ${tc.title} | ${rowLabel}`, async ({ page }, testInfo) => {
            const variables = new Map<string, string>();

            // Inject CSV row variables ({{ColumnName}} → value)
            const csvVars = csvRowToVariables(row, rowIdx);
            for (const [key, val] of csvVars) {
              variables.set(key, val);
            }

            // Set worker-aware QA prefix using Playwright's parallelIndex
            const workerPrefix = qaPrefix(testInfo.parallelIndex);
            variables.set('{{QA_PREFIX}}', workerPrefix);

            // ── Authenticate ──────────────────────────────────
            const persona = getPersona(tc.persona);
            await installPopupHandler(page);
            await authenticatePage(page, persona.name);
            const conn = await getConnection(persona);

            // ── Data Setup ────────────────────────────────────
            if (testInfo.retry > 0) {
               console.log(`♻️  Retry attempt ${testInfo.retry}: Re-provisioning fresh test data to avoid state locks.`);
            }

            if (suite.setup) {
              if (suite.setup.dataPlan) {
                // Import complex data plan via CLI
                const resolvedPlan = resolveVariables(suite.setup.dataPlan, variables);
                const planPath = path.isAbsolute(resolvedPlan) 
                  ? resolvedPlan 
                  : path.resolve(path.dirname(filePath), resolvedPlan);
                await importDataTree(planPath);
              }

              if (suite.setup.dataFactory) {
                for (const item of suite.setup.dataFactory) {
                  const resolvedFields = { ...item.fields };
                  // Resolve CSV variables in data factory fields
                  for (const [fk, fv] of Object.entries(resolvedFields)) {
                    if (typeof fv === 'string') {
                      resolvedFields[fk] = resolveVariables(fv, variables);
                    }
                  }
                  const record = await createTestRecord(conn, item.object, resolvedFields);
                  variables.set(item.variable, record.id);
                  registerCreatedRecord(record);
                }
              }
            }

            // ── Initialize Page Objects ───────────────────────
            const recordPage = new RecordPage(page);
            const screenFlow = new ScreenFlow(page);
            const listViewPage = new ListView(page);

            // ── Execute Steps ─────────────────────────────────
            for (const step of tc.steps) {
              try {
                await executeStepWithRetry(step, page, recordPage, screenFlow, listViewPage, conn, variables);
              } catch (error) {
                const analysis = classifyFailure(error);
                throw new Error(
                  `Step "${step.action}" failed (data row ${rowIdx + 1}: ${rowLabel}).\n` +
                  `RCA Category: ${analysis.category}\n` +
                  `Suggested Fix: ${analysis.suggestedFix}\n` +
                  `Original Error: ${analysis.message}`,
                );
              }
            }
          });
        }
      }
    } else {
      // ═══════════════════════════════════════════════════════
      // Standard Mode: one test per test case
      // ═══════════════════════════════════════════════════════
      for (const tc of suite.tests) {
        test(`[${tc.persona}] ${tc.id}: ${tc.title}`, async ({ page }, testInfo) => {
          const variables = new Map<string, string>();

          // Set worker-aware QA prefix using Playwright's parallelIndex
          const workerPrefix = qaPrefix(testInfo.parallelIndex);
          variables.set('{{QA_PREFIX}}', workerPrefix);

          // Inject CSV variables as static context (non-iterated mode)
          if (csvRows && csvRows.length > 0) {
            const csvVars = csvRowToVariables(csvRows[0], 0);
            for (const [key, val] of csvVars) {
              variables.set(key, val);
            }
          }

          // ── Authenticate ──────────────────────────────────
          const persona = getPersona(tc.persona);
          await installPopupHandler(page);
          await authenticatePage(page, persona.name);
          const conn = await getConnection(persona);

          // ── Data Setup ────────────────────────────────────
          if (testInfo.retry > 0) {
             console.log(`♻️  Retry attempt ${testInfo.retry}: Re-provisioning fresh test data to avoid state locks.`);
          }

          if (suite.setup) {
            if (suite.setup.dataPlan) {
              // Import complex data plan via CLI
              const resolvedPlan = resolveVariables(suite.setup.dataPlan, variables);
              const planPath = path.isAbsolute(resolvedPlan) 
                ? resolvedPlan 
                : path.resolve(path.dirname(filePath), resolvedPlan);
              await importDataTree(planPath);
            }

            if (suite.setup.dataFactory) {
              for (const item of suite.setup.dataFactory) {
                const resolvedFields = { ...item.fields };
                for (const [fk, fv] of Object.entries(resolvedFields)) {
                  if (typeof fv === 'string') {
                    resolvedFields[fk] = resolveVariables(fv, variables);
                  }
                }
                const record = await createTestRecord(conn, item.object, resolvedFields);
                variables.set(item.variable, record.id);
                registerCreatedRecord(record);
              }
            }
          }

          // ── Initialize Page Objects ───────────────────────
          const recordPage = new RecordPage(page);
          const screenFlow = new ScreenFlow(page);
          const listViewPage = new ListView(page);

          // ── Execute Steps ─────────────────────────────────
          for (const step of tc.steps) {
            try {
              await executeStepWithRetry(step, page, recordPage, screenFlow, listViewPage, conn, variables);
            } catch (error) {
              const analysis = classifyFailure(error);
              throw new Error(
                `Step "${step.action}" failed.\n` +
                `RCA Category: ${analysis.category}\n` +
                `Suggested Fix: ${analysis.suggestedFix}\n` +
                `Original Error: ${analysis.message}`,
              );
            }
          }
        });
      }
    }
  });
}
