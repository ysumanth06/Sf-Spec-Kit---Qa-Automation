import type { Connection } from 'jsforce';

export interface SmartRecordOptions {
  /** Extra fields (override defaults) */
  fields?: Record<string, unknown>;
  recordTypeId?: string;
  namePrefix?: string;
}

let personAccountsEnabled: boolean | null = null;

export async function isPersonAccountEnabled(conn: Connection): Promise<boolean> {
  if (personAccountsEnabled !== null) return personAccountsEnabled;
  try {
    const d = await conn.sobject('Account').describe();
    const has = d.fields?.some((f: { name: string }) => f.name === 'IsPersonType') ?? false;
    personAccountsEnabled = has;
    return has;
  } catch {
    personAccountsEnabled = false;
    return false;
  }
}

function defaultForField(
  field: { name: string; type: string; label: string; nillable: boolean; createable: boolean },
  prefix: string,
): unknown {
  if (!field.createable) return undefined;
  const label = field.label || field.name;
  switch (field.type) {
    case 'string':
    case 'textarea':
    case 'url':
      return `${prefix}-${label}`.slice(0, 200);
    case 'email':
      return `${prefix.toLowerCase()}-test@example.com`;
    case 'phone':
      return '555-0100';
    case 'boolean':
      return false;
    case 'currency':
    case 'double':
    case 'int':
    case 'percent':
      return 1;
    case 'date':
      return new Date().toISOString().slice(0, 10);
    case 'datetime':
      return new Date().toISOString();
    default:
      return undefined;
  }
}

/**
 * Build create payload with required fields filled from describe; caller fields win.
 */
export async function buildSmartCreatePayload(
  conn: Connection,
  objectApiName: string,
  options: SmartRecordOptions = {},
): Promise<Record<string, unknown>> {
  const describe = await conn.sobject(objectApiName).describe();
  const prefix = options.namePrefix || process.env.QA_PREFIX || 'QA';
  const out: Record<string, unknown> = { ...(options.fields || {}) };

  const person = objectApiName === 'Account' && (await isPersonAccountEnabled(conn));
  if (person && !out['FirstName'] && !out['LastName']) {
    out['FirstName'] = `${prefix}`;
    out['LastName'] = `Test-${Date.now()}`;
  }

  for (const f of describe.fields) {
    if (!f.createable) continue;
    if (out[f.name] !== undefined) continue;
    if (f.name === 'RecordTypeId' && options.recordTypeId) {
      out[f.name] = options.recordTypeId;
      continue;
    }
    const required = !f.nillable && !f.defaultedOnCreate;
    if (required || (f.nillable === false && f.type !== 'boolean')) {
      const d = defaultForField(f, prefix);
      if (d !== undefined) out[f.name] = d;
    }
  }

  if (objectApiName !== 'Account' || !person) {
    const nameField =
      describe.fields?.find((f: { name: string }) => f.name === 'Name')?.name ||
      describe.fields?.find(
        (f: { name: string; type: string }) => f.type === 'string' && f.name.endsWith('Name'),
      )?.name ||
      'Name';
    if (out[nameField] === undefined && describe.fields?.some((x: { name: string }) => x.name === nameField)) {
      out[nameField] = `${prefix}-Smart ${objectApiName} ${Date.now()}`;
    }
  }

  return out;
}

export async function createSmartRecord(
  conn: Connection,
  objectApiName: string,
  options: SmartRecordOptions = {},
): Promise<{ id: string; fields: Record<string, unknown> }> {
  const fields = await buildSmartCreatePayload(conn, objectApiName, options);
  const result = await conn.sobject(objectApiName).create(fields);
  if (!result.success) {
    throw new Error(`createSmartRecord failed: ${JSON.stringify((result as any).errors)}`);
  }
  return { id: result.id!, fields };
}
