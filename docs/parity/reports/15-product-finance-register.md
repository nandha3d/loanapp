# 15 · Product Finance Register 💎

**Status:** 🆕 NEW · **Module scope:** `productfinance` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Register of consumer-durable / product-financed loans — item, dealer, invoice, down-payment, financed amount,
tenure, warranty. The product-finance master book.

## 2. Source models (READ ONLY)
- `ProductFinanceItem` (`:984`): `category`, `productName`, `brand`, `modelNo`, `serialNo`, `dealerName`,
  `dealerId`, `invoiceAmount`, `downPayment`, `financedAmount`, `tenureMonths`, `warrantyExpiry`,
  `repossessionStatus`. `Loan`, `Customer`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| Product | `productName` | text | left | |
| Brand/Model | `brandModel` | text | left | |
| Serial No | `serialNo` | text | left | |
| Dealer | `dealerName` | text | left | |
| Invoice | `invoiceAmount` | currency | right | ✓ |
| Down Payment | `downPayment` | currency | right | ✓ |
| Financed | `financedAmount` | currency | right | ✓ |
| Tenure (mo) | `tenureMonths` | number | right | |
| Status | `repossessionStatus` | badge | center | |

## 4. KPI cards
Active items · total financed · total down-payment · avg ticket.

## 5. Filters
Date range, Branch, Category, Dealer, Status.

## 6. API contract
`GET /api/v1/reports/product-finance-register?from?&to?&branchId?&category?&dealerId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/product-finance-register.ts`)
`findMany` `ProductFinanceItem` (scoped, `appType='productfinance'`) include loan + customer.

## 8. Export mapping
11 columns → CSV/Excel/PDF/Print. Filename `product-finance-register-<date>`.

## 9. i18n keys
`reports.productRegister.title`, `reports.col.product|brandModel|serialNo|dealer|invoice|downPayment|financed|tenure`.

## 10. RBAC + subscription
Product admin/manager; agent scoped. Module gate `productfinance`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over `ProductFinanceItem`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Category/dealer lists from data. Currency/labels from DB/i18n.

## 13. Test plan
Seed product loans → assert register + financed totals; filter by category/dealer; export matches; module isolation.
