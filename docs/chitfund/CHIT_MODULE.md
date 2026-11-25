# CHIT MODULE — Architecture & Implementation Reference

> **Precedence (`DOC-4`):** [ENGINEERING_REFERENCE.md](../../ENGINEERING_REFERENCE.md) (§10.9) is the normative, binding architectural reference for this module. This document summarizes the live Chit Funds implementation across database models, shared `lib/chits/` domain services, Next.js web/API surfaces, Flutter mobile screens, and tests.

---

## 1. Stack & Architectural Boundaries

- **Web & API:** Next.js 16.3 App Router · React 19.2 · TypeScript 5 · Prisma 5.22 · MySQL 8
- **Auth & Access:** Web Server Actions / Server Components (`lib/auth.ts`) + JWT Bearer API `/api/v1/chits/*` (`requireMobileContext`) + Borrower portal (`/borrower/chits/*` and `/api/v1/borrower/chits/*`)
- **Mobile:** Flutter (`mobile/lib/features/chits/*`, `mobile/lib/features/borrower/*`) consuming `/api/v1/*`
- **Module Isolation (`SCOPE-17` / `CHIT-33`):** Every entity is strictly isolated under `appType: 'chitfunds'`. Cross-module lending/chit coupling (bridge loans, loan EMI auto-settlement, combined route sheets) is intentionally excluded.
- **Single Shared Logic (`STRUCT-3`):** Web Server Actions (`app/(dashboard)/[module]/chits/actions.ts`, wrapped with `wrapChitAction()` to avoid Next.js production `Minified React error #441`) and `/api/v1/chits/*` routes delegate to the same `lib/chits/*` functions (`*InTx` taking `tx` as first argument).
- **Access Control (`lib/chits/access.ts`, `CHIT-29`, `SCOPE-15`):**
  - `canAdminChits(role)` → `admin | superadmin | developer`
  - `canCollectChits(role)` → `agent | admin | superadmin | developer`
  - `canApproveChitSecurity(role)` → `superadmin | developer` (deliberately separated from collection)
  - `scopedChitGroupWhere(scope, extra)` → enforces `{ tenantId, appType: 'chitfunds', deletedAt: null }` plus active `branchId` with **no role exemption**.

---

## 2. Database Schema (`prisma/schema.prisma`, 15 Models)

| Model | Purpose | Key Constraints / Notes |
|---|---|---|
| `ChitGroup` | Group definition, statutory registration, auction/dividend/bell/engine settings | `@@unique([tenantId, groupCode])` (tenant-scoped, never globally unique); `chitEngineType` + `engineConfig` JSON |
| `ChitMember` | Enrolled customer ticket (`ticketNo`, `fractionNo`, `ticketShare`), nominee, agreement status, `hasWon` | `@@unique([chitGroupId, customerId])`, `@@unique([chitGroupId, memberNumber])` |
| `ChitAuction` | Period auction/draw record, live room timing (`roomStatus`, `biddingOpensAt`, `biddingClosesAt`, `autoExtendSeconds`), bell state, calculation snapshot | `@@unique([chitGroupId, periodNumber])`; persists `calculationBreakdown` JSON, `reserveFloorAmount`, `goldRatePerGram` |
| `ChitBid` | Tap/voice/remote bids, passes, and retractions | `@@unique([auctionId, seq])`, `@@unique([auctionId, idempotencyKey])`; optional `audioDocumentId` |
| `ChitAuctionEvent` | Ordered legal minutes trail (`open`, `extend`, `announce`, `pass`, `close`, `winner`, `cancel`) | Indexed `(auctionId, createdAt)` |
| `ChitSubscription` | Per-member per-period instalment row (`baseDueAmount`, `dueAmount`, `dividendAmount`, `premiumAmount`, `deferredDividendAmount`, `interestAmount`, `penaltyAmount`, `paidAmount`, `goldRateApplied`, `goldGramsCredited`) | Indexed `(memberId, periodNumber)` |
| `ChitDocument` | Group/member/security/voice-bid documents | Scoped by `(tenantId, appType, entityType, entityId)` |
| `ChitAuctionAttendance` | Live-room presence & waiting-room admission (`admissionStatus`, `markedVia`: `staff \| room_join \| login \| whatsapp`) | `@@unique([auctionId, memberId])` |
| `ChitRoomMessage` | Live-room text and voice chat (`visibility`: `public \| organizer`, `messageType`: `text \| voice`, `audioUrl`, `audioDurationSec`) | Indexed `(auctionId, createdAt)` |
| `ChitPaymentIntent` | Borrower/WhatsApp-submitted payment claim awaiting staff approval | Indexed `(tenantId, branchId, status)` |
| `ChitReceipt` | Collection, dividend, and payout receipts (with reversal tracking) | `@@unique([tenantId, receiptNo])`, `@@unique([tenantId, idempotencyKey])` |
| `ChitSecurity` | Winner collateral gate (`securityType`, `guarantorMemberId`, `securityValue`, `status`) | Indexed `(tenantId, branchId, chitGroupId)`, `(auctionId, status)` |
| `ChitAuctionWinner` | Multi-division / per-cycle winner rows (lottery + auction winners, cash/gold/commodity assets) | `@@unique([auctionId, memberId])` |
| `ChitPoolTransaction` | Within-module ASCA/SHG internal pool loans, repayments, interest, and expenses | Scoped to `(tenantId, appType, chitGroupId)` |
| `ChitPenalty` | Late-fee penalties linked to `ChitSubscription` | Indexed `(tenantId, branchId, memberId)` |

---

## 3. 18 Chit Fund Engines & Per-Tenant Settings (`CHIT-31`)

Defined in `lib/chits/engineTypes.ts` and calculated server-side in `lib/chits/engineCalculator.ts`:

- **Category A — Bidding & Auction (`AUCTION`):** `AUCTION_STANDARD`, `AUCTION_RESERVE_PRICE`, `AUCTION_MULTI_DIVISION`, `AUCTION_UNCAPPED_ENTERPRISE`
- **Category B — Fixed, Chart & Non-Auction (`FIXED_CHART`):** `BASE_PLUS_PREMIUM`, `FIXED_CHART_ESCALATING`, `FIXED_DIVIDEND`, `FIXED_PAYOUT_VARIABLE_PAY`, `PURE_LOTTERY`, `FIXED_ROTATION`, `NEED_BASED_CONSENSUS`
- **Category C — Micro & Commodity (`MICRO_COMMODITY`):** `MICRO_DAILY_COLLECTION`, `GOLD_VALUE_ACCUMULATION`, `GOLD_WEIGHT_ACCUMULATION`, `FESTIVAL_COMMODITY`
- **Category D — Enterprise & Hybrid (`ENTERPRISE_HYBRID`):** `HYBRID_SPLIT_PHASE`, `ASCA_SHG_REVOLVING`, `CUSTOM_MANUAL_SCHEDULE`

**Cross-cutting configuration axes:**
- **Regulatory tiers (4):** `REGISTERED_ACT_1982`, `UNORGANIZED_INFORMAL`, `SHG_COOPERATIVE`, `MERCHANT_SAVINGS`
- **Scale tiers (4):** `MICRO`, `HOUSEHOLD`, `SME_TRADER`, `ENTERPRISE`
- **Frequencies (7, `lib/chits/frequency.ts`):** `DAILY_25`, `DAILY_30`, `WEEKLY`, `FORTNIGHTLY`, `MONTHLY`, `BI_MONTHLY`, `SEASONAL_HARVEST`
- **Payout assets (4):** `CASH`, `GOLD_WEIGHT`, `GOLD_VALUE`, `COMMODITY_GOODS`
- **Bidding modes (5):** `OPEN_LIVE`, `OPEN_MANUAL`, `SEALED_TENDER`, `ONLINE_APP`, `NONE`
- **Foreman compensation modes (6):** `PERCENTAGE_COMMISSION`, `FREE_TICKET_CYCLE_1`, `FREE_TICKET_CYCLE_2`, `FLAT_FEE`, `HYBRID`, `ZERO_COMMISSION`
- **Security collateral types (7, `lib/chits/securityTypes.ts`):** `NONE`, `INTERNAL_GUARANTOR_JAMEEN`, `PROMISSORY_NOTE`, `POST_DATED_CHEQUE`, `GOLD_PLEDGE`, `PROPERTY_DOCUMENT`, `FD_LIEN` (legacy aliases `guarantor`, `cheque`, `gold`, `property`, `fd` normalized)
- **Late fee types (3):** `FLAT_PER_DAY`, `PERCENTAGE_PA`, `NONE`

**Per-tenant enablement (`lib/chits/settings.ts`):**
- Stored in `AppSetting` keys `chit_enabled_types` and `chit_type_defaults`.
- Untouched tenants default strictly to `['AUCTION_STANDARD', 'PURE_LOTTERY', 'FIXED_ROTATION']` (`STABLE-2`).
- Both `createChitGroup` and `POST /api/v1/chits` enforce `assertChitEngineTypeEnabled()`. Config writes via `Settings → Chit Types` (`saveChitTypesConfigAction` / `PUT /api/v1/chits/settings`) require `superadmin | developer`.

---

## 4. Domain Services (`lib/chits/`, 37 files)

- **Access & Scope:** `access.ts`, `status.ts`, `types.ts`, `audit.ts`
- **Taxonomy, Validation & Settings:** `engineTypes.ts`, `validation.ts`, `settings.ts`, `templates.ts`, `templateGuides.ts`, `frequency.ts`
- **Calculations & Simulation:** `calculations.ts`, `engineCalculator.ts`, `winnerInterest.ts`, `simulator.ts`, `memberDividendLedger.ts`
- **Group & Auction Lifecycle:** `groupService.ts`, `auction.ts`, `bidService.ts`, `liveAuction.ts`, `bell.ts`, `lottery.ts`, `finalize.ts`, `attendanceAuto.ts`, `timeline.ts`, `winnerSummary.ts`
- **Security & Payout Gate:** `security.ts`, `securityTypes.ts`, `payout.ts`
- **Collections, Intents & Receipts:** `collections.ts`, `paymentIntents.ts`, `receipts.ts`
- **Customer Portal & Reporting:** `customerAuction.ts`, `customerPortal.ts`, `customerSummary.ts`, `reports.ts`, `periodReport.ts`, `periodReportPdf.tsx`

---

## 5. Key Rules & Money Invariants (`ENGINEERING_REFERENCE.md` §10.9)

- **Activation Gate (`CHIT-27`):** `validateChitGroupActivation()` gates moving a group live. `registered` chits require registration number/date, registrar office, by-law number, commencement certificate, approved bank, foreman name, full ticket integrity, signed/verified agreements, and foreman ticket validation.
- **Auction Arithmetic (`CHIT-1..6`, `CHIT-32`):**
  - `calculateChitAuction()` and `calculateChitPeriodEngine()` compute `bidDiscount`, `commission` (`BID_DISCOUNT` vs `CHIT_VALUE`), `gstAmount`, `distributableDividend`, per-ticket `dividend` (floored to `dividendRounding`), `roundingIncome` (foreman income, never discarded), reserve floors (`R_t = (x% * V) * (N - t + 1)`), gold weight credits (`g_t = S_t / R_t`), and `ticketShare` scaling.
  - `effectiveMinDiscountPct()` is the single source of truth for the starting bid floor across validation, `computeAutomatedBidBounds()`, staff live room, and customer live room (`CHIT-6`, `CHIT-35`).
- **Bidding & Live Rooms (`CHIT-7..12`, `CHIT-35..36`):**
  - All bids enter through `placeChitBid()` with `idempotencyKey`, `assertValidPrizeAmount()`, and `assertMonotonicBidDirection()`.
  - Live rooms (`open_live`) use 2–3s polling (`scheduled → open → extended → closed`), lazy `closeRoomIfExpired()` inside transactions, anti-snipe `autoExtendSeconds`, bell countdown resets (`bell.ts`), and `ChitRoomMessage` text/voice chat (`CHIT-36`). Live rooms never move money.
- **Finalisation & Payout Gate (`CHIT-13..18`, `CHIT-37`):**
  - `finalizeAuctionInTx()` is the sole finaliser: records winning bid/draw (`ChitAuctionWinner`), generates auction minutes (`CHIT-16`), sets `payoutStatus: 'security_pending'`, creates a pending `ChitSecurity` row, applies dividend distribution and winner interest, and writes `createChitAudit()`.
  - `assertCanReleasePrizePayout()` blocks prize release until auction is `confirmed | payout_pending`, `securityStatus === 'approved'`, `payoutStatus === 'ready'`, positive prize exists, and no active internal guarantor Jameen lock (`guarantorMemberId` unpaid overdue periods) applies.
  - `releaseChitPrizePayout()` prevents double payouts via `AccountEntry` lookup and debits branch cash float only when `paymentMode === 'cash'` (`MONEY-17`, `CHIT-34`).
- **Dividends, Winner Interest & Collections (`CHIT-19..25`, `CHIT-32`, `CHIT-34`):**
  - Dividend distribution supports `ADJUST_NEXT_DUE` (only unpaid/non-`paid` subscriptions), `ACCUMULATE`, `CASH_PAYOUT`, `DEFERRED_BONUS_POOL`, and `NONE`.
  - `applyWinnerInterest()` updates both `interestAmount` and `dueAmount` across `wonPeriod + 1 .. min(totalMembers, wonPeriod + winnerInterestPeriods)` for non-`paid` subscriptions.
  - `collectChitSubscriptionPayment()` supports `ADD_PAYMENT` and `SET_TOTAL_PAID` (posting `receivedDelta > 0`), writes `ChitReceipt` (`generateChitReceiptNo`), `AccountEntry`, and credits branch pool on `cash` only. Receipt reversals run atomically inside a transaction.
- **Reports & Transparency (`CHIT-32`, `CHIT-38`):**
  - `buildChitGroupDividendLedger()` / `buildMemberChitDividendStatement()` (`GET /api/v1/chits/[id]/ledger`) and `simulateChitLifecycle()` (`simulateChitTemplateAction()`) run server-side (`STABLE-8`).
  - `buildChitPeriodReportData()` + `ChitPeriodReportPDF` generate per-period settlement and cash-in-hand PDFs.

---

## 6. Surfaces

### Web Staff Pages & Actions (`app/(dashboard)/[module]/`)
- `chits/page.tsx` — Group list & KPIs
- `chits/new/page.tsx` (`ChitGroupForm.tsx`) — Group creation with engine template/config & simulator preview
- `chits/[id]/page.tsx` (`ChitGroupDetailClient.tsx`) — Overview, members, agreements, auctions, subscriptions, dividend ledger, ASCA pool transactions, penalties
- `chits/[id]/edit/page.tsx` (`ChitGroupEditForm.tsx`) — Edit group details
- `chits/[id]/auctions/[auctionId]/page.tsx` (`AuctionDetailClient.tsx`) — Live auction room, voice/text chat, admission queue, manual/sealed bids, lottery draw, confirmation, collateral submission/review (`CHIT-37`), prize payout, period PDF link
- `chits/payments/page.tsx` — `ChitPaymentIntent` review queue
- `collection/ChitCollectionClient.tsx` — Chit subscription collection workbench
- `settings/chit-types/ChitTypesSettingsClient.tsx` — Per-tenant 18-engine enablement & defaults
- `chits/actions.ts` — Server actions (`createChitGroup`, `activateChitGroup`, `addAuctionBid`, `retractLiveMemberBid`, `confirmAuction`, `drawAuctionWinner`, `submitChitSecurity`, `reviewChitSecurityDocument`, `releasePrizePayout`, `recordChitPayment`, `openLiveRoom`, `closeLiveRoom`, `ringLiveBell`, `postRoomMessage`, `postRoomVoiceMessage`, `decideRoomAdmission`, `markPaymentMissed`, `cancelChitGroup`, `updateChitGroup`, `approveChitPaymentIntentAction`, `rejectChitPaymentIntentAction`, `recordAscaPoolTransaction`, `simulateChitTemplateAction`, etc.)

### Staff & Period Report APIs (`app/api/`)
- `/api/chits/[id]/auctions/[auctionId]/report` — Period settlement PDF (session auth)
- `/api/v1/dashboard/chits` — Chit dashboard summary
- `/api/v1/chits` — List/create groups; `/api/v1/chits/settings` — Chit type settings
- `/api/v1/chits/[id]` (GET/PATCH), `/activate`, `/cancel`, `/ledger`, `/members`, `/members/[memberId]`, `/members/[memberId]/agreement`, `/subscriptions`, `/payments`, `/pool-transactions`
- `/api/v1/chits/[id]/auctions` & `/api/v1/chits/[id]/auctions/[auctionId]/*`: `admission`, `admit`, `attendance`, `bid`, `bids`, `close`, `confirm`, `draw`, `join`, `live`, `messages`, `open`, `pass`, `payout`, `report`, `reschedule`, `retract`, `room`, `schedule`, `security`, `security/documents`, `security/documents/[documentId]`, `state`, `summary`, `timeline`, `undo`
- `/api/v1/chits/payment-intents` & `/payment-intents/[id]`
- `/api/v1/chits/receipts/[receiptId]/reverse`
- `/api/v1/chits/subscriptions/[id]/miss`
- `/api/v1/chits/[id]/penalties`, `/penalties/[penaltyId]/pay`, `/penalties/[penaltyId]/waive`

### Borrower Portal & APIs
- Web: `app/borrower/chits/page.tsx` (`MemberDividendBreakdownCard.tsx`, `PaymentProofButton.tsx`), `app/borrower/chits/[id]/auctions/[auctionId]/page.tsx` (`BorrowerChitRoomClient.tsx`), `app/borrower/dashboard/ChitOnlyPanel.tsx`
- Session API: `/api/borrower/chits/payment-intents`, `/api/borrower/chits/[id]/auctions/[auctionId]`
- JWT API v1: `/api/v1/borrower/chits/contributions`, `/payment-intents`, and `/api/v1/borrower/chits/[id]/auctions/[auctionId]/{bids,join,live,messages,summary,timeline}`

### Mobile Flutter (`mobile/lib/`)
- Staff screens: `features/chits/chits_screen.dart`, `chit_form_screen.dart`, `chit_detail_screen.dart`, `chit_live_auction_screen.dart`, `chit_payment_intents_screen.dart`, `features/dashboard/widgets/chit_dashboard_body.dart`
- Borrower screens: `features/borrower/borrower_chit_contributions_screen.dart`, `borrower_chit_live_screen.dart`
- Services, models & offline/voice helpers: `chit_service.dart`, `borrower_chit_service.dart`, `chit.dart`, `chit_contribution.dart`, `chit_dashboard_summary.dart`, `chit_live.dart`, `chit_payment_queue.dart`, `bid_amount_parser.dart`, `voice_bid_parser.dart`, `dividend_breakdown.dart`

### Cron (`app/api/cron/`)
- `/api/cron/chit-auction-reminders` — Uses `authorizeCron()` (`CRON-1`, `SEC-13`), dispatches 1-day and 1-hour reminders, stamps `reminder1DayAt` / `reminder1HourAt` for idempotency (`CRON-6`).

---

## 7. Status Values (`lib/chits/status.ts`)

| Constant | Values |
|---|---|
| `CHIT_GROUP_STATUS` | `draft \| registered \| active \| suspended \| cancelled \| closed` |
| `CHIT_COMPLIANCE_STATUS` | `draft \| registered \| active \| suspended \| closed` |
| `CHIT_MEMBER_STATUS` | `active \| defaulted \| substituted \| removed \| closed \| vacant` |
| `CHIT_AGREEMENT_STATUS` | `pending \| signed \| verified \| rejected` |
| `CHIT_AUCTION_STATUS` | `pending \| notice_sent \| in_progress \| completed \| confirmed \| payout_pending \| paid \| cancelled` |
| `CHIT_PAYOUT_STATUS` | `not_ready \| security_pending \| ready \| paid` |
| `CHIT_SECURITY_STATUS` | `pending \| submitted \| verified \| approved \| rejected` |

---

## 8. Test Coverage

- **CI-wired (`npm run test:ci`):** `test:chits:engines`, `test:chits:settings-ledger`, `test:chits:leakage`, `test:chits:simulator`, `test:chits:automated`, `test:chits:security-report`
- **Full chit unit suite (`npm run test:chits`):** adds `chitCalculation`, `chitWinnerInterest`, `chitSecurity`, `chitFrequency`, `chitBidFloor`, `chitBell` (`tests/chits/*.test.ts`)
- **Additional chit API/summary/E2E suites:** `tests/chits/*.test.ts` (`chitAuctionWorkflow`), `tests/chit*.test.ts` (`chitAccountingSummary`, `chitCustomerSummary`, `chitNotificationContracts`, `chitsApi`, `chitSettlement`), `tests/e2e-business/chits*.test.ts`, `tests/e2e-business/chitCustomerLiveBidding.test.ts`, `tests/e2e/chitfunds/*.spec.ts` (`npm run test:cf`), `tests/e2e/new-modules/01-chits.spec.ts`
