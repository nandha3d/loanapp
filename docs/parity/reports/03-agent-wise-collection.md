# 03 · Agent-wise Collection

**Status:** ✅ EXISTS (wrap) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Per-agent target vs collected vs pending and efficiency % over a date range. The supervisor's
accountability sheet.

## 2. Source models (READ ONLY)
- Existing `app/api/v1/reports/agent/route.ts` (`:11-31`) aggregates `DailyCollection` by `agentId`.
- Plus `analytics/agents` for hitRate. `User` (`:123`) for agent names.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Target | `expected` | currency | right | ✓ |
| Collected | `collected` | currency | right | ✓ |
| Pending | `pending` | currency | right | ✓ |
| Efficiency % | `efficiency` | percent | right | |

## 4. KPI cards
Top agent · total target · total collected · avg efficiency.

## 5. Filters
Date range, Branch, Agent (optional single).

## 6. API contract
**Existing:** `GET /api/v1/reports/agent?from&to&agentId?`. Add adapter → `ReportPayload`.

## 7. Aggregation
Reuse existing route (no change). Adapter maps agent buckets → rows, computes pending/efficiency, names via
`User`. Scope already applied (`scopedBranchWhere`).

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `agent-wise-collection-<from>-to-<to>`.

## 9. i18n keys
`reports.agentWiseCollection.title`, `reports.col.agent|target|collected|pending|efficiency`.

## 10. RBAC + subscription
Supervisor/admin; an agent sees only self. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
No change to existing endpoint. Adapter read-only/additive.

## 12. No-hardcode checklist
- [ ] Currency/labels from DB/i18n.

## 13. Test plan
Seed agents/collections → adapter rows + totals == endpoint; export matches.
