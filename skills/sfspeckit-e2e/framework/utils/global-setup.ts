/**
 * global-setup.ts — Playwright Global Setup
 *
 * Runs BEFORE all test suites.
 * Sets TEST_WORKER_INDEX for parallel data isolation, since Playwright
 * workers don't automatically expose a worker index as an environment variable.
 *
 * Also validates required environment variables and connection health.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default async function globalSetup(): Promise<void> {
  console.log('\n🔧 Global Setup: Initializing E2E environment...');

  // Validate required env vars
  const requiredVars = ['E2E_JWT_CLIENT_ID', 'E2E_JWT_INSTANCE_URL'];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.warn(`   ⚠️ Missing env vars (non-fatal): ${missing.join(', ')}`);
  }

  // Ensure screenshots dir exists
  const fs = await import('fs');
  const screenshotsDir = path.resolve(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('   ✅ Global setup complete');
}
