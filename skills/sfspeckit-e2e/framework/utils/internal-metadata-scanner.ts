import * as fs from 'fs';
import * as path from 'path';
import jsforce, { type Connection } from 'jsforce';
import { getAdminConnection, type Persona } from './auth';
import { collectExpandedPermissionSetIds } from './permission-sets';

const CACHE_DIR = path.resolve(__dirname, '..', 'metadata-cache');

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface FieldPermission {
  Field: string;
  SobjectType: string;
  PermissionsEdit: boolean;
  PermissionsRead: boolean;
  Parent: { Profile?: { Name: string }; Label?: string; IsOwnedByProfile?: boolean };
}

export interface ObjectPermission {
  SobjectType: string;
  PermissionsCreate: boolean;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
  Parent: { Profile?: { Name: string }; Label?: string; IsOwnedByProfile?: boolean };
}

export interface ValidationRuleInfo {
  Id: string;
  ValidationName: string;
  EntityDefinitionId: string;
  EntityDefinition?: { QualifiedApiName: string };
  Active: boolean;
  ErrorMessage: string;
  ErrorDisplayField?: string;
  Description?: string;
  Metadata?: { errorConditionFormula: string };
}

export interface PicklistInfo {
  fieldApiName: string;
  objectApiName: string;
  values: PicklistValue[];
  controllerName?: string;
  isDependentPicklist: boolean;
}

export interface PicklistValue {
  label: string;
  value: string;
  isActive: boolean;
  isDefaultValue: boolean;
}

export interface RecordTypeInfo {
  Id: string;
  Name: string;
  DeveloperName: string;
  SobjectType: string;
  IsActive: boolean;
  Description?: string;
}

export interface TabVisibility {
  Name: string;
  Visibility: string;
  Profile: string;
}

export interface ProfileLayoutAssignment {
  Layout: { Name: string };
  RecordType?: { Name: string; DeveloperName: string };
  Profile: { Name: string };
}

export interface SharingRuleInfo {
  Id: string;
  DeveloperName: string;
  SobjectType: string;
  Description?: string;
}

export interface RoleInfo {
  Id: string;
  Name: string;
  DeveloperName: string;
  ParentRoleId?: string;
}

export interface FlowInfo {
  Id: string;
  ApiName: string;
  Label: string;
  ProcessType: string;
  Status: string;
  Description?: string;
}

export interface OrgMetadata {
  objects: string[];
  profiles: string[];
  fieldPermissions: FieldPermission[];
  objectPermissions: ObjectPermission[];
  validationRules: ValidationRuleInfo[];
  picklists: PicklistInfo[];
  recordTypes: RecordTypeInfo[];
  tabVisibilities: TabVisibility[];
  layoutAssignments: ProfileLayoutAssignment[];
  sharingRules: SharingRuleInfo[];
  roles: RoleInfo[];
  flows: FlowInfo[];
  scannedAt: string;
}

// ═══════════════════════════════════════════════════════════
// Cache Management
// ═══════════════════════════════════════════════════════════

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(objects: string[]): string {
  return objects.sort().join('_').replace(/[^a-zA-Z0-9_]/g, '');
}

export function getCachedMetadata(objects: string[]): OrgMetadata | null {
  ensureCacheDir();
  const file = path.join(CACHE_DIR, `${cacheKey(objects)}.json`);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveCache(objects: string[], data: OrgMetadata): void {
  ensureCacheDir();
  const file = path.join(CACHE_DIR, `${cacheKey(objects)}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════════════
// Metadata Queries
// ═══════════════════════════════════════════════════════════

export async function queryFieldPermissions(
  conn: Connection,
  objects: string[]
): Promise<FieldPermission[]> {
  const objectFilter = objects.map((o) => `'${o}'`).join(',');
  const query = `
    SELECT Field, SobjectType, PermissionsEdit, PermissionsRead,
           Parent.Profile.Name, Parent.Label, Parent.IsOwnedByProfile
    FROM FieldPermissions
    WHERE SobjectType IN (${objectFilter})
    ORDER BY SobjectType, Field
  `;

  const result = await conn.query<FieldPermission>(query);
  return result.records;
}

export async function queryObjectPermissions(
  conn: Connection,
  objects: string[]
): Promise<ObjectPermission[]> {
  const objectFilter = objects.map((o) => `'${o}'`).join(',');
  const query = `
    SELECT SobjectType, PermissionsCreate, PermissionsRead, PermissionsEdit,
           PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords,
           Parent.Profile.Name, Parent.Label, Parent.IsOwnedByProfile
    FROM ObjectPermissions
    WHERE SobjectType IN (${objectFilter})
    ORDER BY SobjectType
  `;

  const result = await conn.query<ObjectPermission>(query);
  return result.records;
}

export async function queryValidationRules(
  conn: Connection,
  objects: string[]
): Promise<ValidationRuleInfo[]> {
  const objectFilter = objects.map((o) => `'${o}'`).join(',');
  const query = `
    SELECT Id, ValidationName, EntityDefinitionId,
           EntityDefinition.QualifiedApiName, Active,
           ErrorMessage, ErrorDisplayField, Description
    FROM ValidationRule
    WHERE EntityDefinition.QualifiedApiName IN (${objectFilter})
      AND Active = true
    ORDER BY EntityDefinition.QualifiedApiName, ValidationName
  `;

  try {
    const result = await conn.query<ValidationRuleInfo>(query);
    return result.records;
  } catch {
    console.warn('Could not query ValidationRule (Tooling API may be needed).');
    return [];
  }
}

export async function queryPicklistValues(
  conn: Connection,
  objects: string[]
): Promise<PicklistInfo[]> {
  const picklists: PicklistInfo[] = [];

  for (const objectName of objects) {
    try {
      const describe = await conn.describe(objectName);
      for (const field of describe.fields) {
        if (field.type === 'picklist' || field.type === 'multipicklist') {
          picklists.push({
            fieldApiName: field.name,
            objectApiName: objectName,
            values: (field.picklistValues || []).map((pv: any) => ({
              label: pv.label || pv.value,
              value: pv.value,
              isActive: pv.active,
              isDefaultValue: pv.defaultValue,
            })),
            controllerName: (field as any).controllerName || undefined,
            isDependentPicklist: !!(field as any).controllerName,
          });
        }
      }
    } catch (err) {
      console.warn(`Could not describe ${objectName}: ${err}`);
    }
  }

  return picklists;
}

export async function queryRecordTypes(
  conn: Connection,
  objects: string[]
): Promise<RecordTypeInfo[]> {
  const objectFilter = objects.map((o) => `'${o}'`).join(',');
  const query = `
    SELECT Id, Name, DeveloperName, SobjectType, IsActive, Description
    FROM RecordType
    WHERE SobjectType IN (${objectFilter}) AND IsActive = true
    ORDER BY SobjectType, Name
  `;

  const result = await conn.query<RecordTypeInfo>(query);
  return result.records;
}

export async function queryTabVisibilities(
  conn: Connection,
  profiles: string[]
): Promise<TabVisibility[]> {
  const visibilities: TabVisibility[] = [];

  for (const profileName of profiles) {
    try {
      const result = await conn.metadata.read('Profile', profileName) as any;
      if (result && result.tabVisibilities) {
        const tabs = Array.isArray(result.tabVisibilities)
          ? result.tabVisibilities
          : [result.tabVisibilities];

        for (const tab of tabs) {
          visibilities.push({
            Name: tab.tab,
            Visibility: tab.visibility,
            Profile: profileName,
          });
        }
      }
    } catch (err) {
      console.warn(`Could not read profile tabs for ${profileName}: ${err}`);
    }
  }

  return visibilities;
}

export async function queryFlows(conn: Connection): Promise<FlowInfo[]> {
  const query = `
    SELECT Id, ApiName, Label, ProcessType, Description
    FROM FlowDefinitionView
    WHERE IsActive = true
    ORDER BY ProcessType, Label
  `;

  try {
    const result = await conn.query<any>(query);
    return result.records.map((r: any) => ({
      Id: r.Id,
      ApiName: r.ApiName,
      Label: r.Label,
      ProcessType: r.ProcessType,
      Status: 'Active',
      Description: r.Description,
    }));
  } catch {
    console.warn('Could not query FlowDefinitionView.');
    return [];
  }
}

export async function queryRoles(conn: Connection): Promise<RoleInfo[]> {
  const query = `SELECT Id, Name, DeveloperName, ParentRoleId FROM UserRole ORDER BY Name`;
  const result = await conn.query<RoleInfo>(query);
  return result.records;
}

export async function querySharingRules(
  conn: Connection,
  objects: string[]
): Promise<SharingRuleInfo[]> {
  const rules: SharingRuleInfo[] = [];

  for (const objectName of objects) {
    try {
      const sharingSuffix = objectName.endsWith('__c')
        ? objectName.replace('__c', '__Share')
        : `${objectName}Share`;

      const query = `SELECT Id, RowCause FROM ${sharingSuffix} WHERE RowCause != 'Owner' LIMIT 1`;
      await conn.query(query);

      rules.push({
        Id: objectName,
        DeveloperName: `${objectName}_sharing`,
        SobjectType: objectName,
        Description: `Sharing rules for ${objectName}`,
      });
    } catch {
      // object may not have sharing enabled
    }
  }

  return rules;
}

export async function queryLayoutAssignments(
  conn: Connection,
  profiles: string[]
): Promise<ProfileLayoutAssignment[]> {
  const assignments: ProfileLayoutAssignment[] = [];

  for (const profileName of profiles) {
    try {
      const result = await conn.metadata.read('Profile', profileName) as any;
      if (result && result.layoutAssignments) {
        const layoutList = Array.isArray(result.layoutAssignments)
          ? result.layoutAssignments
          : [result.layoutAssignments];

        for (const la of layoutList) {
          assignments.push({
            Layout: { Name: la.layout },
            RecordType: la.recordType
              ? { Name: la.recordType, DeveloperName: la.recordType }
              : undefined,
            Profile: { Name: profileName },
          });
        }
      }
    } catch (err) {
      console.warn(`Could not read layout assignments for ${profileName}: ${err}`);
    }
  }

  return assignments;
}

// ═══════════════════════════════════════════════════════════
// Full Scan
// ═══════════════════════════════════════════════════════════

export interface ScanOptions {
  objects: string[];
  profiles?: string[];
  refresh?: boolean;
}

export async function scanOrgMetadata(options: ScanOptions): Promise<OrgMetadata> {
  const { objects, profiles: inputProfiles, refresh } = options;

  if (!refresh) {
    const cached = getCachedMetadata(objects);
    if (cached) {
      console.log(`Using cached metadata (scanned at ${cached.scannedAt})`);
      return cached;
    }
  }

  console.log(`Scanning QA org metadata for: ${objects.join(', ')}...`);
  const conn = await getAdminConnection();

  const profiles = inputProfiles || [
    'System Administrator',
    'Standard User',
    'Read Only',
  ];

  console.log('  Querying field permissions...');
  const fieldPermissions = await queryFieldPermissions(conn, objects);

  console.log('  Querying object permissions...');
  const objectPermissions = await queryObjectPermissions(conn, objects);

  console.log('  Querying validation rules...');
  const validationRules = await queryValidationRules(conn, objects);

  console.log('  Querying picklist values...');
  const picklists = await queryPicklistValues(conn, objects);

  console.log('  Querying record types...');
  const recordTypes = await queryRecordTypes(conn, objects);

  console.log('  Querying tab visibilities...');
  const tabVisibilities = await queryTabVisibilities(conn, profiles);

  console.log('  Querying layout assignments...');
  const layoutAssignments = await queryLayoutAssignments(conn, profiles);

  console.log('  Querying flows...');
  const flows = await queryFlows(conn);

  console.log('  Querying roles...');
  const roles = await queryRoles(conn);

  console.log('  Querying sharing rules...');
  const sharingRules = await querySharingRules(conn, objects);

  const metadata: OrgMetadata = {
    objects,
    profiles,
    fieldPermissions,
    objectPermissions,
    validationRules,
    picklists,
    recordTypes,
    tabVisibilities,
    layoutAssignments,
    sharingRules,
    roles,
    flows,
    scannedAt: new Date().toISOString(),
  };

  saveCache(objects, metadata);
  console.log(`Metadata scan complete. Cached for future runs.`);
  return metadata;
}

// ═══════════════════════════════════════════════════════════
// Metadata Diff (Drift Detection)
// ═══════════════════════════════════════════════════════════

export interface MetadataDiff {
  addedFields: string[];
  removedFields: string[];
  changedFLS: string[];
  addedVRs: string[];
  removedVRs: string[];
  addedPicklistValues: string[];
  removedPicklistValues: string[];
  addedRecordTypes: string[];
  removedRecordTypes: string[];
}

export function compareMetadata(
  previous: OrgMetadata,
  current: OrgMetadata
): MetadataDiff {
  const prevFields = new Set(previous.fieldPermissions.map((f) => f.Field));
  const currFields = new Set(current.fieldPermissions.map((f) => f.Field));

  const addedFields = [...currFields].filter((f) => !prevFields.has(f));
  const removedFields = [...prevFields].filter((f) => !currFields.has(f));

  const changedFLS: string[] = [];
  for (const curr of current.fieldPermissions) {
    const prev = previous.fieldPermissions.find(
      (p) =>
        p.Field === curr.Field &&
        p.Parent?.Profile?.Name === curr.Parent?.Profile?.Name
    );
    if (prev && (prev.PermissionsEdit !== curr.PermissionsEdit || prev.PermissionsRead !== curr.PermissionsRead)) {
      changedFLS.push(
        `${curr.Field} (${curr.Parent?.Profile?.Name}): ` +
        `read ${prev.PermissionsRead} → ${curr.PermissionsRead}, ` +
        `edit ${prev.PermissionsEdit} → ${curr.PermissionsEdit}`
      );
    }
  }

  const prevVRs = new Set(previous.validationRules.map((v) => v.ValidationName));
  const currVRs = new Set(current.validationRules.map((v) => v.ValidationName));
  const addedVRs = [...currVRs].filter((v) => !prevVRs.has(v));
  const removedVRs = [...prevVRs].filter((v) => !currVRs.has(v));

  const prevPicklists = new Set(
    previous.picklists.flatMap((p) =>
      p.values.map((v) => `${p.objectApiName}.${p.fieldApiName}:${v.value}`)
    )
  );
  const currPicklists = new Set(
    current.picklists.flatMap((p) =>
      p.values.map((v) => `${p.objectApiName}.${p.fieldApiName}:${v.value}`)
    )
  );
  const addedPicklistValues = [...currPicklists].filter((v) => !prevPicklists.has(v));
  const removedPicklistValues = [...prevPicklists].filter((v) => !currPicklists.has(v));

  const prevRTs = new Set(previous.recordTypes.map((r) => `${r.SobjectType}.${r.DeveloperName}`));
  const currRTs = new Set(current.recordTypes.map((r) => `${r.SobjectType}.${r.DeveloperName}`));
  const addedRecordTypes = [...currRTs].filter((r) => !prevRTs.has(r));
  const removedRecordTypes = [...prevRTs].filter((r) => !currRTs.has(r));

  return {
    addedFields,
    removedFields,
    changedFLS,
    addedVRs,
    removedVRs,
    addedPicklistValues,
    removedPicklistValues,
    addedRecordTypes,
    removedRecordTypes,
  };
}

export function printDiff(diff: MetadataDiff): void {
  const hasChanges =
    diff.addedFields.length > 0 ||
    diff.removedFields.length > 0 ||
    diff.changedFLS.length > 0 ||
    diff.addedVRs.length > 0 ||
    diff.removedVRs.length > 0 ||
    diff.addedPicklistValues.length > 0 ||
    diff.removedPicklistValues.length > 0 ||
    diff.addedRecordTypes.length > 0 ||
    diff.removedRecordTypes.length > 0;

  if (!hasChanges) {
    console.log('No metadata drift detected.');
    return;
  }

  console.log('\n=== METADATA DRIFT DETECTED ===\n');

  if (diff.addedFields.length > 0) {
    console.log(`+ ${diff.addedFields.length} new field(s):`);
    diff.addedFields.forEach((f) => console.log(`  + ${f}`));
  }
  if (diff.removedFields.length > 0) {
    console.log(`- ${diff.removedFields.length} removed field(s):`);
    diff.removedFields.forEach((f) => console.log(`  - ${f}`));
  }
  if (diff.changedFLS.length > 0) {
    console.log(`~ ${diff.changedFLS.length} FLS change(s):`);
    diff.changedFLS.forEach((c) => console.log(`  ~ ${c}`));
  }
  if (diff.addedVRs.length > 0) {
    console.log(`+ ${diff.addedVRs.length} new validation rule(s):`);
    diff.addedVRs.forEach((v) => console.log(`  + ${v}`));
  }
  if (diff.removedVRs.length > 0) {
    console.log(`- ${diff.removedVRs.length} removed validation rule(s):`);
    diff.removedVRs.forEach((v) => console.log(`  - ${v}`));
  }
  if (diff.addedPicklistValues.length > 0) {
    console.log(`+ ${diff.addedPicklistValues.length} new picklist value(s):`);
    diff.addedPicklistValues.forEach((p) => console.log(`  + ${p}`));
  }
  if (diff.removedPicklistValues.length > 0) {
    console.log(`- ${diff.removedPicklistValues.length} removed picklist value(s):`);
    diff.removedPicklistValues.forEach((p) => console.log(`  - ${p}`));
  }
  if (diff.addedRecordTypes.length > 0) {
    console.log(`+ ${diff.addedRecordTypes.length} new record type(s):`);
    diff.addedRecordTypes.forEach((r) => console.log(`  + ${r}`));
  }
  if (diff.removedRecordTypes.length > 0) {
    console.log(`- ${diff.removedRecordTypes.length} removed record type(s):`);
    diff.removedRecordTypes.forEach((r) => console.log(`  - ${r}`));
  }
}

// ═══════════════════════════════════════════════════════════
// Persona setup & effective permissions (Profile + Permission Sets)
// PSG components can be added in a later iteration.
// ═══════════════════════════════════════════════════════════

export interface PersonaSetup {
  userId: string;
  username: string;
  profileId: string;
  profileName: string;
  roleName: string | null;
  permissionSetNames: string[];
}

export interface EffectiveObjectPermission {
  SobjectType: string;
  PermissionsCreate: boolean;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
}

export interface EffectiveFieldPermission {
  SobjectType: string;
  Field: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
}

export interface EffectivePermissions {
  personaName: string;
  objectAccess: EffectiveObjectPermission[];
  fieldAccess: EffectiveFieldPermission[];
}

function mergeBool(a: boolean, b: boolean): boolean {
  return a || b;
}

function mergeObjectPerms(
  rows: Array<{
    SobjectType: string;
    PermissionsCreate: boolean;
    PermissionsRead: boolean;
    PermissionsEdit: boolean;
    PermissionsDelete: boolean;
    PermissionsViewAllRecords: boolean;
    PermissionsModifyAllRecords: boolean;
  }>,
): Map<string, EffectiveObjectPermission> {
  const map = new Map<string, EffectiveObjectPermission>();
  for (const r of rows) {
    const key = r.SobjectType;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...r });
    } else {
      map.set(key, {
        SobjectType: r.SobjectType,
        PermissionsCreate: mergeBool(prev.PermissionsCreate, r.PermissionsCreate),
        PermissionsRead: mergeBool(prev.PermissionsRead, r.PermissionsRead),
        PermissionsEdit: mergeBool(prev.PermissionsEdit, r.PermissionsEdit),
        PermissionsDelete: mergeBool(prev.PermissionsDelete, r.PermissionsDelete),
        PermissionsViewAllRecords: mergeBool(
          prev.PermissionsViewAllRecords,
          r.PermissionsViewAllRecords,
        ),
        PermissionsModifyAllRecords: mergeBool(
          prev.PermissionsModifyAllRecords,
          r.PermissionsModifyAllRecords,
        ),
      });
    }
  }
  return map;
}

function mergeFieldPerms(
  rows: Array<{
    SobjectType: string;
    Field: string;
    PermissionsRead: boolean;
    PermissionsEdit: boolean;
  }>,
): Map<string, EffectiveFieldPermission> {
  const map = new Map<string, EffectiveFieldPermission>();
  for (const r of rows) {
    const key = `${r.SobjectType}.${r.Field}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...r });
    } else {
      map.set(key, {
        SobjectType: r.SobjectType,
        Field: r.Field,
        PermissionsRead: mergeBool(prev.PermissionsRead, r.PermissionsRead),
        PermissionsEdit: mergeBool(prev.PermissionsEdit, r.PermissionsEdit),
      });
    }
  }
  return map;
}

/**
 * Query live Profile, Role, and assigned Permission Sets for a user.
 */
export async function queryPersonaSetup(
  conn: Connection,
  username: string,
): Promise<PersonaSetup | null> {
  const escaped = username.replace(/'/g, "\\'");
  const uq = await conn.query<{
    Id: string;
    Username: string;
    ProfileId: string;
    Profile: { Name: string };
    UserRole?: { Name: string } | null;
  }>(
    `SELECT Id, Username, ProfileId, Profile.Name, UserRole.Name FROM User WHERE Username = '${escaped}' LIMIT 1`,
  );
  if (uq.records.length === 0) return null;
  const u = uq.records[0];
  const psq = await conn.query<{ PermissionSet: { Name: string } }>(
    `SELECT PermissionSet.Name FROM PermissionSetAssignment WHERE AssigneeId = '${u.Id}'`,
  );
  const permissionSetNames = psq.records.map((r) => r.PermissionSet.Name).filter(Boolean);
  return {
    userId: u.Id,
    username: u.Username,
    profileId: u.ProfileId,
    profileName: u.Profile.Name,
    roleName: u.UserRole?.Name ?? null,
    permissionSetNames,
  };
}

/**
 * Union of ObjectPermissions and FieldPermissions from Profile + Permission Sets
 * (including Permission Set Groups via PermissionSetGroupAssignment + PermissionSetGroupComponent).
 */
export async function queryEffectivePermissions(
  conn: Connection,
  persona: Persona,
): Promise<EffectivePermissions> {
  const setup = await queryPersonaSetup(conn, persona.username);
  if (!setup) {
    return { personaName: persona.name, objectAccess: [], fieldAccess: [] };
  }

  const psIds = await collectExpandedPermissionSetIds(conn, setup.userId);
  const parentIds = [setup.profileId, ...psIds].filter(Boolean) as string[];

  if (parentIds.length === 0) {
    return { personaName: persona.name, objectAccess: [], fieldAccess: [] };
  }

  const inList = parentIds.map((id) => `'${id}'`).join(',');
  const opQ = await conn.query<{
    SobjectType: string;
    PermissionsCreate: boolean;
    PermissionsRead: boolean;
    PermissionsEdit: boolean;
    PermissionsDelete: boolean;
    PermissionsViewAllRecords: boolean;
    PermissionsModifyAllRecords: boolean;
  }>(
    `SELECT SobjectType, PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId IN (${inList})`,
  );

  const fpQ = await conn.query<{
    SobjectType: string;
    Field: string;
    PermissionsRead: boolean;
    PermissionsEdit: boolean;
  }>(
    `SELECT SobjectType, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ParentId IN (${inList})`,
  );

  return {
    personaName: persona.name,
    objectAccess: [...mergeObjectPerms(opQ.records).values()],
    fieldAccess: [...mergeFieldPerms(fpQ.records).values()],
  };
}

export { normalizeFieldApiName } from './selectors';
