# 12 · Audit Activity Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Who did what: created/edited a loan, deleted a payment, modified interest, changed a due date — the
compliance trail. Dashboard shows the last 8 activities; this is the full filterable, exportable log.

## 2. Source models (READ ONLY)
- `AuditLog` (`:819`): `userId`, `action`, `entityType`, `entityId`, `oldValue`, `newValue`, `ipAddress`,
  `userAgent`, `createdAt`. `User` (`:123`) for actor name.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date/Time | `createdAt` | datetime | left | |
| User | `userName` | text | left | |
| Action | `action` | badge | left | |
| Entity | `entityType` | text | left | |
| Entity Ref | `entityId` | text | left | |
| Before → After | `change` | text | left | |
| IP | `ipAddress` | text | left | |

`change` = compact diff of `oldValue`→`newValue` (expandable on click).

## 4. KPI cards
Total events · edits · deletes · distinct users.

## 5. Filters
Date range, User, Action, Entity Type, Branch.

## 6. API contract
`GET /api/v1/reports/audit-activity?from&to&userId?&action?&entityType?&cursor?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/audit-activity.ts`)
`findMany` `AuditLog` (scoped by tenant) with filters, ordered by `createdAt desc`; join user name; cursor
pagination for volume.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Diff JSON flattened in export. Filename `audit-activity-<from>-to-<to>`.

## 9. i18n keys
`reports.auditActivity.title`, `reports.col.user|action|entity|entityRef|change|ip`.

## 10. RBAC + subscription
Admin/owner/auditor only (compliance). Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over `AuditLog`. No writes. The audit log itself is never edited by this report.

## 12. No-hardcode checklist
- [ ] Action/entity options from distinct DB values. Labels from i18n.

## 13. Test plan
Generate audited actions (create/edit/delete) → assert log rows + before/after diff; filter by user/action;
export matches.
