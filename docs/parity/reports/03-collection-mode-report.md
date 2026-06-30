# 03 · Collection Mode Report

**Status:** 🆕 NEW · **Module scope:** all · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Collection split by payment channel — Cash, UPI, Bank, Cheque, Online, Wallet. Shows the cash-vs-digital
mix for reconciliation and cash-handling control.

## 2. Source models (READ ONLY)
- `Payment` (`:1368`) / `CollectionEntry` (`:618`): `paymentMode`, `amount`/`receivedAmount`, date.
- Mode list is **distinct DB values**, not a hardcoded enum.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Mode | `paymentMode` | badge | left | |
| Transactions | `count` | number | right | ✓ |
| Amount | `amount` | currency | right | ✓ |
| % of Total | `share` | percent | right | |

## 4. KPI cards
Cash total · Digital total · Cash share % · txn count.

## 5. Filters
Date range, Branch, Agent, Mode.

## 6. API contract
`GET /api/v1/reports/collection-mode?from&to&branchId?&agentId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/collection-mode.ts`)
```ts
const grouped = await prisma.collectionEntry.groupBy({ by:['paymentMode'],
  where:{ collection:{ tenantId, appType }, ...scopedBranchWhere(ctx),
          submittedAt:{ gte:from, lte:to }, ...(agentId?{agentId}:{}) },
  _count:true, _sum:{ receivedAmount:true } });
```
share = amount / Σ amount.

## 8. Export mapping
4 columns → CSV/Excel/PDF/Print. Filename `collection-mode-<from>-to-<to>`.

## 9. i18n keys
`reports.collectionMode.title`, `reports.col.mode|count|amount|share`, mode labels reuse `collection.*Mode`.

## 10. RBAC + subscription
Agent scoped; admin tenant. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only `groupBy`. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Mode list from distinct. Currency/labels from DB/i18n.

## 13. Test plan
Seed mixed-mode entries → assert per-mode count/amount/share sums to 100%; export matches.
