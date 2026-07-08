# 15 · Gold Released / Redeemed 💎

**Status:** 🆕 NEW · **Module scope:** `goldloan` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Pledges that have been **redeemed and ornaments released** in a period — closed gold loans with final
settlement amounts. Reconciles released inventory and realized interest.

## 2. Source models (READ ONLY)
- `GoldLoanCollateral` (`:874`): `releaseStatus='released'`, `releasedAt`, `outstandingPrincipal` (final).
- `Payment` (`:1368`) `paymentType='redemption'`. `Loan` (`:444`) `closedAt`, `closureType`.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Packet No | `packetNo` | text | left | |
| Customer | `customerName` | text | left | |
| Pledge Date | `startDate` | date | center | |
| Released Date | `releasedAt` | date | center | |
| Net (g) Released | `netWeightGrams` | number | right | ✓ |
| Principal | `principal` | currency | right | ✓ |
| Interest Collected | `interestCollected` | currency | right | ✓ |
| Total Settled | `totalSettled` | currency | right | ✓ |

## 4. KPI cards
Redeemed count · net weight released · interest realized · total settled.

## 5. Filters
Date range (on `releasedAt`), Branch, Ornament type.

## 6. API contract
`GET /api/v1/reports/gold-released-redeemed?from&to&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/gold-released-redeemed.ts`)
`findMany` collateral with `releaseStatus='released'` and `releasedAt` in range (scoped); join redemption
payments for interest collected.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `gold-released-<from>-to-<to>`.

## 9. i18n keys
`reports.goldReleased.title`, `reports.col.releasedDate|netReleased|interestCollected|totalSettled`.

## 10. RBAC + subscription
Gold admin/manager. Module gate `goldloan`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over existing release fields. No writes, no new columns, no release performed from report.

## 12. No-hardcode checklist
- [ ] Status/payment-type from existing enums. Currency/labels from DB/i18n.

## 13. Test plan
Seed redeemed pledges → assert released list + interest/settled totals; export matches.
