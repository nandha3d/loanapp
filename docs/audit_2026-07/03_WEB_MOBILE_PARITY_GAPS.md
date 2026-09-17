# Audit 03 — Web ↔ Mobile Feature Parity

> Status: **NOT IMPLEMENTED** (audit only). Audited 2026-07-17 @ `52add51`. Method: full web page tree (`app/(dashboard)/[module]/**` — one dynamic tree serves all six modules — plus `app/borrower/**`, `app/admin/**`, `app/portal/**`) mapped against every route in `mobile/lib/core/router/app_router.dart` + screens in `mobile/lib/features/**`.

## Staff parity matrix

| Feature | Web | Mobile | Parity |
|---|---|---|---|
| Dashboard / agent dashboard | `dashboard`, `agent-dashboard` | `dashboard_screen` (+ chit body) | FULL |
| Customers (list/new/detail) | ✅ | ✅ | FULL |
| Loans (list/new/detail/edit) | ✅ | ✅ + gold/property/product servicing sheets, NACH panel | FULL (mobile richer) |
| Collection queue + runs | ✅ | ✅ + offline queue, QR scan, voice, sync status | FULL (mobile richer) |
| **Collection self-pay verify queue** | `collection/self-pay` | — | **MISSING on mobile** (nice-to-have) |
| Penalties / Approvals / Analytics / Reports | ✅ | ✅ (reports = Overdue + Agent-Perf tabs) | FULL |
| Vehicles | ✅ | ✅ | FULL |
| Notifications | page + **delivery log** | page only | PARTIAL (log desktop-only, acceptable) |
| Accounting | overview + **~18 premium pages** (COA, journal, TB, P&L, BS, cashflow, budget, tax, vendors, bank-rec, period-lock, export, approvals) | overview + bank-rec only | PARTIAL — **intentional desktop-only** |
| Wallet / KYC review / Route tracking | ✅ | ✅ | FULL |
| Settings | hub + integrations + payment-gateway + **gold-master** | 12 settings screens | FULL except gold-master (nice-to-have) |
| Subscription/billing/affiliate/requests/admin (users, team, branches, billing, pricing) | ✅ | ✅ | FULL |
| NPA | — | `npa_screen` | mobile-only |

## Borrower parity

| Feature | Web | Mobile | Parity |
|---|---|---|---|
| Login | ✅ | ✅ | FULL |
| Loan dashboard (Dashboard/Schedule/History/Details/Calculator) | ✅ | ✅ identical 5 tabs | FULL |
| **Statement PDF download** | ✅ (`/api/borrower/statement`) | — | **MISSING on mobile** |
| Self-pay (UPI/PSP) | ✅ | ✅ | FULL |
| Chit contributions (current/overdue/upcoming/history + proof upload + receipts) | ✅ | ✅ exact mirror | FULL |
| **Live chit auction room** | — | `borrower_chit_live_screen.dart` | **mobile-only** (web borrowers cannot watch/bid) |

## Chit module deep-dive (active client module)

**Web-only capabilities (gaps on mobile):**
1. **Payment-proof review queue — CRITICAL, broken loop.** Web: `chits/payments` page + queue embedded in group detail (`components/chits/PaymentIntentsQueue.tsx`, approve/reject via `lib/chits/paymentIntents.ts`). Mobile: **nothing** — no endpoints in `endpoints.dart`, no methods in `chit_service.dart`, no screen. Borrowers *can submit* proofs from mobile, staff *cannot review* them on mobile.
2. **Reschedule auction period** — web modal in group detail; no mobile UI.
3. **Winner-summary copy/share** — web has copy-to-clipboard of `formatWinnerSummaryText`; mobile summary sheets have no share/copy.
4. **Edit member** (ticket no, nominee, phone) — web modal; mobile `chit_service.updateMember` exists but **no UI**.
5. **Config/compliance panel** — web detail renders chit configuration (dividend policy/rounding, winner interest) + compliance card; mobile shows KPIs only. Mobile edit form can change name/value/members/commission/date but **not** auction type/dividend/tie-break config (create-only dropdowns).
6. **Chit-specific reports** — web analytics/reports registry includes chit reports; mobile reports screen has none.

**Mobile-only capabilities (web lacks — informational, not defects):**
- Borrower live-auction room (1294-line screen); in-room chat + voice raise; push-to-talk bid audio proof.
- Offline chit payment queue with idempotency (`data/local/chit_payment_queue.dart`) + offline collection queue + sync status screen.
- Voice bid entry (`voice_bid_parser.dart`) and voice collection amounts; QR-scan collection.
- Biometric app lock + TOTP screens; dedicated NPA screen.

## Fix plan (implementation order)

1. **Mobile staff payment-proof queue (critical):**
   - New v1 routes wrapping the existing lib functions (no new business logic):
     - `app/api/v1/chits/payment-intents/route.ts` — GET, `?status=&groupId=`, via `listChitPaymentIntentsForStaff`, `requireMobileContext` + `canCollectChits`, appType hard-pinned `'chitfunds'`.
     - `app/api/v1/chits/payment-intents/[id]/route.ts` — POST `{action:'approve'|'reject', confirmedAmount?, rejectionReason?}` via `approveChitPaymentIntent` / `rejectChitPaymentIntent` (idempotency key `chit-intent:<id>` already guards double-post).
   - Mobile: endpoints + `chit_service.dart` methods (`paymentIntents/approveIntent/rejectIntent`), new `chit_payment_intents_screen.dart` mirroring the web queue (Pending/All tabs, claimed vs due, duplicate-reference banner, approve-with-amount, reject-with-reason, proof link), entry points on the chits list app bar + chit detail.
2. **Auction reschedule on mobile:** small v1 route `POST /chits/[id]/auctions/[auctionId]/reschedule` reusing web `rescheduleAuction` logic; date-picker action in the auction manage sheet.
3. **Winner-summary copy:** both mobile summary sheets get a Copy button (`Clipboard.setData`) using the `summaryText` the endpoints already return.
4. **Member edit sheet:** wire existing `chit_service.updateMember` to a small edit sheet in chit detail.
5. **Borrower statement on mobile:** borrower-JWT variant route `app/api/v1/borrower/statement` reusing the web generator; mobile fetches bytes via dio and opens with the already-present `printing` package (`Printing.sharePdf`) — no new dependency.
6. **Deferred (desktop-only by design, revisit on request):** accounting premium suite, gold-master settings, notification delivery log, collection self-pay queue, chit reports on mobile, mobile edit of full chit config.

## Verification

- Emulator (staff): Payment proofs screen lists pending intent → approve with amount → receipt no. displayed; borrower contributions screen flips to paid (same `collectChitSubscriptionPayment` path as web — money math identical by construction).
- Reject flow: reason required, borrower sees rejected + reason.
- Reschedule: pick new date → group detail + borrower next-due reflect it.
- Statement: opens share/print dialog with a valid PDF.
- Regression: web queue still works (shared lib functions untouched).
