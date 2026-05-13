import jsforce, { type Connection } from 'jsforce';
import { getAdminConnection, getJwtConnection } from './auth';
import { qaPrefix } from './sf-helpers';

/**
 * Sanitize a string for safe use in SOQL LIKE clauses.
 * Escapes single quotes and backslashes to prevent SOQL injection.
 */
function sanitizeForSoql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export interface TestRecord {
  id: string;
  objectType: string;
  name: string;
}

const createdRecords: TestRecord[] = [];

export async function createTestRecord(
  conn: Connection,
  objectType: string,
  fields: Record<string, any>,
  nameField = 'Name'
): Promise<TestRecord> {
  const prefix = qaPrefix();
  if (fields[nameField] && !fields[nameField].startsWith(prefix)) {
    fields[nameField] = `${prefix}-${fields[nameField]}`;
  }

  const result = await conn.sobject(objectType).create(fields);
  if (!result.success) {
    throw new Error(
      `Failed to create ${objectType}: ${JSON.stringify((result as any).errors)}`
    );
  }

  const record: TestRecord = {
    id: result.id!,
    objectType,
    name: fields[nameField] || result.id!,
  };
  createdRecords.push(record);
  return record;
}

/**
 * Abstracted Data Factory: Import complex relational data using the Salesforce CLI data tree format.
 * Executes: sf data tree import --plan <planFile> --json
 * Tracks the imported records so they are automatically cleaned up during teardown.
 */
export async function importDataTree(planFile: string): Promise<TestRecord[]> {
  const { execSync } = await import('child_process');
  const path = await import('path');
  const fs = await import('fs');

  const absolutePath = path.isAbsolute(planFile)
    ? planFile
    : path.resolve(__dirname, '..', planFile);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Data plan file not found: ${absolutePath}`);
  }

  const alias = process.env.E2E_ADMIN_ALIAS || '';
  const aliasFlag = alias ? `--target-org ${alias}` : '';
  const cmd = `sf data tree import --plan "${absolutePath}" --json ${aliasFlag}`;

  try {
    const stdout = execSync(cmd, { encoding: 'utf8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'] });
    const result = JSON.parse(stdout);

    const newRecords: TestRecord[] = [];
    if (result && result.result && Array.isArray(result.result)) {
      for (const item of result.result) {
        if (item.id && item.type) {
          const record: TestRecord = {
            id: item.id,
            objectType: item.type,
            name: item.referenceId || item.id,
          };
          createdRecords.push(record);
          newRecords.push(record);
        }
      }
    }
    return newRecords;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to import data tree: ${msg}`);
  }
}

export async function createTestAccount(
  conn: Connection,
  overrides: Record<string, any> = {}
): Promise<TestRecord> {
  return createTestRecord(conn, 'Account', {
    Name: 'Test Account',
    ...overrides,
  });
}

export async function createTestContact(
  conn: Connection,
  accountId: string,
  overrides: Record<string, any> = {}
): Promise<TestRecord> {
  return createTestRecord(conn, 'Contact', {
    LastName: `${qaPrefix()}-Test Contact`,
    AccountId: accountId,
    ...overrides,
  }, 'LastName');
}

export async function createBulkTestRecords(
  conn: Connection,
  objectType: string,
  records: Record<string, any>[],
  nameField = 'Name'
): Promise<TestRecord[]> {
  const prefix = qaPrefix();
  const prefixed = records.map((r) => {
    const rec = { ...r };
    if (rec[nameField] && !rec[nameField].startsWith(prefix)) {
      rec[nameField] = `${prefix}-${rec[nameField]}`;
    }
    return rec;
  });

  const results = await conn.sobject(objectType).create(prefixed);
  const resultArray = Array.isArray(results) ? results : [results];

  const created: TestRecord[] = [];
  for (let i = 0; i < resultArray.length; i++) {
    const res = resultArray[i];
    if (res.success) {
      const record: TestRecord = {
        id: res.id!,
        objectType,
        name: prefixed[i][nameField] || res.id!,
      };
      createdRecords.push(record);
      created.push(record);
    }
  }
  return created;
}

export async function cleanupTestRecords(conn?: Connection): Promise<number> {
  if (!conn) {
    conn = await getAdminConnection();
  }

  let deleted = 0;
  const prefix = qaPrefix();

  const objectTypes = [...new Set(createdRecords.map((r) => r.objectType))];
  for (const objectType of objectTypes) {
    const ids = createdRecords
      .filter((r) => r.objectType === objectType)
      .map((r) => r.id);

    if (ids.length > 0) {
      try {
        await conn.sobject(objectType).del(ids);
        deleted += ids.length;
      } catch (err) {
        console.warn(`Warning: Could not delete ${objectType} records: ${err}`);
      }
    }
  }

  createdRecords.length = 0;
  return deleted;
}

export async function cleanupByPrefix(
  conn?: Connection,
  objects?: string[]
): Promise<number> {
  if (!conn) {
    conn = await getAdminConnection();
  }

  const prefix = qaPrefix();
  const defaultObjects = ['Account', 'Contact', 'Case', 'Opportunity', 'Lead'];
  const targetObjects = objects || defaultObjects;
  let deleted = 0;

  for (const objectType of targetObjects) {
    try {
      const ids = new Set<string>();
      const safePrefix = sanitizeForSoql(prefix);
      if (objectType === 'Account') {
        for (const clause of [`Name LIKE '${safePrefix}-%'`, `LastName LIKE '${safePrefix}-%'`]) {
          const result = await conn.query<{ Id: string }>(
            `SELECT Id FROM Account WHERE ${clause} LIMIT 200`,
          );
          result.records.forEach((r) => ids.add(r.Id));
        }
      } else {
        const nameField = objectType === 'Case' ? 'Subject' : 'Name';
        const result = await conn.query<{ Id: string }>(
          `SELECT Id FROM ${objectType} WHERE ${nameField} LIKE '${safePrefix}-%' LIMIT 200`,
        );
        result.records.forEach((r) => ids.add(r.Id));
      }

      if (ids.size > 0) {
        const idList = [...ids];
        await conn.sobject(objectType).del(idList);
        deleted += idList.length;
        console.log(`  Deleted ${idList.length} ${objectType} records`);
      }
    } catch (err) {
      console.warn(`  Could not clean ${objectType}: ${err}`);
    }
  }

  return deleted;
}

export async function cleanupOlderThan(
  days: number,
  conn?: Connection,
  objects?: string[]
): Promise<number> {
  if (!conn) {
    conn = await getAdminConnection();
  }

  const prefix = qaPrefix();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  const defaultObjects = ['Account', 'Contact', 'Case', 'Opportunity', 'Lead'];
  const targetObjects = objects || defaultObjects;
  let deleted = 0;

  for (const objectType of targetObjects) {
    try {
      const ids = new Set<string>();
      const safePrefix = sanitizeForSoql(prefix);
      if (objectType === 'Account') {
        for (const clause of [
          `Name LIKE '${safePrefix}-%'`,
          `LastName LIKE '${safePrefix}-%'`,
        ]) {
          const result = await conn.query<{ Id: string }>(
            `SELECT Id FROM Account WHERE ${clause} AND CreatedDate < ${cutoff}T00:00:00Z LIMIT 200`,
          );
          result.records.forEach((r) => ids.add(r.Id));
        }
      } else {
        const nameField = objectType === 'Case' ? 'Subject' : 'Name';
        const result = await conn.query<{ Id: string }>(
          `SELECT Id FROM ${objectType} WHERE ${nameField} LIKE '${safePrefix}-%' AND CreatedDate < ${cutoff}T00:00:00Z LIMIT 200`,
        );
        result.records.forEach((r) => ids.add(r.Id));
      }

      if (ids.size > 0) {
        const idList = [...ids];
        await conn.sobject(objectType).del(idList);
        deleted += idList.length;
        console.log(`  Deleted ${idList.length} ${objectType} records older than ${days} days`);
      }
    } catch (err) {
      console.warn(`  Could not clean old ${objectType}: ${err}`);
    }
  }

  return deleted;
}

export function getCreatedRecords(): TestRecord[] {
  return [...createdRecords];
}

/** Register a record for cleanupTestRecords (e.g. after data-factory create). */
export function registerCreatedRecord(record: TestRecord): void {
  createdRecords.push(record);
}
