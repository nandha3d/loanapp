# 15 · Chit Group Report 💎

**Status:** 🆕 NEW · **Module scope:** `chitfunds` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Status of every chit group — members, monthly value, months elapsed/remaining, collected vs disbursed. The
chit foreman's master view.

## 2. Source models (READ ONLY)
- `Chit` group model + `ChitMember`, `ChitPayment` (existing chits module, `chits/[id]/members|payments`).
- `Customer` for member identity.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Chit Name | `chitName` | text | left | |
| Value | `chitValue` | currency | right | ✓ |
| Members | `memberCount` | number | right | ✓ |
| Month | `currentMonth` | text | center | |
| Collected | `collected` | currency | right | ✓ |
| Disbursed | `disbursed` | currency | right | ✓ |
| Status | `status` | badge | center | |

## 4. KPI cards
Active chits · total chit value · total collected · members.

## 5. Filters
Branch, Status, Date range.

## 6. API contract
`GET /api/v1/reports/chit-group?branchId?&status?` → `ok(payload)`. Reuse chits data aggregated tenant-wide.

## 7. Aggregation (builder `lib/reports/builders/chit-group.ts`)
`findMany` chits (scoped, `appType='chitfunds'`) with member count + collected/disbursed sums.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `chit-group-<date>`.

## 9. i18n keys
`reports.chitGroup.title`, `reports.col.chitName|value|members|month|collected|disbursed`.

## 10. RBAC + subscription
Chit admin/foreman. Module gate `chitfunds`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over chit tables. No writes, no new columns, no auction/payout from report.

## 12. No-hardcode checklist
- [ ] Status from data. Currency/labels from DB/i18n.

## 13. Test plan
Seed chit groups → assert per-chit collected/disbursed + members; export matches; module isolation.
