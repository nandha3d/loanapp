# 07 · Missed Visit Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Customers an agent was **scheduled to visit but did not** — assigned customers with a due collection and no
GPS-tagged visit/entry that day. Accountability for field coverage.

## 2. Source models (READ ONLY)
- `Instalment` due today (assigned worklist) vs `CollectionEntry` with `gpsCapturedAt` that day.
- `Customer` (`:283`) `agentId`/`routeId`. `User` (`:123`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Customer | `customerName` | text | left | |
| Route | `routeName` | text | left | |
| Amount Due | `dueAmount` | currency | right | ✓ |
| Last Visit | `lastVisit` | date | center | |
| Phone | `phone` | text | left | |

Rows = worklist customers with no visit entry for the day.

## 4. KPI cards
Missed visits · agents with gaps · uncovered due amount.

## 5. Filters
Date (single), Branch, Agent, Route.

## 6. API contract
`GET /api/v1/reports/missed-visit?asOf?&branchId?&agentId?&routeId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/missed-visit.ts`)
Worklist (due instalments, scoped) LEFT-ANTI-JOIN visited customers (entries with GPS that day) → unvisited.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `missed-visit-<asOf>`.

## 9. i18n keys
`reports.missedVisit.title`, `reports.col.route|lastVisit`.

## 10. RBAC + subscription
Supervisor/admin. Gated by `gpsTrackingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Anti-join in builder. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] "Visited" defined by existing GPS entry, not a flag. Currency/labels from DB/i18n.

## 13. Test plan
Seed worklist with some visited, some not → assert only unvisited listed; export matches.
