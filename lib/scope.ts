// ─── Module (appType) scoping — single source of truth ──────────────────────
//
// Many tables carry an `app_type` column so one tenant can run several modules
// (microlending / autofinance / chitfunds / goldloan) with isolated data. The
// recurring bug class is a query that filters by `tenantId` but FORGETS
// `appType`, so one module's list/accounting/wallet bleeds into another's view.
//
// Use `appScope(appType)` when building a where-clause for any model below, and
// the dev-only tripwire in `lib/db.ts` will warn if a list/aggregate query on a
// money-bearing scoped model omits it.

/** Models that own an `app_type` column and must be filtered by it on reads. */
export const SCOPED_MODELS = [
  'Branch',
  'Route',
  'Customer',
  'LoanPackage',
  'Loan',
  'Penalty',
  'DailyCollection',
  'SystemNotification',
  'ApprovalRequest',
  'Vehicle',
  'ChitGroup',
  'UserModule',
  'ModuleRequest',
  'CollectionRun',
  'AgentAccount',
  'BranchCashAccount',
  'WalletTransaction',
  'AccountEntry',
] as const;

/**
 * The money-bearing subset whose cross-module bleed is user-visible (lists,
 * accounting totals, wallet balances). The dev tripwire focuses here to stay
 * low-noise: a list/aggregate on one of these missing `appType` is almost
 * always the leak bug, not an intentional tenant-wide sweep.
 */
export const MONEY_SCOPED_MODELS = new Set<string>([
  'Loan',
  'Customer',
  'Penalty',
  'DailyCollection',
  'AccountEntry',
  'AgentAccount',
  'BranchCashAccount',
  'WalletTransaction',
]);

/**
 * Spread into a Prisma where-clause to scope it to the active module. Trivial by
 * design — its value is making the intent explicit and greppable at every call
 * site, so the next person doesn't drop it.
 *
 *   where: { tenantId, ...appScope(appType), status: 'active' }
 */
export function appScope(appType: string): { appType: string } {
  return { appType };
}
