import type { Page, Locator } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

export function buildSalesforceUrl(baseUrl: string, relativePath: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  if (!normalizedBase) {
    throw new Error('Salesforce base URL is not configured.');
  }
  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return new URL(normalizedPath, `${normalizedBase}/`).toString();
}

export function resolveSalesforceBaseUrl(): string {
  return process.env.E2E_JWT_INSTANCE_URL?.replace(/\/$/, '') || '';
}

// ═══════════════════════════════════════════════════════════
// Network Interception — The Flakiness Cure
// ═══════════════════════════════════════════════════════════

/**
 * Waits for all active Salesforce network requests to complete.
 * This prevents clicking on elements before the UI has fully settled
 * after an aura/graphql call.
 *
 * Hooks into Playwright's network layer to track inflight requests
 * to Salesforce API endpoints and waits until they resolve.
 */
export async function waitForSalesforceNetwork(
  page: Page,
  options: { timeoutMs?: number; settleMs?: number } = {},
): Promise<void> {
  const { timeoutMs = 30_000, settleMs = 500 } = options;

  const SF_PATTERNS = [
    '**/aura**',
    '**/graphql**',
    '**/services/data/**',
    '**/ui-api/**',
  ];

  let inflightCount = 0;
  let lastActivityTimestamp = Date.now();

  const onRequest = (request: any) => {
    const url = request.url();
    if (SF_PATTERNS.some((pattern) => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(url);
    })) {
      inflightCount++;
      lastActivityTimestamp = Date.now();
    }
  };

  const onResponse = () => {
    inflightCount = Math.max(0, inflightCount - 1);
    lastActivityTimestamp = Date.now();
  };

  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('requestfailed', onResponse);

  try {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (inflightCount === 0 && Date.now() - lastActivityTimestamp >= settleMs) {
        break;
      }
      await page.waitForTimeout(100);
    }
  } finally {
    page.removeListener('request', onRequest);
    page.removeListener('response', onResponse);
    page.removeListener('requestfailed', onResponse);
  }
}

// ═══════════════════════════════════════════════════════════
// Page Ready & Spinner Handling
// ═══════════════════════════════════════════════════════════

export async function waitForSpinner(page: Page, timeout = 30_000): Promise<void> {
  const spinner = page.locator('lightning-spinner');
  try {
    await spinner.first().waitFor({ state: 'visible', timeout: 3_000 });
    await spinner.first().waitFor({ state: 'hidden', timeout });
  } catch {
    // spinner never appeared or already gone
  }
}

export async function waitForPageReady(page: Page, timeout = 30_000): Promise<void> {
  await waitForSpinner(page, timeout);
  await page.waitForLoadState('domcontentloaded');

  try {
    await page.waitForSelector(
      'records-record-layout-section, lightning-tab-bar, flowruntime-flow, ' +
      'lst-list-view-manager-header, force-highlights-details-item',
      { state: 'visible', timeout: 15_000 },
    );
  } catch {
    // page may not have standard Lightning components
  }

  await waitForSpinner(page, 5_000);
}

// ═══════════════════════════════════════════════════════════
// Toast & Navigation Helpers
// ═══════════════════════════════════════════════════════════

export async function getToastMessage(page: Page, timeout = 10_000): Promise<string> {
  try {
    const toastMsg = page.locator('.toastMessage').first();
    await toastMsg.waitFor({ state: 'visible', timeout });
    return (await toastMsg.textContent())?.trim() || '';
  } catch {
    return '';
  }
}

export async function dismissToast(page: Page): Promise<void> {
  try {
    const closeBtn = page.locator('lightning-button-icon[title="Close"]').first();
    if (await closeBtn.isVisible({ timeout: 2_000 })) {
      await closeBtn.click();
    }
  } catch {
    // no toast to dismiss
  }
}

export async function captureScreenshot(
  page: Page,
  name: string,
  subfolder?: string,
): Promise<string> {
  const dir = subfolder ? path.join(SCREENSHOT_DIR, subfolder) : SCREENSHOT_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}_${timestamp}.png`;
  const filepath = path.join(dir, filename);

  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

export async function retryAction<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1_000,
  page?: Page,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        let delay = baseDelayMs * Math.pow(2, attempt);
        const msg = lastError.message.toLowerCase();

        // ── Auto-Heal: Data Lock (Jitter) ──
        if (/unable_to_lock_row|row lock/i.test(msg)) {
          console.warn(`[Auto-Heal] Data Lock detected. Adding jitter...`);
          delay += Math.random() * 2000;
        }

        // ── Auto-Heal: Viewport (Scroll) ──
        if (page && /outside of the viewport|hidden by/i.test(msg)) {
          console.warn(`[Auto-Heal] Viewport issue detected. Scrolling...`);
          await page.evaluate(() => window.scrollBy(0, 250)).catch(() => {});
        }

        // ── Auto-Heal: Cache/Stale (Wait) ──
        if (page && /stale element|detached from dom/i.test(msg)) {
          console.warn(`[Auto-Heal] Stale element detected. Waiting for LWS...`);
          await page.waitForTimeout(500);
        }

        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Worker-aware QA prefix for parallel execution isolation.
 * In parallel mode, each worker gets a unique prefix (e.g. QA-W0, QA-W1)
 * to prevent test data collisions.
 *
 * @param workerIndex - Pass test.info().parallelIndex from inside a test.
 *                      Falls back to TEST_WORKER_INDEX env var for non-test contexts.
 *
 * Set QA_PARALLEL_PREFIX=false to disable worker indexing.
 */
export function qaPrefix(workerIndex?: number): string {
  const base = process.env.QA_PREFIX || 'QA';
  const disableParallel = process.env.QA_PARALLEL_PREFIX === 'false';

  if (disableParallel) {
    return base;
  }

  // Prefer explicit workerIndex (from test.info().parallelIndex)
  if (workerIndex !== undefined && workerIndex !== null) {
    return `${base}-W${workerIndex}`;
  }

  // Fallback to env var for non-Playwright contexts (global teardown, CLI scripts)
  const envIndex = process.env.TEST_WORKER_INDEX;
  if (envIndex) {
    return `${base}-W${envIndex}`;
  }

  return base;
}
