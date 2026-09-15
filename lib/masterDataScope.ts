/**
 * Branch scoping for MASTER DATA — catalogue rows a branch may own privately or
 * publish tenant-wide.
 *
 * Deliberately NOT in `lib/branchScope.ts`. That file scopes transactional
 * records (customers, loans, routes, ledger rows) and is guarded by
 * `tests/branchScoping.test.ts` against exactly the `{ branchId: null }` arm
 * used here, because ORing unbranched rows into a transactional scope is what
 * broadcast one branch's customers to every branch. Keeping the exception in
 * its own file keeps that guard honest instead of loosening it.
 *
 * Only `LoanPackage` uses this today (SCOPE-11).
 */

/**
 * Rows owned by `branchId`, plus rows published tenant-wide (`branchId: null`).
 * `{}` — everything — when no branch is active, matching `branchScopeWhere`.
 *
 * A null branch is a real, chosen state here: "every branch sells this product".
 * It is NOT the safe reading for a customer or a loan, where an unbranched row
 * is a defect to repair with a backfill script (SCOPE-4). Do not reach for this
 * helper to make an orphaned transactional record visible again.
 */
export function branchOrSharedWhere(branchId?: string | null) {
  if (!branchId) return {};
  return { OR: [{ branchId }, { branchId: null }] };
}
