# 13 · Refund Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Payments refunded back to customers (overpayment returns, cancelled disbursals, corrections) — money flowing
out, needed for reconciliation and audit.

## 2. Source models (READ ONLY)
- `Payment` (`:1368`): `paymentType='refund'` or negative/reversal entries; `amount`, `paymentDate`, `loanId`.
- `AccountEntry` (`:1433`) `type='adjustment'` where used for refunds.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date | `paymentDate` | date | left | |
| Customer | `customerName` | text | left | |
| Loan No | `loanCode` | text | left | |
| Original Ref | `originalRef` | text | left | |
| Reason | `reason` | text | left | |
| Refund Amount | `amount` | currency | right | ✓ |
| Approved By | `approvedBy` | text | left | |

## 4. KPI cards
Refund count · total refunded · avg refund.

## 5. Filters
Date range, Branch, Reason.

## 6. API contract
`GET /api/v1/reports/refund?from&to&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/refund.ts`)
`findMany` refund-type payments/adjustments (scoped); join original payment ref + approver.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `refunds-<from>-to-<to>`.

## 9. i18n keys
`reports.refund.title`, `reports.col.originalRef|reason|refundAmount|approvedBy`.

## 10. RBAC + subscription
Admin/owner/accountant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. No writes, no new columns, no refund issued from the report.

## 12. No-hardcode checklist
- [ ] Refund type from existing payment/adjustment fields. Currency/labels from DB/i18n.

## 13. Test plan
Seed refund records → assert listing + total; export matches.
