# 04 · High Risk Customers

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers flagged as collection risk based on: missed payments, long overdue, multiple active loans, and
collection history. A scored watch-list for proactive recovery.

## 2. Source models (READ ONLY)
- `Loan` (`:444`): status, npaStatus, count per customer. `Instalment` (missed count). `Penalty` (pending).
  `Customer` (`:283`).
- Risk weights from `getSetting(tenantId,'report_risk_weights', <json>)` — **configurable, not hardcoded**.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Customer | `customerName` | text | left | |
| Active Loans | `loanCount` | number | right | |
| Missed (90d) | `missedCount` | number | right | |
| Max Days Overdue | `maxOverdue` | number | right | |
| Outstanding | `outstanding` | currency | right | ✓ |
| Risk Score | `riskScore` | number | right | |
| Risk Band | `riskBand` | badge | center | |

`riskBand` ∈ {Low, Medium, High} from score thresholds (from `AppSetting`).

## 4. KPI cards
High-risk count · total at-risk outstanding · avg score.

## 5. Filters
Branch, Agent, Min risk score, Risk band.

## 6. API contract
`GET /api/v1/reports/high-risk-customers?branchId?&agentId?&minScore?&band?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/high-risk-customers.ts`)
Per customer (scoped): aggregate loanCount, missedCount, maxOverdue, pendingPenalty, outstanding; compute
`riskScore` = Σ(weightᵢ × signalᵢ) using `report_risk_weights`; band by `report_risk_bands` thresholds.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `high-risk-customers-<date>`.

## 9. i18n keys
`reports.highRisk.title`, `reports.col.loanCount|missedCount|maxOverdue|riskScore|riskBand`, `reports.band.low|medium|high`.

## 10. RBAC + subscription
Admin/manager; agent scoped. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only aggregation. Scoring is computed in the builder — **no new columns**, no writes. Weights/bands from
`AppSetting`.

## 12. No-hardcode checklist
- [ ] Weights + band thresholds from `AppSetting`.
- [ ] Currency/labels from DB/i18n.

## 13. Test plan
Seed customers with varied missed/overdue/loan-count → assert scores monotonic with risk; retune weights →
re-rank; export matches.
