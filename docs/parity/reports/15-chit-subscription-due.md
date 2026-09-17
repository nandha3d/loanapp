# 15 · Chit Subscription Due 💎

**Status:** 🆕 NEW · **Module scope:** `chitfunds` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Members whose monthly chit subscription is **due or overdue** — the chit collection worklist. Mirrors the EMI
worklist but for chit instalments.

## 2. Source models (READ ONLY)
- `ChitPayment` / chit member subscription schedule (existing). `ChitMember`, `Customer`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Chit | `chitName` | text | left | |
| Member | `memberName` | text | left | |
| Month | `month` | text | center | |
| Subscription Due | `dueAmount` | currency | right | ✓ |
| Paid | `paidAmount` | currency | right | ✓ |
| Balance | `balance` | currency | right | ✓ |
| Status | `status` | badge | center | |

## 4. KPI cards
Members due · total subscription due · overdue amount.

## 5. Filters
Chit, Month, Branch, Status (due/overdue).

## 6. API contract
`GET /api/v1/reports/chit-subscription-due?chitId?&month?&branchId?&status?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/chit-subscription-due.ts`)
Subscription schedule vs `ChitPayment` per member (scoped); balance = due − paid; keep balance > 0.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `chit-subscription-due-<month>`.

## 9. i18n keys
`reports.chitSubscriptionDue.title`, `reports.col.member|month|subscriptionDue|paid|balance`.

## 10. RBAC + subscription
Chit admin/foreman/agent (own chits). Module gate `chitfunds`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Status from data. Currency/labels from DB/i18n.

## 13. Test plan
Seed chit members with mixed paid/unpaid months → assert only balance>0 listed; export matches.
