# 14 · Ledger Report

**Status:** 🔧 ENHANCE · **Module scope:** all (premium accounting) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
General ledger for any account — every debit/credit posting with a running balance. The accountant's
account statement. Journal listing exists; this pivots per-account with running balance.

## 2. Source models (READ ONLY)
- `JournalLine` (account postings) + `JournalEntry` (date/voucher/status). `Account` (COA).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date | `entryDate` | date | left | |
| Voucher | `voucherType` | text | left | |
| Narration | `narration` | text | left | |
| Debit | `debit` | currency | right | ✓ |
| Credit | `credit` | currency | right | ✓ |
| Balance | `balance` | currency | right | |

Opening balance row + running balance through the period.

## 4. KPI cards
Opening · total debit · total credit · closing balance.

## 5. Filters
Account (required), Date range, Branch.

## 6. API contract
`GET /api/v1/reports/ledger?accountId&from&to&branchId?` → `ok(payload)`. Reuse journal query filtered by
account.

## 7. Aggregation (builder `lib/reports/builders/ledger.ts`)
Opening = sum postings before `from`; period postings ordered by date; running balance per `Account.normalSide`.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `ledger-<accountCode>-<from>-to-<to>`.

## 9. i18n keys
`reports.ledger.title`, `reports.col.voucher|narration|debit|credit|balance`, `reports.opening`, `reports.closing`.

## 10. RBAC + subscription
Accountant+; gated by `isPremiumAccountingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over journal. No writes, no new columns, no posting.

## 12. No-hardcode checklist
- [ ] Normal side from `Account`, not assumed. Currency/labels from DB/i18n.

## 13. Test plan
Post entries to one account → assert opening + running balance + closing; export matches.
