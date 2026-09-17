# 08 · Disbursement Report

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Loans disbursed in a period — date-wise / agent-wise / branch-wise, with count and amount. `app/api/reports/route.ts`
(`?type=disbursement`) exists; wrap + export + add grouping.

## 2. Source models (READ ONLY)
- `Loan` (`:444`): `principal`, `disbursed`, `createdAt`/`startDate`, `branchId`, customer `agentId`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Group (Date/Agent/Branch) | `group` | text | left | |
| Loans | `count` | number | right | ✓ |
| Principal | `principal` | currency | right | ✓ |
| Disbursed | `disbursed` | currency | right | ✓ |
| Deductions | `deduction` | currency | right | ✓ |

## 4. KPI cards
Total disbursed · loan count · avg ticket size.

## 5. Filters
Date range, Branch, Agent, Group-by = date|agent|branch.

## 6. API contract
`GET /api/v1/reports/disbursement?from&to&groupBy=date|agent|branch&branchId?` → `ok(payload)`. Adapter over
existing disbursement report.

## 7. Aggregation
Reuse existing disbursement logic (`app/api/reports/route.ts:52`); add groupBy dimension; sum principal/
disbursed/deduction (scoped).

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `disbursement-<from>-to-<to>`.

## 9. i18n keys
`reports.disbursement.title`, `reports.col.group|count|principal|disbursed|deductions`.

## 10. RBAC + subscription
Admin/manager; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing report logic. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Group options data-driven. Currency/labels from DB/i18n.

## 13. Test plan
Seed loans across dates/agents → assert per-group count/principal; switch groupBy; export matches.
