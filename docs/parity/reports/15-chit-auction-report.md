# 15 · Chit Auction Report 💎

**Status:** 🆕 NEW · **Module scope:** `chitfunds` only · **Shell/exports:** [00-REPORT-FRAMEWORK.md](./00-REPORT-FRAMEWORK.md)

## 1. Purpose
Auction history per chit — month, winning bidder, bid/discount amount, dividend distributed to members. The
statutory chit auction record.

## 2. Source models (READ ONLY)
- `ChitAuction` (existing `chits/[id]/auctions`): month, winner, bidAmount/discount, dividend.
- `ChitMember`/`Customer` for winner identity.

## 3. On-screen table
| Column | key | type | align | total |
|---|---|---|---|---|
| Chit | `chitName` | text | left | |
| Month | `month` | text | center | |
| Auction Date | `auctionDate` | date | center | |
| Winner | `winnerName` | text | left | |
| Bid / Discount | `discount` | currency | right | ✓ |
| Prize Amount | `prizeAmount` | currency | right | ✓ |
| Dividend/Member | `dividendPerMember` | currency | right | |

## 4. KPI cards
Auctions held · total discount · total dividend distributed.

## 5. Filters
Chit (optional), Date range, Branch.

## 6. API contract
`GET /api/v1/reports/chit-auction?chitId?&from?&to?&branchId?` → `ok(payload)`.

## 7. Aggregation (builder `lib/reports/builders/chit-auction.ts`)
`findMany` chit auctions (scoped) in range; join chit + winner; compute dividend/member.

## 8. Export mapping
7 columns → CSV/Excel/PDF/Print. Filename `chit-auction-<from>-to-<to>`.

## 9. i18n keys
`reports.chitAuction.title`, `reports.col.month|auctionDate|winner|discount|prizeAmount|dividend`.

## 10. RBAC + subscription
Chit admin/foreman. Module gate `chitfunds`. Export gated per framework.

## 11. ⚠️ Core-untouched guarantee
Read-only over auction records. No writes, no new columns.

## 12. No-hardcode checklist
- [ ] Currency/labels from DB/i18n. No magic dividend formula beyond existing chit logic.

## 13. Test plan
Seed auctions → assert winner + discount + dividend; export matches.
