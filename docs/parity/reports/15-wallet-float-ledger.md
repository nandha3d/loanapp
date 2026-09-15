# 15 · Wallet Float Ledger 💎

**Status:** 🆕 NEW · **Module scope:** all (agent cash float) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Agent cash-float ledger — float released to agents, collections added, deposits returned, current balance per
agent. Reconciles cash-in-hand across the field force. Wallet endpoints exist; no rollup report yet.

## 2. Source models (READ ONLY)
- `WalletTransaction` / agent-account models (existing `wallet/*`): release, collection, deposit entries.
- `User` (`:123`) agents; `BranchCashAccount` for branch float.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Opening Float | `opening` | currency | right | ✓ |
| Released | `released` | currency | right | ✓ |
| Collected (in) | `collected` | currency | right | ✓ |
| Deposited (out) | `deposited` | currency | right | ✓ |
| Closing Balance | `closing` | currency | right | ✓ |

## 4. KPI cards
Total float outstanding · agents holding cash · largest balance · undeposited cash.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/wallet-float-ledger?from&to&branchId?&agentId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/wallet-float-ledger.ts`)
Per agent (scoped): opening before `from`; sum released/collected/deposited in range from `WalletTransaction`;
closing = opening + released + collected − deposited.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `wallet-float-ledger-<from>-to-<to>`.

## 9. i18n keys
`reports.walletFloatLedger.title`, `reports.col.opening|released|collected|deposited|closing`.

## 10. RBAC + subscription
Admin/owner/cashier; agent sees own. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over `WalletTransaction`. No writes, no new columns, no float release/deposit from report.
`WalletTransaction` is a MONEY_SCOPED model — ensure `appScope` to avoid cross-module float leak (see
[[module-apptype-isolation]]).

## 12. No-hardcode checklist
- [ ] Transaction types from existing enum. Currency/labels from DB/i18n.

## 13. Test plan
Seed release/collect/deposit transactions → assert closing = opening + in − out per agent; export matches;
cross-module isolation holds.
