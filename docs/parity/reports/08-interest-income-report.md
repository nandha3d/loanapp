# 08 · Interest Income Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Interest **earned** date-wise / month-wise / year-wise — the core revenue line. Separates interest from
principal in collections. (Gold module: monthly pledge interest; others: scheduled interest component.)

## 2. Source models (READ ONLY)
- `Loan` (`:444`): `totalPayable − principal` = total interest; recognized as collected.
- `Payment` (`:1368`) `paymentType='interest'` (gold servicing) + interest share of instalments.
- `AccountEntry` (`:1433`) `category='interest'` where posted. **Recognition basis from `AppSetting`**
  (`interest_recognition='cash'|'accrual'`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Period | `period` | text | left | |
| Loans | `loans` | number | right | |
| Interest Accrued | `accrued` | currency | right | ✓ |
| Interest Collected | `collected` | currency | right | ✓ |
| Pending | `pending` | currency | right | ✓ |

## 4. KPI cards
Period interest income · YTD · collected vs accrued %.

## 5. Filters
Date range, Branch, Bucket = day|month|year, Loan Type.

## 6. API contract
`GET /api/v1/reports/interest-income?from&to&bucket=day|month|year&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/interest-income.ts`)
Per bucket (scoped): accrued interest from schedule; collected from interest-type payments / interest share;
pending = accrued − collected. Gold uses `Payment.paymentType='interest'`. Basis from `AppSetting`.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `interest-income-<from>-to-<to>`.

## 9. i18n keys
`reports.interestIncome.title`, `reports.col.period|loans|accrued|collected|pending`.

## 10. RBAC + subscription
Admin/owner/accountant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Interest split computed in builder — **no new columns**, no re-posting, no change to interest
engine. Recognition basis from `AppSetting`.

## 12. No-hardcode checklist
- [ ] Recognition basis + bucket from input/`AppSetting`. Currency/labels from DB/i18n.

## 13. Test plan
Seed loans/payments with interest components → assert accrued vs collected per bucket; gold interest counted;
export matches.
