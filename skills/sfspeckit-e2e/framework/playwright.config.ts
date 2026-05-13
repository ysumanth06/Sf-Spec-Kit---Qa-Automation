import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { loadPersonas, resolveSalesforceBaseUrl } from './utils/auth';

dotenv.config({ path: path.resolve(__dirname, '.env') });

// Suppress "NO_COLOR env is ignored due to FORCE_COLOR" warning
delete process.env.NO_COLOR;

function parsePersonas() {
  const personas = loadPersonas();
  const basePersonas = personas.length === 0 
    ? [{ name: 'default', use: {} }] 
    : personas.map((p) => ({
        name: p.name,
        use: {
          persona: p.name,
          profile: p.expected?.profile || p.name,
          sfAlias: p.alias,
          sfUsername: p.username,
          expectedProfile: p.expected?.profile,
          expectedRole: p.expected?.role,
          expectedPS: p.expected?.permissionSets,
        } as any,
      }));

  if (process.env.USE_BROWSERSTACK === 'true') {
    const isBS = !!process.env.BROWSERSTACK_USERNAME;
    if (!isBS) {
      console.warn('USE_BROWSERSTACK is true but BROWSERSTACK_USERNAME is missing');
    }
    const bsProjects: any[] = [];
    for (const bp of basePersonas) {
      // 1. Chrome Cloud
      bsProjects.push({
        name: `${bp.name}-chrome-cloud`,
        use: {
          ...bp.use,
          connectOptions: {
            wsEndpoint: `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify({
              'browser': 'chrome',
              'browser_version': 'latest',
              'os': 'Windows',
              'os_version': '11',
              'browserstack.username': process.env.BROWSERSTACK_USERNAME,
              'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY,
            }))}`,
          },
        },
      });
      // 2. Safari Cloud
      bsProjects.push({
        name: `${bp.name}-safari-cloud`,
        use: {
          ...bp.use,
          connectOptions: {
            wsEndpoint: `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify({
              'browser': 'playwright-webkit',
              'browser_version': 'latest',
              'os': 'OS X',
              'os_version': 'Ventura',
              'browserstack.username': process.env.BROWSERSTACK_USERNAME,
              'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY,
            }))}`,
          },
        },
      });
      // 3. Mobile iOS
      bsProjects.push({
        name: `${bp.name}-mobile-ios`,
        use: {
          ...bp.use,
          connectOptions: {
            wsEndpoint: `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify({
              'browser': 'playwright-webkit',
              'device': 'iPhone 14',
              'os': 'ios',
              'os_version': '16',
              'realMobile': 'true',
              'browserstack.username': process.env.BROWSERSTACK_USERNAME,
              'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY,
            }))}`,
          },
        },
      });
    }
    return bsProjects;
  }

  return basePersonas;
}

export default defineConfig({
  testDir: '.',
  timeout: 120_000,

  /**
   * Parallel execution is now enabled by default.
   * Each persona (Playwright project) runs as an independent worker
   * with its own auth session and QA_PREFIX namespace.
   *
   * Worker isolation is handled via workerIndex-based QA_PREFIX
   * in sf-helpers.ts → qaPrefix().
   */
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: parseInt(process.env.WORKERS || '3', 10),

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['./reporters/rca-excel-reporter.ts'],
  ],

  use: {
    headless: process.env.HEADED !== 'true',
    channel: 'chrome',
    viewport: { width: 1920, height: 1080 },
    actionTimeout: parseInt(process.env.E2E_ACTION_TIMEOUT_MS || '15000', 10),
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'off',
    baseURL: resolveSalesforceBaseUrl() || undefined,
  },

  expect: {
    timeout: 15_000,
    /** Visual regression config — snapshot directory for toHaveScreenshot */
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
    },
  },

  /** Snapshot storage for visual regression */
  snapshotDir: 'snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',

  projects: parsePersonas(),

  outputDir: 'test-results',

  /** Global setup — validates environment and prepares test infrastructure */
  globalSetup: './utils/global-setup.ts',

  /** Global teardown — runs cleanup for any orphaned test data */
  globalTeardown: './utils/global-teardown.ts',
});
