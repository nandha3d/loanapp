# 10 · Customer Visit History

**Status:** 🔧 ENHANCE · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Every geo-tagged visit to a customer over time, with visit duration and on-location verification. The
"who visited this customer and when" audit. `gps/agent/[id]/collections` has the data; pivot to per-customer.

## 2. Source models (READ ONLY)
- `CollectionEntry` (`:618`): `customerId`, `agentId`, `gpsCapturedAt`, `distanceFromCustomerM`,
  `locationStatus`, `receivedAmount`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Date/Time | `visitedAt` | datetime | left | |
| Agent | `agentName` | text | left | |
| Dist from Cust (m) | `distanceFromCustomerM` | number | right | |
| Duration (min) | `durationMin` | number | right | |
| Geo Status | `locationStatus` | badge | center | |
| Collected | `receivedAmount` | currency | right | ✓ |

Duration = gap between arrival ping and next-stop ping (best-effort).

## 4. KPI cards
Total visits · on-location % · avg duration · last visit.

## 5. Filters
Customer (required), Date range, Agent.

## 6. API contract
`GET /api/v1/reports/customer-visit-history?customerId&from?&to?` → `ok(payload)`. Adapter over the GPS
collections endpoint, pivoted by customer.

## 7. Aggregation (builder `lib/reports/builders/customer-visit-history.ts`)
`findMany` GPS entries for the customer (scoped) ordered by time; compute duration; classify geo status.

## 8. Export mapping
6 columns → CSV/Excel/PDF/Print. Filename `customer-visits-<customerCode>`.

## 9. i18n keys
`reports.customerVisits.title`, `reports.col.visitedAt|durationMin|distFromCust`.

## 10. RBAC + subscription
Agent sees own customers; admin all. Gated by `gpsTrackingEnabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Reuses GPS data. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Geofence radius from `AppSetting`. Currency/labels from DB/i18n.

## 13. Test plan
Seed multiple visits to one customer → assert chronological list + duration + geo status; export matches.
