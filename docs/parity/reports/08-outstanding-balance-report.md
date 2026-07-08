# 08 · Outstanding Balance Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Total outstanding split into **Principal / Interest / Penalty** across the book (or per loan/customer/branch).
The "what's still owed to us" snapshot — core to provisioning and valuation.

## 2. Source models (READ ONLY)
- `Loan` (`:444`): `totalPayable`, `totalCollected`, `principal`. `Penalty` (`:561`) pending.
- Interest outstanding = remaining interest share; principal outstanding = remaining principal.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No / Group | `group` | text | left | |
| Customer | `customerName` | text | left | |
| Principal O/S | `principalOut` | currency | right | ✓ |
| Interest O/S | `interestOut` | currency | right | ✓ |
| Penalty O/S | `penaltyOut` | currency | right | ✓ |
| Total O/S | `totalOut` | currency | right | ✓ |

## 4. KPI cards
Total outstanding · principal vs interest split · penalty outstanding.

## 5. Filters
Branch, Agent, Loan Type, Group-by = loan|customer|branch, asOf.

## 6. API contract
`GET /api/v1/reports/outstanding-balance?asOf?&groupBy=loan|customer|branch&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/outstanding-balance.ts`)
Per loan (scoped): remaining = payable − collected; split into principal/interest by schedule ratio; add
pending penalty; group/aggregate to chosen dimension.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `outstanding-balance-<asOf>`.

## 9. i18n keys
`reports.outstandingBalance.title`, `reports.col.principalOut|interestOut|penaltyOut|totalOut`.

## 10. RBAC + subscription
Admin/owner/accountant; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Principal/interest split computed in builder — **no new columns**, no writes.

## 12. No-hardcode checklist
- [ ] Split ratio from schedule, not a constant. Currency/labels from DB/i18n.

## 13. Test plan
Seed loans partway paid + pending penalties → assert P/I/penalty split sums to total O/S; export matches.
