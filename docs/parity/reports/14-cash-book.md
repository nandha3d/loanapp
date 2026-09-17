# 14 · Cash Book

**Status:** 🆕 NEW · **Module scope:** all (premium accounting) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Cash account ledger — every cash receipt and payment with running cash balance. The "physical cash on hand"
reconciliation tool.

## 2. Source models (READ ONLY)
- `JournalLine` where `Account.isCash = true`; or `AccountEntry` (`:1433`) `category='cash'` (basic).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date | `entryDate` | date | left | |
| Particulars | `narration` | text | left | |
| Receipt (In) | `receipt` | currency | right | ✓ |
| Payment (Out) | `payment` | currency | right | ✓ |
| Balance | `balance` | currency | right | |

## 4. KPI cards
Opening cash · total receipts · total payments · closing cash.

## 5. Filters
Date range, Branch.

## 6. API contract
`GET /api/v1/reports/cash-book?from&to&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/cash-book.ts`)
Opening cash before `from`; period cash postings ordered by date (scoped); running balance.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `cash-book-<from>-to-<to>`.

## 9. i18n keys
`reports.cashBook.title`, `reports.col.particulars|receipt|payment|balance`.

## 10. RBAC + subscription
Accountant+/owner; premium gated (basic via `AccountEntry`). Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Cash accounts from `Account.isCash`/category, not hardcoded. Currency/labels from DB/i18n.

## 13. Test plan
Seed cash in/out → assert running balance + closing; export matches.
