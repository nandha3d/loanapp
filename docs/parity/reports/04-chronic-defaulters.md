# 04 · Chronic Defaulters

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers with **repeated** defaults over time (not just currently overdue) — a pattern of missed
instalments across loans. Feeds blacklist / no-renew decisions.

## 2. Source models (READ ONLY)
- `Instalment` (`:529`): historical `status='missed'` count per customer. `Penalty` (`:561`): settled/waived
  history. `Loan` (`:444`): closed-with-default. `Customer` (`:283`).
- Threshold "chronic = ≥ N missed events" from `getSetting(tenantId,'report_chronic_threshold','3')`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Total Missed Events | `missedEvents` | number | right | ✓ |
| Loans w/ Default | `defaultLoans` | number | right | |
| Penalties Incurred | `penaltyTotal` | currency | right | ✓ |
| Last Default | `lastDefault` | date | center | |
| Current Outstanding | `outstanding` | currency | right | ✓ |

## 4. KPI cards
Chronic count · total penalties · total outstanding.

## 5. Filters
Branch, Agent, Min missed events, Date range (history window).

## 6. API contract
`GET /api/v1/reports/chronic-defaulters?from?&to?&branchId?&minEvents?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/chronic-defaulters.ts`)
Group missed instalments by customer (scoped) over the window; count events, distinct default loans, sum
penalties; keep `missedEvents ≥ threshold`.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `chronic-defaulters-<from>-to-<to>`.

## 9. i18n keys
`reports.chronic.title`, `reports.col.missedEvents|defaultLoans|penaltyTotal|lastDefault`.

## 10. RBAC + subscription
Admin/manager; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Threshold from `AppSetting`. No writes, no new columns, no blacklist mutation (report only flags).

## 12. No-hardcode checklist
- [ ] Chronic threshold from `AppSetting`.
- [ ] Currency/labels from DB/i18n.

## 13. Test plan
Seed customers with repeated historical misses → assert only ≥threshold listed, counts correct; export matches.
