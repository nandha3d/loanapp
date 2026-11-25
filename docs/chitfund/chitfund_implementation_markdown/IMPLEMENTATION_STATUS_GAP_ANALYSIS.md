# Chit Fund Module — Implementation Status & Gap Analysis

Audited: 2026-07-08, branch `merged-all-branches`, against migration `20260708000000_chitfund_production_upgrade`.
Compares the roadmap docs (steps 00–12 in this folder) with the code actually present in the repo. Every claim below carries a file reference; re-verify against the working tree before acting on it.

## TL;DR

**The backend is essentially done. The UI is not.** Schema, calculation engine, all ~20 mobile/API routes, 17 web server actions, report builders, seed and backfill scripts are implemented and committed. But the web pages and Flutter screens are still the pre-upgrade MVP: the group form exposes none of the new chit options, and the detail page can only run the legacy "record winner / record payment" flow. Six backend logic gaps also remain (lottery draw, tie-break rule, fractional dividend weighting, cash/accumulate dividend distribution, foreman-ticket auto-resolution, a bid-status bug), plus one broken report link and the whole live-auction room (step 12).

## Status matrix by roadmap step

| Step | Doc | Backend | Web UI | Mobile UI | Notes |
|---:|---|---|---|---|---|
| 1 | Database & schema | ✅ Done | — | — | All 6 new models + all variant/compliance/receipt fields present (`prisma/schema.prisma:1169-1460`); migration + `scripts/backfill-chit-schema.ts` exist. Doc's "no migrations exist" premise is historical. |
| 2 | Shared calculation engine | ✅ Done | — | — | `lib/chits/calculations.ts` config-driven (commissionBasis, GST, dividendRounding + roundingIncome). Web action and both API auction routes use it (`actions.ts:467`, `api/v1/chits/[id]/auctions/route.ts:90`, `.../confirm/route.ts:39`). Web/mobile money mismatch is fixed. |
| 3 | Compliance & registration | ✅ Done | ❌ Missing | ❌ Missing | `activateChitGroup` (`actions.ts:188`) + `POST /api/v1/chits/[id]/activate` validate chitType-branched compliance, ticket shares, foreman ticket. **No web page calls it** (no activate button anywhere in `app/(dashboard)`); Flutter `chit_form_screen.dart` has zero compliance fields. |
| 4 | Agreement / KYC / nominee / ticket | ✅ Done | ❌ Missing | ❌ Missing | Member update, agreement sign/verify/reject actions + routes exist (`actions.ts:289-357`, `api/v1/chits/[id]/members/[memberId]/*`). No web/member-edit UI, no mobile screen uses them. |
| 5 | Auction workflow (bids/attendance/minutes) | ✅ Done | ❌ Missing | ⚠️ Service only | Bids, attendance, notice, confirm with minutes + audit all implemented (`actions.ts:359-546`). No auction detail page exists (`app/(dashboard)/[module]/chits/[id]/auctions/` absent); `ChitGroupDetailClient.tsx` still calls only legacy `recordAuctionWinner`. Flutter `chit_service.dart` has addBid/markAttendance/confirmAuction but no screen calls them. |
| 6 | Security / surety before payout | ✅ Done | ❌ Missing | ⚠️ Service only | Confirm sets `payoutStatus=security_pending` + creates ChitSecurity (`actions.ts:504,512`); `releasePrizePayout` gated by `assertCanReleasePrizePayout` and idempotent. No web security-approval page; mobile submitSecurity/reviewSecurity/releasePayout unused by screens. |
| 7 | Collections / receipts / penalties / reversals | ✅ Done | ⚠️ Partial | ⚠️ Service only | `collectChitSubscriptionPayment` posts receipt + account entry + wallet in one helper; payments route uses it (`api/v1/chits/[id]/payments/route.ts:43`); penalties create/pay/waive + receipt reverse routes exist. Web collection UI (`ChitCollectionClient.tsx`, detail modal) doesn't capture payment mode/reference or show receipt numbers; no penalty/reversal UI. |
| 8 | Reports & dashboards | ✅ Done | ⚠️ One broken link | — | 13+ builders registered with aliases (`lib/reports/registry.ts:212-232`), incl. `vacant-chit-report`. **Gap:** analytics links `prized-subscriber-report` (`analytics/page.tsx:355`) but registry only has `chit-prized-subscriber-report` / `chit-prized-subscribers` → that click still fails. Other 3 formerly-broken slugs now aliased. |
| 9 | Branch security / RBAC / parity | ✅ Done | — | — | `lib/chits/access.ts` (`getWebChitScope`, `scopedChitGroupWhere`, `assertChitRole`) used across actions/routes; `tests/chits/chitSecurity.test.ts` exists. Mobile service parity done at method level. |
| 10 | Tests / seed / release checklist | ⚠️ Partial | — | — | `chitCalculation` + `chitSecurity` suites and `seed-chit-demo.ts` exist; `test:chits`, `seed:chits`, `backfill:chits` scripts wired; e2e `chitsVehicleSpecialModules.test.ts` covers group creation. Missing: compliance, collections, auction-workflow, payout, reports suites (5 of 7); QA evidence file. |
| 11 | Chit types & group options | ✅ Done (storage+validation) | ❌ Missing | ❌ Missing | All config columns live (`schema.prisma:1197-1208`), `validateChitConfig` enforces enums, subscriptions are ticketShare-weighted (`actions.ts:250`). But `ChitGroupForm.tsx` (164 lines) submits none of these — every group silently gets defaults. Runtime behavior for several options is also incomplete (gaps 3–8 below). |
| 12 | Live auction room / lottery draw | ❌ Not implemented | ❌ | ❌ | No `roomStatus`/`biddingOpensAt`/`biddingClosesAt` fields, no live/room/draw routes, no `lib/chits/liveAuction.ts` or `lottery.ts`. Doc 12 remains the spec. |

## Backend vs UI: the dominant finding

| Layer | State |
|---|---|
| Prisma schema + migration | Complete |
| `lib/chits/` engine (12 files) | Complete |
| API routes (`app/api/v1/chits/**`) | Complete except live room/draw |
| Web server actions (17 exported) | Complete except draw/tie-break/distribution gaps |
| **Web pages** | **Legacy MVP** — `ChitGroupForm.tsx` has no chitType/auctionType/dividend/compliance fields; `ChitGroupDetailClient.tsx:5` imports only `recordAuctionWinner, recordChitPayment, markPaymentMissed, cancelChitGroup`; 13 of 17 actions unreachable from any page |
| **Flutter screens** | **Legacy MVP** — `chit_service.dart` has all 25+ methods, but `chit_detail_screen.dart` (680 lines) calls none of the auction/security/penalty ones; `chit_form_screen.dart` has no new fields |

Practical consequence: a user today cannot create anything but a default (unregistered, open_manual, monthly, 5% on discount, ALL_MEMBERS/ADJUST_NEXT_DUE) group, cannot activate a draft group, cannot record attendance or multiple bids, cannot approve security or release a gated payout — from either client. The features exist only for API callers.

## Backend logic gaps (small, high-value fixes)

1. **`tieBreakRule` is dead config.** `getWinningBid` (`lib/chits/auction.ts:4-11`) hard-codes highest-discount → earliest-bid. `LOTTERY_AMONG_TIED` is validated at creation and then never honored. Fix: pass the group's rule into `getWinningBid`; on tie with `LOTTERY_AMONG_TIED`, run the audited draw (doc 12 §lottery).
2. **Lottery / fixed_rotation groups cannot complete a period.** `confirmAuction` throws without a bid (`actions.ts:463`) and there is no draw endpoint; `calculateFixedDiscountPrize` (`lib/chits/calculations.ts:56`) is never called from any auction path. Fix: implement the draw route from doc 12 that creates a synthetic winning bid from `fixedDiscountPct`, then reuses the normal confirm flow.
3. **`hasForemanTicket` is validation-only.** Activation checks exactly one foreman ticket (`actions.ts:231-232`) but period 1 is not auto-resolved to the foreman ticket as doc 11 §7 specifies.
4. **Dividend ignores `ticketShare`.** Subscription dues are share-weighted (`actions.ts:250-251`) but the dividend credit is flat per member row (`actions.ts:533`). Two half-ticket holders receive 2× a full ticket's dividend between them. Fix: per-member `dividendAmount = calc.dividend × ticketShare` (needs per-row update instead of `updateMany`).
5. **`CASH_PAYOUT` / `ACCUMULATE` dividend distributions are silent no-ops.** Only the `ADJUST_NEXT_DUE` branch exists (`actions.ts:523`). Groups configured with the other two record dividend on the auction but never deliver it to members. Fix per doc 11 §5: cash payout → `ChitReceipt(receiptType=dividend_payout)` + account entry + wallet debit; accumulate → per-period member ledger rows for the dividend register.
6. **Bid-resurrect bug in confirm.** `confirmAuction` first runs `updateMany({ where: { auctionId }, data: { status: 'valid' } })` (`actions.ts:491`), flipping withdrawn/rejected bids back to valid before marking the winner. Later reports/audits see falsified bid history. Fix: drop that statement (or scope it to `status: 'winning'` → `'valid'` to demote a previous provisional winner only).
7. **One broken report slug.** Add `'prized-subscriber-report': buildChitPrizedSubscribers` to `lib/reports/registry.ts` (analytics uses the bare slug at `analytics/page.tsx:355`). One line.

## Doc-vs-reality corrections (historical notes)

- Doc 01's premise ("`prisma/migrations` only contains `migration_lock.toml`", baseline instructions) predates the current tree — 26 migrations are committed, `.gitignore:113-114` explicitly keeps them. Only incremental migrations are needed from here.
- Docs 02–09 "current issue" sections describe the pre-upgrade code (commission-from-prize mismatch, instant payout, blind `dueAmount` decrement). All three of those specific defects are fixed in the committed implementation. Read those sections as history, not as open work.
- Doc 10's release checklist and QA evidence file remain unexecuted — still valid work items.

## Remaining work, in priority order

1. **Web UI for the implemented backend** (biggest user-visible payoff):
   - Group form → the 8-section wizard of doc 11 §9 (chitType, auctionType, frequency, commission/dividend/bid options, foreman ticket, compliance section for registered chits).
   - Group detail → compliance card + activate button (`activateChitGroup`), member table with ticket/agreement/nominee actions, subscription table with receipt/penalty columns.
   - Auction detail page (doc 05 layout): attendance, bid entry + history, confirm with minutes; security submit/verify/approve + payout release (doc 06).
   - Collection UI: payment mode, reference no, receipt display, reversal.
2. **Flutter screens** wiring the already-complete `chit_service.dart` methods (auction detail, security/payout status, penalty, receipt no. after collection; form fields for new options).
3. **Backend logic gaps 1–6 above** — each is a focused, testable change in `actions.ts` / `lib/chits/`.
4. **Registry alias** (gap 7) — one line.
5. **Live auction room + audited lottery draw** — implement doc 12 (also closes gaps 1–2 cleanly).
6. **Remaining test suites** (compliance, collections, auction workflow, payout, reports) + `Testing/qa_evidence/chitfunds/` per doc 10.

## Re-verification commands

```bash
npm run test:chits                      # calculation + security suites
grep -n "recordAuctionWinner" "app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx"   # legacy UI still?
grep -n "prized-subscriber-report" lib/reports/registry.ts   # alias added?
grep -rn "roomStatus" prisma/schema.prisma                   # live room started?
```
