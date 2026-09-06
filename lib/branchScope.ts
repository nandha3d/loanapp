/**
 * Pure branch-scoping helpers. Kept dependency-free so JWT-authenticated
 * mobile routes can use them without pulling NextAuth/next-headers in.
 */

/**
 * Where-fragment restricting rows to a single branch. Returns `{}` when no
 * branch is active, i.e. tenant-wide (superadmin with "All Branches", or a
 * developer).
 *
 * A record belongs to exactly ONE branch: its own `branchId`. Nothing else may
 * widen that.
 *
 * This previously ORed in two extra arms — `{ branchId: null }` and
 * `{ <filer>: { branchId } }` — to surface records an admin "should" supervise.
 * Both leaked across branches:
 *
 *   - `{ branchId: null }` broadcast every unbranched customer/loan to EVERY
 *     branch at once.
 *   - `{ <filer>: { branchId } }` matched on the filer's CURRENT branch, so
 *     branch A's admin saw branch B's records whenever the filing agent sat on
 *     A — and moving an agent between branches silently moved their whole
 *     history with them.
 *
 * The case those arms were reaching for is real (a customer inherits the branch
 * of its ROUTE, so an agent can file onto a branch other than their own), but
 * it is a DATA problem, not a visibility one: the record's `branchId` is the
 * answer, and orphans are repaired by `scripts/backfill-customer-route-agent.js`.
 * Records that are still unbranched stay visible to superadmins only, which is
 * the safe direction to fail.
 */
export function branchScopeWhere(branchId?: string | null) {
  if (!branchId) return {};
  return { branchId };
}
