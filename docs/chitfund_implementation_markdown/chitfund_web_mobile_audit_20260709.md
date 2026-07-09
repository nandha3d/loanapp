# Chit Fund Module Audit — Web + Mobile

Source inspected: `loanapp_source_20260709_122909.zip`

## Overall verdict

The chit fund module is partially complete. The core web lifecycle, web live auction room, backend bid validation, backend dividend calculation, basic security approval, collection, receipt, penalty and reversal flows exist. Mobile also has chit group, auction, bid, security, payout and payment service contracts.

However, the implementation is not fully production-ready for the checklist requested. The biggest gaps are web wallet isolation, mobile attendance UI, guarantor/KYC/security-cheque document upload for chit payout, offline chit collection queue, mobile live-room duration labeling, and one legacy mobile auction route that bypasses the shared finalization/dividend-distribution flow.

## Status legend

- PASS: implemented and aligned
- PARTIAL: present, but incomplete or has parity/UX gaps
- FAIL: requirement not met
- RISK: implemented but needs hardening before production

## 1. Chit Group Lifecycle & Configuration

### Web

Status: PASS / PARTIAL

What is present:

- Draft chit group creation exists in `app/(dashboard)/[module]/chits/new/ChitGroupForm.tsx`.
- Backend creation exists in `app/(dashboard)/[module]/chits/actions.ts#createChitGroup`.
- Chit configuration fields exist in `prisma/schema.prisma#ChitGroup`, including:
  - `chitValue`
  - `monthlyContrib`
  - `totalMembers`
  - `durationMonths`
  - `commissionPct`
  - `commissionBasis`
  - `dividendPolicy`
  - `dividendDistribution`
  - `minDiscountPct`
  - `maxDiscountPct`
  - `bidIncrement`
  - `tieBreakRule`
  - `hasForemanTicket`
- Customer enrollment exists through selected member IDs.
- Activation exists in `activateChitGroup()`.
- Activation generates subscriptions and auctions.
- Activation validates member count, ticket share, agreement status, registered chit compliance fields and foreman ticket rules.
- `LOTTERY_AMONG_TIED` is supported by the backend tie-break logic.

Gaps / risks:

- Web detail page reads chit groups without branch scoping in `app/(dashboard)/[module]/chits/[id]/page.tsx`.
- Auction detail page also reads auction/security data without active branch scoping in `app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/page.tsx`.
- Web activation supports foreman-ticket auto-resolution, but mobile activation does not.

Required fixes:

1. Add active branch scoping to web chit group detail page.
2. Add active branch scoping to web auction detail page and security lookup.
3. Keep activation logic centralized so web and mobile activation behave the same.

## 2. Mobile Customer Creation Without Collection Route

Status: PASS

What is present:

- `mobile/lib/features/customers/new_customer_screen.dart` checks whether the app is chitfund.
- Route is not required when `isChit` is true.
- Route dropdown is hidden for chit users.

Evidence:

- `_routeId` validation is skipped for chit users.
- Route field UI is wrapped under `if (!isChit)`.

## 3. Live Auctions & Bidding Room

### Web

Status: PASS / PARTIAL

What is present:

- Web auction page exists at `app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx`.
- Live room can be opened and closed.
- Duration and anti-snipe extension fields exist.
- Bids can be added.
- Bid history is shown.
- Attendance table is shown.
- Confirm highest bid is available.
- Lottery among tied bids is supported in `confirmAuction()`.
- Draw winner is supported in `drawAuctionWinner()` for lottery/fixed rotation.
- Dividend calculation is centralized in `lib/chits/calculations.ts`.
- Finalization is centralized in `lib/chits/finalize.ts#finalizeAuctionInTx`.

Dividend formula check:

The formula requested is:

```text
Dividend per member = (Winning Bid Discount - Admin Commission) / Total Members
```

The current calculation matches this only when:

```text
commissionBasis = BID_DISCOUNT
dividendPolicy = ALL_MEMBERS
```

If the chit group is configured as `commissionBasis = CHIT_VALUE` or `dividendPolicy = NON_WINNERS_ONLY`, the calculation intentionally changes.

### Mobile

Status: PARTIAL

What is present:

- `mobile/lib/data/services/chit_service.dart` has APIs for live state, room action, bid submission, attendance, confirm, draw, security and payout.
- Mobile bid submission sends `prizeAmount` to the backend.
- Backend derives `bidDiscount = chitValue - prizeAmount`.
- Backend validates min/max discount constraints in `assertValidPrizeAmount()`.

Gaps / risks:

- Attendance service exists, but attendance marking is not exposed clearly in the mobile auction UI.
- `mobile/lib/features/chits/chit_live_auction_screen.dart` labels the field as duration seconds but sends duration minutes after conversion.
- `mobile/lib/features/chits/chit_detail_screen.dart` still has a legacy “Record Winner” flow using `recordAuction()`.
- The legacy backend route `app/api/v1/chits/[id]/auctions/route.ts` confirms an auction but does not call `finalizeAuctionInTx()`, so it does not apply dividend distribution to subscription demands.

Required fixes:

1. Remove or hide mobile legacy `recordAuction()` winner flow.
2. Force mobile to use bid + confirm/draw endpoints only.
3. Add attendance marking UI in mobile auction detail/live auction screen.
4. Rename mobile live-room duration field to minutes or send seconds consistently.
5. Make the legacy route call `finalizeAuctionInTx()` or deprecate it.

## 4. Guarantors, Security & Disbursal

Status: PARTIAL / FAIL for document upload requirement

What is present:

- `ChitSecurity` model exists.
- Web and mobile can submit basic security details:
  - security type
  - security value
  - guarantor name
  - guarantor phone
  - details
- Web and mobile can verify/approve security.
- Prize payout is blocked until security is approved.
- Payout creates prize receipt and accounting entry through backend.

What is missing:

- No chit-specific guarantor photo upload.
- No chit-specific guarantor KYC document upload.
- No security cheque fields like cheque number, bank name, cheque date, cheque image, MICR/IFSC.
- No document review grid for chit security documents.
- Existing customer-level guarantor/photo/KYC support is not linked to `ChitSecurity`.
- Payout release does not expose configurable deduction fields at release time. It releases the stored auction `prizeAmount`.

Required fixes:

1. Extend `ChitSecurity` or add child tables for guarantors and security cheques.
2. Add upload API/UI for guarantor photo and KYC documents.
3. Add review/approve/reject workflow for uploaded chit security documents.
4. Add payout deduction breakdown if the business requires deduction during disbursal.

## 5. Installment Billing & Payments

Status: PASS / PARTIAL

What is present:

- Activation generates monthly subscription demands.
- Subscription has `baseDueAmount`, `dividendAmount`, `penaltyAmount`, `dueAmount`, `paidAmount`, `paymentMode`, receipt and reference fields.
- Finalized auction applies dividend to the next due period when `dividendDistribution = ADJUST_NEXT_DUE`.
- Web collection page has a chit-specific collection worklist.
- Web collection supports cash, UPI, bank and cheque.
- Backend payment uses additive payment mode and generates receipts.
- Mark missed/default exists.
- Penalty creation/payment/waiver exists.
- Receipt reversal exists.

Gaps / risks:

- Mobile chit detail payment records cash only in one place.
- Mobile chit group sheet supports cash/UPI/bank, but no offline queue.
- Offline collection queue is loan-instalment specific and syncs via `CollectionService.submit`, not chit subscriptions.
- No mobile offline chit collection queue found.
- Collection page shows `dueAmount`, which already includes dividend adjustment. It does not explicitly show `base contribution - dividend = net demand` breakdown in the collection worklist.

Required fixes:

1. Add mobile chit offline collection queue.
2. Add idempotency support for chit subscription collections.
3. Add UPI/bank/cheque selector to all mobile chit payment entry points.
4. Show contribution, dividend, penalty and net payable breakdown in web/mobile collection UI.

## 6. Module Isolation & Security

### Web

Status: FAIL

Requirement:

- `/chitfunds/wallet` should display 404.
- Wallet link should be hidden from sidebar.

Current behavior:

- Sidebar includes wallet for `chitfunds` and labels it as Branch Cash.
- `/wallet` is included in shared module routes, so `/chitfunds/wallet` is allowed.
- Wallet page shows “Agent Wallet Not Applicable” only for chit agents.
- Chit admins can still open branch cash wallet page.

Required fixes:

1. Remove `chitfunds` from wallet sidebar appTypes.
2. Remove `/wallet` from shared module routes or special-block it for `chitfunds`.
3. Add `if (appType === 'chitfunds') notFound()` in `app/(dashboard)/[module]/wallet/page.tsx`.
4. Add E2E test for `/chitfunds/wallet` returning 404.

### Mobile

Status: PASS / PARTIAL

What is present:

- Quick Create FAB hides New Loan, Collection Run, Create Route and Release Agent Wallet for chit users.
- Bottom nav for chit users shows Home, Chits, Accounts and More.
- Customer profile hides KPI strip, loans section and collection passbook button for chit users.

Gaps / risks:

- `/wallet` route still exists in `mobile/lib/core/router/app_router.dart`.
- Deep link route blocking for wallet is not clearly enforced for chit users.

Required fixes:

1. Add mobile route guard to redirect or block `/wallet` for chit users.
2. Add widget/integration test for Quick Create FAB and customer profile isolation.

## Priority Fix List

### P0 — must fix before production demo

1. Block `/chitfunds/wallet` on web and hide sidebar wallet link.
2. Add branch scoping to web chit group detail and auction detail page reads.
3. Remove or refactor mobile legacy `recordAuction()` path so dividend distribution always runs through `finalizeAuctionInTx()`.
4. Add mobile attendance UI.
5. Add mobile chit offline collection queue or remove offline claim from chit module.

### P1 — needed for production parity

1. Add guarantor photo/KYC upload and review for chit prize security.
2. Add security cheque fields and document upload.
3. Add full payment mode selector to all mobile chit payment paths.
4. Show demand calculation breakdown: contribution - dividend + penalty = payable.
5. Make web/mobile activation logic identical, including foreman ticket handling.

### P2 — hardening

1. Add E2E tests for lifecycle, activation, auction tie lottery, payout, reversal and module isolation.
2. Add mobile service/widget tests for attendance, bid validation errors and chit customer creation without route.
3. Add audit-log visibility in UI for auction draw, security approval, payout and reversal.
