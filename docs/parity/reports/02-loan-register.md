# 02 · Loan Register

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
The master list of every loan in the tenant/module — the operator's primary "what loans do I have" view.
Owner/admin/manager use it daily for reconciliation; agents see only their scope.

## 2. Source models (READ ONLY)
- `Loan` (`prisma/schema.prisma:444`): `loanCode`, `customerId`, `loanType`, `principal`, `disbursed`,
  `totalPayable`, `totalCollected`, `frequency`, `startDate`, `endDate`, `status`, `perInstalment`,
  `totalInstalments`, `paidCount`, `penaltyRate`.
- `Customer` (`:283`): `name`, `customerCode` (join for display).
- Outstanding = `totalPayable − totalCollected` (computed, not stored as a new column).

## 3. On-screen table (columns drive screen + all exports)
| # | Column | key | type | align | total |
|---|---|---|---|---|---|
| 1 | Loan No | `loanCode` | text | left | |
| 2 | Customer | `customerName` | text | left | |
| 3 | Loan Type | `loanType` | badge | left | |
| 4 | Principal | `principal` | currency | right | ✓ |
| 5 | Interest | `interest` | currency | right | ✓ |
| 6 | Total Payable | `totalPayable` | currency | right | ✓ |
| 7 | EMI Freq | `frequency` | text | center | |
| 8 | Start Date | `startDate` | date | center | |
| 9 | End Date | `endDate` | date | center | |
| 10 | Outstanding | `outstanding` | currency | right | ✓ |
| 11 | Status | `status` | badge | center | |

`interest = totalPayable − principal` (computed). Totals footer sums principal/interest/payable/outstanding.

## 4. KPI cards
Total loans · Total principal · Total outstanding · Active count.

## 5. Filters (subset of universal bar)
Date range (on `startDate`), Branch, Agent, Loan Type, Loan Status, Frequency, Amount range.

## 6. API contract
`GET /api/v1/reports/loan-register?from&to&branchId?&agentId?&loanType?&status?&frequency?&minAmount?&maxAmount?&cursor?`
→ `ok(payload: ReportPayload)` with `columns`, `rows`, server-computed `totals`, `kpis`. Cursor pagination
for large portfolios (`nextCursor`).

## 7. Aggregation (builder `lib/reports/builders/loan-register.ts`)
```ts
const where = { tenantId: ctx.tenantId, ...appScope(ctx.appType), ...scopedBranchWhere(ctx),
  ...(status ? { status } : {}), ...(loanType ? { loanType } : {}),
  ...(frequency ? { frequency } : {}),
  startDate: { gte: from, lte: to },
  ...(agentId ? { customer: { agentId } } : {}),
  ...(minAmount || maxAmount ? { principal: { gte: minAmount, lte: maxAmount } } : {}) };
const loans = await prisma.loan.findMany({ where, include: { customer: { select: { name:true } } },
  orderBy: { startDate: 'desc' } });
```
Map each loan → row; compute `interest`, `outstanding`. Totals via reduce (or `_sum` aggregate for footer).

## 8. Export mapping
Same 11 columns → CSV (`lib/reports/csv.ts`) / Excel (`toWorkbook`) / PDF (`TableReportPDF`) / Print.
Currency cells use tenant `currencySymbol`. Filename `loan-register-<from>-to-<to>`.

## 9. i18n keys
`reports.loanRegister.title`, `reports.col.loanCode|customer|loanType|principal|interest|totalPayable|frequency|startDate|endDate|outstanding|status` (en + ta/hi/te/kn/ml).

## 10. RBAC + subscription
Admin/manager/owner full; agent scoped to own customers. Export PDF/Excel gated by `receiptPdfAllowed`; CSV open.

## 11. ⚠️ Core-untouched guarantee
Read-only `findMany`. No writes. `interest`/`outstanding` computed in the builder — **no new columns**.
Optional additive index `@@index([tenantId, appType, startDate])` only if perf requires → gated SQL, sign-off.

## 12. No-hardcode checklist
- [ ] Status/type/frequency option lists from distinct DB values, not constants.
- [ ] Currency symbol from `getSetting`/branding.
- [ ] Labels via i18n.
- [ ] No magic thresholds.

## 13. Test plan
Seed N loans across statuses → call API → assert row count, totals = manual sum, scope (agent sees subset).
Export → open xlsx/PDF → totals match screen.
