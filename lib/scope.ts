// ─── Module (appType) scoping — single source of truth ──────────────────────
//
// Many tables carry an `app_type` column so one tenant can run several modules
// (microlending / autofinance / chitfunds / goldloan) with isolated data. The
// recurring bug class is a query that filters by `tenantId` but FORGETS
// `appType`, so one module's list/accounting/wallet bleeds into another's view.
//
// Put `appType` in the where-clause for every model below. The dev-only tripwire
// in `lib/db.ts` warns if a list/aggregate query on a money-bearing scoped model
// omits it.
//
// There is deliberately no `appScope(appType)` helper. One existed and reached
// zero call sites, because `{ tenantId, appType }` is already the shortest and
// most greppable spelling — a wrapper returning `{ appType }` earned nothing and
// left the codebase advertising a convention nobody followed.

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

