# 15 · Gold Pledge Register 💎

**Status:** 🆕 NEW · **Module scope:** `goldloan` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
The master register of every gold pledge — packet no, ornaments, weights, purity, valuation, loan amount,
status. The pawn-broker's primary book. Gold summary KPIs exist (`gold/reports?type=summary`); this is the
full line-level register.

## 2. Source models (READ ONLY)
- `GoldLoanCollateral` (`:874`): `packetNo`, `grossWeightGrams`, `netWeightGrams`, `purityKarat`,
  `marketRatePerGram`, `assessedValue`, `eligibleLtvPercent`, `releaseStatus`, `outstandingPrincipal`.
- `GoldOrnamentItem` (`:918`): per-ornament `ornamentType`, `quantity`, gross/net weight, `value`.
- `Loan` (`:444`), `Customer` (`:283`).

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Packet No | `packetNo` | text | left | |
| Loan No | `loanCode` | text | left | |
| Customer | `customerName` | text | left | |
| Ornaments | `ornamentSummary` | text | left | |
| Gross (g) | `grossWeightGrams` | number | right | ✓ |
| Net (g) | `netWeightGrams` | number | right | ✓ |
| Purity (K) | `purityKarat` | number | center | |
| Assessed Value | `assessedValue` | currency | right | ✓ |
| Loan Amount | `principal` | currency | right | ✓ |
| O/S Principal | `outstandingPrincipal` | currency | right | ✓ |
| Status | `releaseStatus` | badge | center | |

## 4. KPI cards
Active pledges · total net weight · total assessed value · total outstanding (reuse `gold/reports?type=summary`).

## 5. Filters
Date range, Branch, Ornament type, Release status, Purity.

## 6. API contract
`GET /api/v1/reports/gold-pledge-register?from?&to?&branchId?&releaseStatus?&ornamentType?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/gold-pledge-register.ts`)
`findMany` `GoldLoanCollateral` (scoped, `appType='goldloan'`) include ornaments + loan + customer; summarize
ornaments; map weights/values.

## 8. Export mapping
11 columns → CSV/Excel/PDF/Print. Filename `gold-pledge-register-<date>`.
> Tamil note: if the receipt-grade register must print Tamil, use the printable-HTML route style
> (`app/api/loans/[id]/gold-receipt/route.ts`) rather than react-pdf.

## 9. i18n keys
`reports.goldPledgeRegister.title`, `reports.col.packetNo|ornaments|gross|net|purity|assessedValue|loanAmount|osPrincipal`.

## 10. RBAC + subscription
Gold-module admin/manager; agent scoped. Module gate `appType='goldloan'`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over existing gold tables. No writes, no new columns, no change to gold valuation/servicing engine.

## 12. No-hardcode checklist
- [ ] Purity/karat fineness from existing `KARAT_FINENESS`/`lib/gold`. Rates from `AppSetting`/data.
- [ ] Ornament types from master data, not constants. Currency/labels from DB/i18n.

## 13. Test plan
Use `seed_gold_demo` (15 pledges) → assert register rows + weight/value totals; filter by status/ornament;
export matches; cross-module isolation (no microlending rows).
