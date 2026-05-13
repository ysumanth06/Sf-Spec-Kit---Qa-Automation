import type { Connection } from 'jsforce';

/**
 * All PermissionSet Ids for a user: direct assignments + all PS ids from assigned Permission Set Groups.
 */
export async function collectExpandedPermissionSetIds(
  conn: Connection,
  userId: string,
): Promise<string[]> {
  const ids = new Set<string>();

  const direct = await conn.query<{ PermissionSetId: string }>(
    `SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = '${userId}'`,
  );
  for (const r of direct.records) {
    if (r.PermissionSetId) ids.add(r.PermissionSetId);
  }

  try {
    const psgRows = await conn.query<{ PermissionSetGroupId: string }>(
      `SELECT PermissionSetGroupId FROM PermissionSetGroupAssignment WHERE AssigneeId = '${userId}'`,
    );
    for (const row of psgRows.records) {
      const gid = row.PermissionSetGroupId;
      if (!gid) continue;
      const comps = await conn.query<{ PermissionSetId: string }>(
        `SELECT PermissionSetId FROM PermissionSetGroupComponent WHERE PermissionSetGroupId = '${gid}'`,
      );
      for (const c of comps.records) {
        if (c.PermissionSetId) ids.add(c.PermissionSetId);
      }
    }
  } catch {
    // PermissionSetGroupAssignment unavailable in some orgs / API versions — direct PS assignments only
  }

  return [...ids];
}
