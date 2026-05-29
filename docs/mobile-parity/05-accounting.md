# 05 · Accounting — largest gap ❌

## Web scope
Basic accounting **plus a full premium suite** (`accounting/premium/*`):
journal (+new, +detail), chart of accounts (COA), P&L, balance sheet, trial balance,
bank reconciliation (+per-account workspace), budget, cashflow, tax, vendors,
period-lock, export, accounting approvals, settings.

## Mobile current
- Single `accounting/accounting_screen.dart` (~383 lines) — summary only.
- `GET /api/v1/accounting` exists (scope unknown — verify what it returns).

## Gaps
- ❌ Journal list / create / detail.
- ❌ COA browse.
- ❌ Financial statements: P&L, balance sheet, trial balance, cashflow.
- ❌ Bank reconciliation.
- ❌ Budget, tax, vendors, period-lock, export, approvals.

## Recommended phasing
- **P2 (read-only):** mobile views for P&L, balance sheet, trial balance, cashflow, journal list — all numbers from new read endpoints (no math in Dart).
- **P3 (write):** journal entry create, bank-rec, period-lock, etc.

## API needed (read-only first)
- `GET /api/v1/accounting/pnl`, `/balance-sheet`, `/trial-balance`, `/cashflow`, `/journal` (list), `/journal/[id]`, `/coa`. Each returns fully-computed figures (reuse the web's accounting calc libs server-side).

## Acceptance
- Mobile statement figures equal web for the same period/branch.

> **Needs line-by-line verification** of `accounting_screen.dart` and `GET /api/v1/accounting` to confirm exactly what's already covered.
