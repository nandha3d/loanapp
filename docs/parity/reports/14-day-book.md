# 14 · Day Book

**Status:** 🆕 NEW · **Module scope:** all (premium accounting) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
All transactions for a single day (or range) in posting order — the chronological day book. Quick "what
happened today" across every account.

## 2. Source models (READ ONLY)
- `JournalEntry` + `JournalLine` for a date; `AccountEntry` (`:1433`) for non-premium tenants.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Time | `entryDate` | datetime | left | |
| Voucher | `voucherType` | text | left | |
| Account | `accountName` | text | left | |
| Narration | `narration` | text | left | |
| Debit | `debit` | currency | right | ✓ |
| Credit | `credit` | currency | right | ✓ |

## 4. KPI cards
Entries today · total debit · total credit (must balance).

## 5. Filters
Date (single, default today; range optional), Branch, Voucher type.

## 6. API contract
`GET /api/v1/reports/day-book?date?&from?&to?&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/day-book.ts`)
`findMany` journal lines for the day (scoped) ordered by entry time; premium path uses journal, basic uses
`AccountEntry`.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `day-book-<date>`.

## 9. i18n keys
`reports.dayBook.title`, `reports.col.time|voucher|account|narration|debit|credit`.

## 10. RBAC + subscription
Accountant+; premium gated. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Voucher types from data. Currency/labels from DB/i18n.

## 13. Test plan
Post several entries on a day → assert chronological list + debit==credit totals; export matches.
