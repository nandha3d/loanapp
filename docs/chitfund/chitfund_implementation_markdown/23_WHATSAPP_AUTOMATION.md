# Step 23 — WhatsApp Automation (Inbound Payments, Outbound Automation, WA Bids)

> **Implementation status (2026-07-14): NOT IMPLEMENTED (inbound); PARTIAL (outbound).** MSG91 outbound WhatsApp already works for two chit reminder events. This doc adds a webhook-based inbound channel and expands outbound coverage — per the user's locked-in decision, **all three** scopes are in: customer payments+proof via WhatsApp, fuller outbound automation, and bidding by WhatsApp message.

## Goal / provider decision

User asked to "make a setup first, then we can subscribe and check later, or if it is free guide us." Recommendation: **Meta WhatsApp Cloud API direct**, not MSG91-only, because:
- A free **test phone number** is available for development/staging immediately, no business verification needed to start building.
- **Inbound messages and replies within the 24-hour customer service window are free** — this covers the bulk of this feature (payment proof photos, bid messages, and replies to those) at zero marginal cost.
- Outside the 24h window, **utility template messages cost ≈ ₹0.115/message** (Meta's India conversation pricing) — used only for proactive reminders/results, not for replying to something the customer just sent.
- MSG91 is kept as the **outbound fallback/alternate provider** (it's already wired and working for 2 events) — nothing about the existing MSG91 integration is removed, this doc adds Meta as the primary and lets a tenant choose per the settings UI below.

This directly answers the user's ask: build the setup now (webhook, provider abstraction, settings UI with a "how to get free WhatsApp Business API access" guide), and actual per-tenant enablement is a later "subscribe/configure" step the tenant does themselves from Settings, same as the existing MSG91 keys are configured today.

## Current state (verified)

- `lib/notify/events.ts` — `notify()` dispatcher (`169-300`), `EventKey` union currently has only 8 keys, 2 of them chit-related (`chit_auction_reminder_day`, `chit_auction_reminder_hour`, `16-18`). Templates + WA template names (`WA_TEMPLATES`, `64-73`) exist for both.
- `lib/notify/channels/whatsapp.ts` — MSG91-only `sendWhatsApp()`, settings-gated via `AppSetting` keys `msg91_auth_key`/`msg91_whatsapp_number`/`notify_channel_whatsapp` (per-tenant, encrypted auth key via `lib/pii.ts` `decryptField`).
- `app/api/cron/chit-auction-reminders/route.ts` — existing idempotent cron pattern: `CRON_SECRET` bearer auth, windowed queries (`windowFromNow`), idempotency via `reminder1DayAt`/`reminder1HourAt` timestamp fields on `ChitAuction`, batches of 100, `sleep(100)` between sends. **This is the template to copy** for the new `chit-due-reminders` cron.
- `app/api/webhooks/razorpay/route.ts` — existing webhook pattern to follow: rate-limited, signature-verified, typed payload, `HANDLED_EVENTS` allowlist.
- Doc 14 (bells) provides `placeChitBid`/`syncRoom` as the single bid-entry point WA bids must reuse. Doc 19 provides `ChitPaymentIntent` which WA inbound payments reuse directly (`source:'whatsapp'`). Doc 18 provides the `markedVia` pattern WA bids extend with a 4th value.

## Schema changes

```prisma
// Resolves an inbound Meta webhook's phone_number_id to a tenant — required because Meta webhooks
// are multi-tenant at the platform level (one Meta App, many tenants' numbers) unlike MSG91 where
// the tenant is already known from the outbound call context.
model WhatsAppEndpoint {
  id             String   @id @default(cuid())
  tenantId       String   @map("tenant_id")
  phoneNumberId  String   @unique @map("phone_number_id") // Meta's WABA phone_number_id
  displayPhone   String   @map("display_phone")
  accessTokenEnc String   @map("access_token_enc") @db.Text // encrypted via lib/pii.ts, same pattern as msg91_auth_key
  wabaId         String?  @map("waba_id")
  status         String   @default("active")
  createdAt      DateTime @default(now()) @map("created_at")
  @@map("whatsapp_endpoints")
}

model WhatsAppInboundMessage {
  id            String   @id @default(cuid())
  tenantId      String   @map("tenant_id")
  waMessageId   String   @unique @map("wa_message_id") // Meta's message id — idempotency key against webhook retries
  fromPhone     String   @map("from_phone")
  messageType   String   @map("message_type") // text | image | document
  body          String?  @db.Text
  mediaId       String?  @map("media_id")
  classifiedAs  String?  @map("classified_as") // payment_proof | bid | payment_text | help | unrecognized
  processedAt   DateTime? @map("processed_at")
  createdAt     DateTime @default(now()) @map("created_at")
  @@index([tenantId, fromPhone])
  @@map("whatsapp_inbound_messages")
}

// Multi-turn disambiguation state ("which chit group are you paying for?") keyed by phone —
// WhatsApp has no session/form concept, so ambiguous inbound messages need a tiny state machine.
model WaConversationState {
  id         String   @id @default(cuid())
  tenantId   String   @map("tenant_id")
  phone      String
  state      String   // 'awaiting_group_selection' | 'awaiting_bid_confirmation' | ...
  context    String?  @db.Text // JSON blob, e.g. { pendingProofDocumentId, candidateGroupIds }
  expiresAt  DateTime @map("expires_at")
  @@unique([tenantId, phone])
  @@map("wa_conversation_states")
}
```

```prisma
model ChitSubscription {
  // ...existing fields...
  reminderSentAt DateTime? @map("reminder_sent_at") // idempotency for the new due-reminder cron, mirrors ChitAuction.reminder1DayAt pattern
}
```

`ChitPaymentIntent` (doc 19) already has `source` and `waMessageId` fields reserved for this doc — no changes needed there beyond what doc 19 defines.

## Webhook: `app/api/webhooks/whatsapp/route.ts`

- **`GET`** — Meta's verification handshake: echo `hub.challenge` if `hub.verify_token` matches an env/setting secret.
- **`POST`** — inbound message processing:
  1. Rate-limit by IP (generous, same pattern as the Razorpay webhook, `checkRateLimit`).
  2. Verify `X-Hub-Signature-256` HMAC (Meta App Secret) — reject with 401 on mismatch, **before** touching the DB (mirrors the Razorpay webhook's verify-then-process order).
  3. Resolve tenant via `WhatsAppEndpoint.phoneNumberId` from the payload's `metadata.phone_number_id`.
  4. Unique-insert into `WhatsAppInboundMessage` keyed on `waMessageId` — **this is the idempotency guard against Meta's at-least-once delivery retries**; if the insert hits the unique constraint, return 200 immediately without reprocessing (Meta will retry on non-200, so still ack even on a duplicate).
  5. Classify:
     - Image/document attachment → `payment_proof`.
     - Text matching `/^BID\s+(\d+)/i` → `bid` (discount amount).
     - Text matching a UTR/amount-looking pattern (reuse a similar heuristic to what a "looks like a payment reference" check would need — digits + optional ₹/Rs prefix) → `payment_text`.
     - Anything else → `help` (send back a static menu of what the number understands).
  6. Route to the matching handler (below), mark `processedAt`.

## Inbound: payment proof / payment text → `ChitPaymentIntent`

- Image/doc classified as `payment_proof`: download the media via Meta's media API using the endpoint's access token, store via the existing upload pipeline conventions (`lib/fileUpload.ts` validation), create a `ChitDocument`, then create a `ChitPaymentIntent{source:'whatsapp', waMessageId}` — **reuses doc 19's model and staff approval queue entirely**; no separate WA-specific approval flow.
- Ambiguity: a phone number might belong to a member of more than one chit group (or the phone isn't uniquely tied to one `ChitMember` at all — customers can share a family phone). If more than one active membership matches, don't guess — reply asking "Which chit? 1) Green Chit 2,00,000 2) Blue Chit 50,000" and set `WaConversationState{state:'awaiting_group_selection'}` with the pending document attached in `context`; the next inbound text (`"1"` or `"2"`) resolves it. Single-match case skips straight to creating the intent.
- Confirmation reply sent back either way ("Got your payment proof for {group} period {n} — pending staff approval" or the disambiguation prompt).

## Inbound: bids via WhatsApp

- Text matching `BID <amount>` (discount amount, matching the format members already see in reminders/prompts):
  1. Resolve the sender's `ChitMember` for whichever group's auction is currently live for that phone (if ambiguous — multiple simultaneously-open live rooms for the same phone — use the same `WaConversationState` disambiguation as payment proof).
  2. **Never bypass the waiting-room approval gate**: if the group's `roomAdmission === 'approval'` and the member hasn't been admitted (per `ChitAuctionAttendance.admissionStatus`), reply "You're not yet admitted to this auction room — ask the organizer" rather than silently queuing the bid. This is a hard rule, not a UX nicety — WhatsApp bidding must respect exactly the same admission gate the web/mobile room UI enforces, or it becomes a bypass vector.
  3. Call `syncRoom(tx, auctionId)` (doc 14) then the shared `placeChitBid(tx, { ..., source: 'remote', idempotencyKey: 'wa:' + waMessageId })` — **the same function every other bid path uses**, so WA bids get identical floor/increment/anti-snipe/bell-reset validation for free, and the `idempotencyKey` means a Meta webhook retry can never double-post the same bid.
  4. Reply with the result: on success, "Bid accepted: discount ₹X, prize ₹Y. Next minimum: ₹Z" (reuses the same `minNextDiscount`/`minNextPrize` computation the room UIs already show); on rejection (below floor, room closed, already won, etc.), reply with the actual error message from `placeChitBid`'s thrown `Error` — these are already human-readable strings (e.g. "Bid discount must be at least 5%").
  5. Rate-limit: 6 bids/minute/phone (generous enough for legitimate rapid bidding, tight enough to blunt spam/abuse of the free inbound channel) — separate from the general webhook IP rate limit, keyed by phone number.
- `ChitAuctionAttendance.markedVia` (doc 18) gets a 4th value `'whatsapp'` — a bid via WA should also mark attendance the same way a room-join does (reuse the same `update: {}`-never-overwrite upsert pattern).

## Outbound: expanded event catalog

New `EventKey` entries in `lib/notify/events.ts` (alongside the existing `chit_auction_reminder_day`/`_hour`):
- `chit_due_reminder` — contribution due reminder, replaces/supplements the generic `payment_due_reminder` with chit-specific vars (group name, period, amount, dividend already credited if any).
- `chit_payment_received` — fires when a `ChitPaymentIntent` (doc 19) is approved, or a staff-collected payment posts normally — "₹X received for {group} period {n}, receipt {no}."
- `chit_payment_rejected` — fires when a `ChitPaymentIntent` is rejected, includes the reason.
- `chit_auction_result` — fires on auction confirm, sent to **all** members (not just the winner) — "Auction for {group} period {n}: {winner ticket} won at ₹X discount."
- `chit_winner_summary` — richer per-recipient version using `formatWinnerSummaryText()` (doc 15) as the message body — sent to the winner with their specific payout/dividend info, and to other members with their dividend-only info.

Each gets an EN/TA/HI template in `MESSAGES` and a `WA_TEMPLATES` entry (the WA template names must be pre-registered in the Meta Business Manager / MSG91 dashboard depending on active provider — document this as a manual setup step, same as the existing MSG91 templates already required manual registration per the `WA_TEMPLATES` comment at `events.ts:63`).

New cron `app/api/cron/chit-due-reminders/route.ts`, structured identically to `chit-auction-reminders/route.ts`: `CRON_SECRET` auth, windowed query on `ChitSubscription.dueDate` (window width should be **frequency-aware** using doc 16's `periodWindow` — a daily chit needs a same-day reminder, not a "due within 24-48h" window sized for monthly chits), idempotent via the new `ChitSubscription.reminderSentAt`, batched with the same `sleep(100)` throttling pattern.

## Provider abstraction

New `lib/wa/provider.ts`:
```ts
export interface WaProvider {
  sendTemplate(tenantId: string, phone: string, templateName: string, vars: string[]): Promise<{ success: boolean; error?: string }>;
  sendFreeform(tenantId: string, phone: string, body: string): Promise<{ success: boolean; error?: string }>; // only valid inside the 24h service window, used for webhook replies
}
```
`lib/wa/metaCloudProvider.ts` (new, primary) and `lib/wa/msg91Provider.ts` (thin wrapper around the existing `sendWhatsApp` in `lib/notify/channels/whatsapp.ts`, unchanged internals). `notify()`'s WhatsApp branch (`events.ts:227-248`) picks the provider per a new `whatsapp_provider` `AppSetting` (`'meta' | 'msg91'`, default `'msg91'` to keep existing tenants' behaviour unchanged until they opt in).

## Settings UI

New card in the Integrations/Settings tab: provider select (Meta / MSG91), Meta credentials (App Secret, access token, phone_number_id — encrypted at rest via the existing `lib/pii.ts` `encryptField`, same as `msg91_auth_key` today), a **computed, read-only webhook URL** (`https://{tenant-domain}/api/webhooks/whatsapp` or a shared platform URL with tenant resolution via `WhatsAppEndpoint` — decide based on whether custom domains need per-domain webhook registration in Meta, which they likely don't since Meta calls one fixed URL and tenant resolution happens via `phone_number_id` in the payload, not the URL), a "Send test message" button, and a short step-by-step guide text: (1) create a free Meta Developer account, (2) create a WhatsApp Business App, (3) note the free test number + phone_number_id, (4) generate a temporary/permanent access token, (5) paste both here, (6) register the webhook URL + verify token in Meta's dashboard, (7) send a test message to the test number from your own phone to confirm inbound works.

## Edge cases

- Meta webhook retries (at-least-once delivery) — fully covered by the `waMessageId` unique-insert idempotency guard; every downstream effect (bid, payment intent) additionally carries its own `idempotencyKey`/`waMessageId` uniqueness as a second layer.
- Tampered/missing signature — reject with 401 before any DB write, per the Razorpay webhook's established pattern.
- A phone number receiving inbound messages that doesn't match any `WhatsAppEndpoint` (wrong number, or tenant removed integration) — log and 200-ack without processing (never let an unresolvable inbound message throw a 500 that triggers Meta retry storms).
- 24-hour service window: freeform replies (`sendFreeform`) are only valid within 24h of the customer's last inbound message — outside that window, must fall back to a template send; the provider abstraction's `sendFreeform` should internally check/track this and fall back automatically rather than pushing that logic into every call site.
- `WaConversationState` staleness — `expiresAt` (short TTL, e.g. 10 minutes) so an abandoned disambiguation flow doesn't linger and confuse a later, unrelated message from the same phone.

## Verification steps

- Unit test the classifier (image → payment_proof, `BID 5000` → bid, plausible UTR text → payment_text, everything else → help).
- Unit test webhook idempotency: replay the same payload twice, assert exactly one `WhatsAppInboundMessage`/downstream effect.
- Unit test signature verification: tampered body → 401, valid body → 200 passthrough to processing.
- Integration: WA bid end-to-end — inbound `BID 5000` → `placeChitBid` called with correct params → reply sent with next-minimum; a second identical webhook delivery (simulated retry) does not double-bid.
- Integration: WA bid attempt for a `roomAdmission:'approval'` group with the member not yet admitted → rejected with the admission message, no bid created.
- Manual: full outbound reminder cron run against seeded due subscriptions, confirm `reminderSentAt` prevents re-sending on a second cron run within the same window.
- Manual: Meta test-number round trip — send an image from a personal phone to the test number, confirm it appears in the staff payment-intent queue (doc 19) with the correct group/member resolved (or the disambiguation prompt if ambiguous).

## Dependencies

Depends on doc 14 (bells/`syncRoom`, for WA bids), doc 15 (`formatWinnerSummaryText`, for winner-summary outbound), doc 18 (`markedVia` pattern, extended here), doc 19 (`ChitPaymentIntent`, reused directly for inbound payments). This is intentionally the **last** doc in the phase plan (Phase 4) since it's the biggest net-new surface and depends on the most prior work.
