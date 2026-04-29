/**
 * global-teardown.ts — Playwright Global Teardown
 *
 * Runs after ALL test suites complete (even if tests fail).
 * Cleans up any orphaned QA-prefixed test records.
 */

import { cleanupByPrefix } from './test-data';
import { getAdminConnection } from './auth';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default async function globalTeardown(): Promise<void> {
  try {
    console.log('\n🧹 Global Teardown: Cleaning up orphaned test records...');
    const conn = await getAdminConnection();
    const deleted = await cleanupByPrefix(conn);
    if (deleted > 0) {
      console.log(`   ✅ Deleted ${deleted} orphaned test record(s)`);
    } else {
      console.log('   ✅ No orphaned records found');
    }
  } catch (err) {
    console.warn(`   ⚠️ Global cleanup failed (non-fatal): ${err}`);
  }
}
