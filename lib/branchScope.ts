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
