# 07 · Commission Report

**Status:** 🆕 NEW (feature-gated) · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Agent commission earned on collections/disbursals, when the tenant pays commission. Shows base, rate, and
payable per agent.

## 2. Source models (READ ONLY)
- `CollectionEntry`/`Instalment` collected amounts per agent. `User` (`:123`).
- Commission scheme (rate %, basis = collection|disbursal, slabs) from `AppSetting`
  (`commission_enabled`, `commission_rate`, `commission_basis`) — **fully config-driven**.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Agent | `agentName` | text | left | |
| Basis Amount | `basisAmount` | currency | right | ✓ |
| Rate % | `rate` | percent | right | |
| Commission | `commission` | currency | right | ✓ |
| Period | `period` | text | center | |

## 4. KPI cards
Total commission payable · top earner · agents counted.

## 5. Filters
Date range, Branch, Agent.

## 6. API contract
`GET /api/v1/reports/commission?from&to&branchId?&agentId?` → `ok(payload)`. Returns empty/disabled state if
`commission_enabled` is false.

## 7. Aggregation (builder `lib/reports/builders/commission.ts`)
Sum basis (collection or disbursal per `commission_basis`) per agent (scoped); commission = basis × rate (or
slab lookup). All parameters from `AppSetting`.

## 8. Export mapping
5 columns → CSV/Excel/PDF/Print. Filename `commission-<from>-to-<to>`.

## 9. i18n keys
`reports.commission.title`, `reports.col.basisAmount|rate|commission|period`.

## 10. RBAC + subscription
Admin/owner only (payroll-adjacent). Hidden unless `commission_enabled`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Commission computed in builder from `AppSetting` — **no new columns**, no payout writes. This is a
**report**, not a disbursement.

## 12. No-hardcode checklist
- [ ] Rate/basis/slabs from `AppSetting`. Currency/labels from DB/i18n.

## 13. Test plan
Enable commission setting, seed collections → assert commission = basis×rate; disabled → empty state; export matches.
