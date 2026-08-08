/**
 * Pure branch-scoping helpers. Kept dependency-free so JWT-authenticated
 * mobile routes can use them without pulling NextAuth/next-headers in.
 */

/**
 * Where-fragment matching a branch **plus** records that have no branch at all.
 * Unbranched rows are reviewable by anyone in the tenant, so scoping them out
 * left them visible to superadmins (unscoped) but invisible to branch admins.
 * Returns `{}` when no branch is active, i.e. tenant-wide.
 */
export function branchOrUnassignedWhere(branchId?: string | null) {
  if (!branchId) return {};
  return { OR: [{ branchId }, { branchId: null }] };
}

/**
 * Like {@link branchOrUnassignedWhere}, but also reaches records filed by staff
 * sitting on `branchId`.
 *
 * A record's branch and its filer's branch can differ: a customer inherits the
 * BRANCH OF ITS ROUTE, so an agent on branch A working a route in branch B files
 * customers onto B. Scoping only by the record's own branch left those reachable
 * by no admin at all — branch A's admin (who manages the agent) was filtered out
 * by the record's branch, and branch B's admin may not exist. Only superadmins,
 * who are never branch-filtered, ever saw them.
 *
 * `filerRelation` is the relation holding the staff member who filed the record
 * — `agent` on Customer, `createdBy` on Loan.
 */
export function branchReachWhere(branchId?: string | null, filerRelation?: string) {
  if (!branchId) return {};
  const clauses: any[] = [{ branchId }, { branchId: null }];
  if (filerRelation) clauses.push({ [filerRelation]: { branchId } });
  return { OR: clauses };
}
