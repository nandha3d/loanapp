# 15 · Gold Maturity & Auction 💎

**Status:** 🆕 NEW · **Module scope:** `goldloan` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Pledges nearing scheme maturity or already overdue for redemption — the auction/notice pipeline. Pawn-brokers
must notice and auction unredeemed pledges; this is that watch-list.

## 2. Source models (READ ONLY)
- `GoldLoanCollateral` (`:874`): `interestPaidUpto`, `outstandingPrincipal`, `releaseStatus`.
- `Loan` (`:444`): `startDate`, scheme months, `endDate`. Scheme tenure + auction grace from `AppSetting`
  (`gold_scheme_months`, `gold_auction_grace_days`) — **config-driven**.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Packet No | `packetNo` | text | left | |
| Customer | `customerName` | text | left | |
| Pledge Date | `startDate` | date | center | |
| Maturity Date | `maturityDate` | date | center | |
| Days Overdue | `daysOverdue` | number | right | |
| O/S Principal | `outstandingPrincipal` | currency | right | ✓ |
| Interest Due | `interestDue` | currency | right | ✓ |
| Stage | `stage` | badge | center | |

`stage` ∈ {Maturing ≤30d, Matured, Auction-Eligible} from grace setting.

## 4. KPI cards
Maturing · matured-unredeemed · auction-eligible · total at-risk value.

## 5. Filters
Branch, Stage, asOf.

## 6. API contract
`GET /api/v1/reports/gold-maturity-auction?asOf?&branchId?&stage?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/gold-maturity-auction.ts`)
Per active pledge (scoped): maturityDate = startDate + scheme months; daysOverdue vs asOf; interest due via
existing `pledgeInterestDue()` (`lib/gold/pledgeInterest.ts`) — **reuse, do not reimplement**; stage by grace.

## 8. Export mapping
8 columns → CSV/Excel/PDF/Print. Filename `gold-maturity-auction-<asOf>`.

## 9. i18n keys
`reports.goldMaturityAuction.title`, `reports.col.pledgeDate|maturityDate|daysOverdue|interestDue|stage`, `reports.stage.maturing|matured|auctionEligible`.

## 10. RBAC + subscription
Gold admin/manager. Module gate `goldloan`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only. Interest via existing `pledgeInterestDue()`. Scheme/grace from `AppSetting`. No writes, no new
columns, no auction action performed.

## 12. No-hardcode checklist
- [ ] Scheme months + auction grace from `AppSetting`.
- [ ] Interest from existing engine. Currency/labels from DB/i18n.

## 13. Test plan
Seed pledges at varying ages → assert stage classification + interestDue matches engine; retune grace setting;
export matches.
