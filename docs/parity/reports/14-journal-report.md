# 14 · Journal Report

**Status:** ✅ EXISTS (wrap) · **Module scope:** all (premium accounting) · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
All journal entries (vouchers) with debit/credit totals and status — the transaction register.
`accounting/journal` exists (paginated, searchable); wrap + add Excel/PDF.

## 2. Source models (READ ONLY)
- Existing `accounting/journal`: `rows[]` of `JournalEntry` (date, voucher, status, totalDebit, totalCredit).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Entry No | `entryNo` | text | left | |
| Date | `entryDate` | date | center | |
| Voucher | `voucherType` | badge | left | |
| Narration | `narration` | text | left | |
| Debit | `totalDebit` | currency | right | ✓ |
| Credit | `totalCredit` | currency | right | ✓ |
| Status | `status` | badge | center | |

## 4. KPI cards
Entries · total debit · total credit · posted vs draft.

## 5. Filters
Date range, Status, Voucher type, Search, Branch (matches existing params).

## 6. API contract
**Existing:** `GET /api/v1/accounting/journal?page&from&to&status&search&branchId`. Add adapter → `ReportPayload`.

## 7. Aggregation
Reuse existing journal query (no change). Adapter maps rows; pass-through pagination.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `journal-<from>-to-<to>`.

## 9. i18n keys
`reports.journal.title`, `reports.col.entryNo|voucher|narration|debit|credit|status`.

## 10. RBAC + subscription
Accountant+; premium gated. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing journal endpoint. Adapter read-only/additive — no posting/approval from the report.

## 12. No-hardcode checklist
- [ ] Voucher/status options from data. Currency/labels from DB/i18n.

## 13. Test plan
Post entries → adapter rows == endpoint; filter/search; export totals match.
