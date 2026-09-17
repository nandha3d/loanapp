# 03 · Customer Collection History

**Status:** 🔧 ENHANCE · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Every payment a single customer has made, across all their loans — the customer ledger view. Existing loan
statement covers one loan; this aggregates all loans for the customer.

## 2. Source models (READ ONLY)
- `Payment` (`:1368`): `amount`, `paymentMode`, `paymentDate`, `paymentType`, `loanId`.
- `CollectionEntry` (`:618`): `receivedAmount`, `submittedAt`, `agentId`.
- `Loan` (`:444`), `Customer` (`:283`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date | `date` | date | left | |
| Loan No | `loanCode` | text | left | |
| Amount | `amount` | currency | right | ✓ |
| Mode | `paymentMode` | badge | center | |
| Type | `paymentType` | badge | center | |
| Agent | `agentName` | text | left | |
| Running Balance | `balance` | currency | right | |

## 4. KPI cards
Total paid · loans count · last payment date · outstanding across loans.

## 5. Filters
Customer (required), Date range, Loan (optional), Mode.

## 6. API contract
`GET /api/v1/reports/customer-collection-history?customerId&from?&to?&loanId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/customer-collection-history.ts`)
Fetch all customer loans (scoped) → payments across them ordered by date; compute running balance against
total payable. Reuse loan-statement logic where present.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `customer-history-<customerCode>`.

## 9. i18n keys
`reports.customerHistory.title`, `reports.col.date|loanCode|amount|mode|type|agent|balance`.

## 10. RBAC + subscription
Agent sees own customers; admin all. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses statement aggregation. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Mode/type from distinct DB values. Currency/labels from DB/i18n.

## 13. Test plan
Seed customer with multiple loans/payments → assert chronological rows + running balance; export matches.
