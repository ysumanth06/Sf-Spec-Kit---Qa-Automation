/**
 * cleanup.ts — Test Data Cleanup Utility
 *
 * Removes all QA-prefixed test records from the Salesforce org.
 * Supports cleaning by in-memory record tracking OR by prefix-based SOQL query.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { getAdminConnection } from './auth';
import { cleanupByPrefix, cleanupOlderThan, getCreatedRecords } from './test-data';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const days = args.find((a) => a.startsWith('--days='));
  const objects = args.find((a) => a.startsWith('--objects='));

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   SFSpeckit-E2E Test Data Cleanup            ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const prefix = process.env.QA_PREFIX || 'QA';
  console.log(`  Prefix: ${prefix}-*`);

  const conn = await getAdminConnection();

  const targetObjects = objects
    ? objects.replace('--objects=', '').split(',').map((o) => o.trim())
    : undefined;

  let deleted: number;

  if (days) {
    const daysNum = parseInt(days.replace('--days=', ''), 10);
    console.log(`  Mode: Delete records older than ${daysNum} day(s)`);
    deleted = await cleanupOlderThan(daysNum, conn, targetObjects);
  } else {
    console.log('  Mode: Delete all QA-prefixed records');
    deleted = await cleanupByPrefix(conn, targetObjects);
  }

  console.log(`\n  ✅ Deleted ${deleted} record(s)`);
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
