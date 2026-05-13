/**
 * internal-soql-verifier.ts — Database Verification Engine
 *
 * Executes SOQL queries via the Salesforce CLI to prove that
 * UI actions actually persisted data to the database correctly.
 *
 * This is the internalized logic from the sf-soql skill,
 * embedded directly for zero-dependency operation.
 */

import { execSync } from 'child_process';

export interface VerifyResult {
  passed: boolean;
  query: string;
  expected: Record<string, any>;
  actual: Record<string, any> | null;
  errors: string[];
}

/**
 * Execute a SOQL query via `sf data query` and compare
 * the first returned record against expected field values.
 */
export async function verifyDatabase(
  query: string,
  expected: Record<string, any>,
): Promise<VerifyResult> {
  const alias = process.env.E2E_ADMIN_ALIAS || '';
  const errors: string[] = [];

  let actual: Record<string, any> | null = null;

  try {
    const aliasFlag = alias ? `--target-org ${alias}` : '';
    const cmd = `sf data query --query "${query.replace(/"/g, '\\"')}" --json ${aliasFlag}`;
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const result = JSON.parse(stdout);
    const records = result?.result?.records || [];

    if (records.length === 0) {
      errors.push('No records returned from SOQL query.');
      return { passed: false, query, expected, actual: null, errors };
    }

    const record = records[0];
    actual = record;

    // Compare each expected field
    for (const [field, expectedValue] of Object.entries(expected)) {
      const actualValue = record[field];

      if (expectedValue === '!= null') {
        if (actualValue === null || actualValue === undefined) {
          errors.push(`Field "${field}": expected non-null, got ${actualValue}`);
        }
      } else if (expectedValue === 'null') {
        if (actualValue !== null && actualValue !== undefined) {
          errors.push(`Field "${field}": expected null, got "${actualValue}"`);
        }
      } else if (String(actualValue) !== String(expectedValue)) {
        errors.push(
          `Field "${field}": expected "${expectedValue}", got "${actualValue}"`,
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`SOQL execution failed: ${msg}`);
  }

  return {
    passed: errors.length === 0,
    query,
    expected,
    actual,
    errors,
  };
}
