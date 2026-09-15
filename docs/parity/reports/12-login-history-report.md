# 12 · Login History Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Who logged in, when, from where (IP/device) — the access audit, important for security reviews.

## 2. Source models (READ ONLY)
- `AuditLog` (`:819`) entries where `action` ∈ {login, logout, login_failed} (or a session/login event
  source if recorded separately). `User` (`:123`).
- Login actions identified by existing audit `action` values — **not a new table**.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date/Time | `createdAt` | datetime | left | |
| User | `userName` | text | left | |
| Event | `action` | badge | center | |
| IP | `ipAddress` | text | left | |
| Device/Agent | `userAgent` | text | left | |
| Result | `result` | badge | center | |

`result` ∈ {Success, Failed}.

## 4. KPI cards
Logins today · failed attempts · distinct users · distinct IPs.

## 5. Filters
Date range, User, Result, Branch.

## 6. API contract
`GET /api/v1/reports/login-history?from&to&userId?&result?&cursor?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/login-history.ts`)
`findMany` `AuditLog` (scoped) filtered to login-class actions ordered desc; join user.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `login-history-<from>-to-<to>`.

## 9. i18n keys
`reports.loginHistory.title`, `reports.col.event|ip|device|result`.

## 10. RBAC + subscription
Admin/owner/security only. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over `AuditLog`. No writes, no new columns. (If login events are not yet audited, that is an
auth-layer change — flagged ⚠️ separately, NOT part of this read-only report.)

## 12. No-hardcode checklist
- [ ] Login action set from existing audit `action` values. Labels from i18n.

## 13. Test plan
Seed login/failed/logout audit rows → assert filtered rows + KPIs; export matches.
