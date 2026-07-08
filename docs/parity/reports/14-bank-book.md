# 14 · Bank Book

**Status:** 🔧 ENHANCE · **Module scope:** all (premium accounting) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Bank account ledger — every bank receipt/payment with running balance, alongside reconciliation status.
Bank-rec exists; this is the statement view of a bank ledger.

## 2. Source models (READ ONLY)
- `JournalLine` for `BankAccount` ledger accounts; `BankStatement` lines for reconciliation status.
- Existing `accounting/bank-rec`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date | `entryDate` | date | left | |
| Particulars | `narration` | text | left | |
| Deposit (In) | `deposit` | currency | right | ✓ |
| Withdrawal (Out) | `withdrawal` | currency | right | ✓ |
| Balance | `balance` | currency | right | |
| Reconciled | `reconciled` | badge | center | |

## 4. KPI cards
Opening · total deposits · total withdrawals · closing · unreconciled count.

## 5. Filters
Bank account (required), Date range, Reconciled state.

## 6. API contract
`GET /api/v1/reports/bank-book?bankAccountId&from&to` → `ok(payload)`. Reuse bank-rec data.

## 7. Aggregation (builder `lib/reports/builders/bank-book.ts`)
Opening before `from`; period bank postings ordered by date (scoped); running balance; reconciled flag from
`BankStatement` match.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `bank-book-<bankAccount>-<from>-to-<to>`.

## 9. i18n keys
`reports.bankBook.title`, `reports.col.particulars|deposit|withdrawal|balance|reconciled`.

## 10. RBAC + subscription
Accountant+; premium gated. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses bank-rec data. No writes, no new columns, no reconciliation action from the report.

## 12. No-hardcode checklist
- [ ] Bank accounts from `BankAccount`, not hardcoded. Currency/labels from DB/i18n.

## 13. Test plan
Seed bank postings + statement → assert running balance + reconciled flag; export matches.
