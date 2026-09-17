# 06 · Customer Loan History

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
All loans (past + present) for one customer — disbursed, repaid, outstanding, status. The relationship view
for renewal/credit decisions. `customers/[id]/loans` exists; wrap + export.

## 2. Source models (READ ONLY)
- Existing `customers/[id]/loans`. `Loan` (`:444`), `Payment` (`:1368`) for repaid totals.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No | `loanCode` | text | left | |
| Type | `loanType` | badge | left | |
| Disbursed | `disbursed` | currency | right | ✓ |
| Repaid | `totalCollected` | currency | right | ✓ |
| Outstanding | `outstanding` | currency | right | ✓ |
| Start | `startDate` | date | center | |
| End/Closed | `endOrClosed` | date | center | |
| Status | `status` | badge | center | |

## 4. KPI cards
Total loans · total disbursed lifetime · total repaid · current outstanding.

## 5. Filters
Customer (required), Status, Date range.

## 6. API contract
`GET /api/v1/reports/customer-loan-history?customerId&status?` → `ok(payload)`. Adapter over existing
`customers/[id]/loans`.

## 7. Aggregation
Reuse existing customer-loans query (scoped); compute outstanding per loan.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `customer-loan-history-<customerCode>`.

## 9. i18n keys
`reports.customerLoanHistory.title`, `reports.col.disbursed|repaid|endOrClosed`.

## 10. RBAC + subscription
Agent sees own; admin all. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing endpoint. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Type/status from distinct. Currency/labels from DB/i18n.

## 13. Test plan
Seed customer with multiple loans across statuses → assert lifetime totals; export matches.
