# 02 · Loan Status Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Loans grouped/filtered by lifecycle status: Active, Closed, Pending Approval, Overdue, Written Off,
Restructured. Answers "how is my book distributed by status" and lists the loans in any one status.

## 2. Source models (READ ONLY)
- `Loan` (`:444`): `status`, `closedAt`, `closureType`, `npaStatus`, `principal`, `totalPayable`,
  `totalCollected`, `loanCode`, `customerId`.
- Status values are read from data (`active`, `overdue`, `closed`, plus `closureType`/`npaStatus`
  derivations for written-off / restructured / pending-approval). **No hardcoded status list** — the
  filter options come from `distinct loan.status` + approval/closure flags.

## 3. On-screen table
Two-part view: (a) **summary table** — one row per status: `status`, `count`, `principal`, `outstanding`;
(b) drill-down **detail table** when a status is selected: `loanCode`, `customerName`, `principal`,
`outstanding`, `status`, `closedAt`/`approvalState`.

| Column | key | type | align | total |
|---|---|---|---|---|
| Status | `status` | badge | left | |
| Loans | `count` | number | right | ✓ |
| Principal | `principal` | currency | right | ✓ |
| Outstanding | `outstanding` | currency | right | ✓ |

## 4. KPI cards
One card per status with count + outstanding.

## 5. Filters
Date range, Branch, Agent, Loan Type, Status (multi-select).

## 6. API contract
`GET /api/v1/reports/loan-status?from&to&branchId?&status?&loanType?` → `ok(payload)`.
`?status=` omitted → summary (groupBy); `?status=overdue` → detail rows.

## 7. Aggregation (builder `lib/reports/builders/loan-status.ts`)
```ts
const grouped = await prisma.loan.groupBy({ by:['status'],
  where:{ tenantId, ...appScope(appType), ...scopedBranchWhere(ctx) },
  _count:true, _sum:{ principal:true, totalPayable:true, totalCollected:true } });
```
Map written-off (`closureType` = write-off), restructured, pending-approval via existing approval/closure
fields. Outstanding = `_sum.totalPayable − _sum.totalCollected`.

## 8. Export mapping
Summary + detail columns → CSV/Excel/PDF/Print. Filename `loan-status-<from>-to-<to>`.

## 9. i18n keys
`reports.loanStatus.title`, `reports.status.active|closed|pending|overdue|writtenOff|restructured`, `reports.col.count|principal|outstanding`.

## 10. RBAC + subscription
Admin/manager full; agent scoped. Export gated as framework §8.

## 11. ⚠️ Core-untouched guarantee
Read-only `groupBy`/`findMany`. No writes, no new columns, no status-machine changes — statuses are read
from existing loan rows.

## 12. No-hardcode checklist
- [ ] Status options from `distinct` + flags, not a literal array.
- [ ] Labels via i18n; currency via branding.

## 13. Test plan
Seed loans in each status → assert group counts/sums; select a status → detail rows match; export totals match.
