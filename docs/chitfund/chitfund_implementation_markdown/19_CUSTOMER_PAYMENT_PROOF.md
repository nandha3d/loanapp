# Step 19 — Customer Payment Transaction Details + Proof Upload

> **Implementation status (2026-07-14): NOT IMPLEMENTED.** Borrower chit portal is read-only (`app/borrower/chits/page.tsx` + `lib/chits/customerPortal.ts` header comment: "Release 2 is visibility only. No bidding, no payment writes"). This doc adds the write path: customer uploads proof, staff approves, money posts through the existing collection engine.

## Goal

Requested: "customer payment transaction details and proof." Two parts: (1) richer receipt/transaction detail in the customer portal (reference number, mode, period, dividend applied), and (2) a way for the customer to say "I've paid — here's my UTR/screenshot" for an unpaid period, which staff reviews and approves before it posts as a real collection.

## Current state (verified)

- `lib/chits/customerPortal.ts:156-177` `getMyChitReceipts` already returns `receiptNo`, `receiptType`, `amount`, `paymentMode`, `issuedAt` — but not `referenceNo`/period/dividend breakdown. `getMyChitContributions` (`122-154`) has period/due/dividend/penalty/outstanding but no receipt linkage on the same row.
- `lib/chits/collections.ts:5-96` `collectChitSubscriptionPayment(tx, input)` is the **single authoritative** money-posting function: recomputes via `calculateChitPayment`, updates `ChitSubscription`, creates `ChitReceipt(receiptType:'collection')`, writes `AccountEntry(type:'collection')`, credits branch wallet (`chitContributionToBranch`). This is exactly what proof-approval must call — never hand-roll a second payment-posting path.
- Two existing proof/approval patterns to choose the design from:
  - `app/api/v1/collection/proof/photo/route.ts` (loan side) — agent files a photo-proof `PaymentApproval` row, **customer** approves in the borrower portal, only then does money post. Wrong direction for this feature (here it's the **customer** filing, **staff** approving).
  - `prisma/schema.prisma:2505-2526` `PaymentApproval` model — good shape reference (amount, paymentMode, proofType/photoPath, status pending/approved/rejected, rejectedReason, respondedAt) but is loan-specific (`loanId`, `instalmentId`) — chit needs its own model tied to `ChitSubscription`/`ChitMember`.
- `app/api/v1/upload/route.ts` — generic authenticated file upload (mobile context), returns `{ url, filename, size }`; validates MIME + size + magic bytes via `lib/fileUpload.ts`. Reusable as-is for proof images/PDFs from both web borrower portal and Flutter.
- `ChitDocument` (`schema.prisma:1395-1416`) — generic tenant/entity-scoped document row (`entityType`, `entityId`, `documentType`, `fileUrl`) already used for security documents (`app/api/v1/chits/[id]/auctions/[auctionId]/security/documents/route.ts:76-118`) — reuse this pattern for proof files (`entityType:'payment_intent'`).

## Schema changes

```prisma
model ChitPaymentIntent {
  id               String    @id @default(cuid())
  tenantId         String    @map("tenant_id")
  branchId         String?   @map("branch_id")
  memberId         String    @map("member_id")
  subscriptionId   String    @map("subscription_id")
  amount           Decimal?  @db.Decimal(14, 2)          // customer-claimed amount; nullable — staff confirms actual amount at approval
  paymentMode      String    @default("upi") @map("payment_mode")
  referenceNo      String?   @map("reference_no")          // UTR / transaction ref, customer-supplied
  proofDocumentId  String?   @map("proof_document_id")      // -> ChitDocument.id
  source           String    @default("portal") @map("source") // 'portal' | 'whatsapp' (doc 23 reuses this model)
  status           String    @default("pending")            // pending | approved | rejected
  reviewedById     String?   @map("reviewed_by_id")
  reviewedAt       DateTime? @map("reviewed_at")
  rejectionReason  String?   @map("rejection_reason") @db.Text
  receiptNo        String?   @map("receipt_no")             // set once approved & posted
  waMessageId      String?   @map("wa_message_id")          // doc 23 idempotency, unused for portal-sourced intents
  createdAt        DateTime  @default(now()) @map("created_at")

  @@index([tenantId, branchId, status])
  @@index([memberId])
  @@index([subscriptionId])
  @@map("chit_payment_intents")
}
```

Deliberately shared with doc 23's WhatsApp inbound path (`source` discriminates origin) rather than building two parallel "customer says they paid" models — a duplicate-UTR check (below) needs to see both sources together anyway.

## Backend design

**Customer side** — new `app/api/v1/borrower/chits/payment-intents/route.ts`:
1. `POST` body: `{ subscriptionId, amount?, paymentMode, referenceNo?, proofUrl }`. Resolve `memberId` from the borrower session **only** (never trust a body-supplied memberId, matching the existing rule in `customerPortal.ts`'s header comment) — look up the subscription's `memberId` and verify it belongs to `session.customerId` before proceeding.
2. Create a `ChitDocument(entityType:'payment_intent', documentType:'payment_proof')` row pointing at the already-uploaded `proofUrl` (upload happens first via the existing generic `/api/v1/upload` route, then this endpoint links it).
3. Create `ChitPaymentIntent{status:'pending', source:'portal'}`.
4. Notify staff (in-app `SystemNotification`, mirroring the loan-side pattern at `collection/proof/photo/route.ts:64-79`).

**Staff side**:
- New tenant-wide queue page — the client runs 40+ chit groups, so a **single cross-group inbox** is essential rather than only a per-group panel (per-group panel also provided for context when working a specific group). List pending intents newest-first, with proof thumbnail, group/member/period, claimed amount/reference; flag a duplicate-UTR banner when `referenceNo` matches another `ChitPaymentIntent` or `ChitReceipt.referenceNo` (cheap defensive check against a customer accidentally — or deliberately — submitting the same screenshot twice).
- Approve action (server action, transaction):
  ```ts
  async function approveChitPaymentIntent(intentId: string, confirmedAmount: number) {
    // re-fetch intent + subscription INSIDE the tx; re-check status === 'pending' (idempotency
    // guard against double-click / concurrent approval — same discipline as placeChitBid's idempotencyKey)
    const result = await collectChitSubscriptionPayment(tx, {
      ...scope, subscriptionId: intent.subscriptionId,
      currentPaidAmount: Number(subscription.paidAmount), dueAmount: Number(subscription.dueAmount),
      amount: confirmedAmount, mode: 'ADD_PAYMENT', paymentMode: intent.paymentMode,
      referenceNo: intent.referenceNo, idempotencyKey: `intent:${intentId}`, collectorId: scope.userId,
    });
    await tx.chitPaymentIntent.update({ where: { id: intentId },
      data: { status: 'approved', reviewedById: scope.userId, reviewedAt: new Date(), receiptNo: result.receiptNo } });
  }
  ```
  The `idempotencyKey: 'intent:'+id` flows into `ChitReceipt.idempotencyKey` (already a field, `schema.prisma:1475`, unique per tenant) — guarantees an intent can never post twice even under a retry/double-click.
- Reject action: `status:'rejected'`, `rejectionReason`, no money movement — notify customer.
- Notify customer both ways (approved → receipt details; rejected → reason) via the existing `notify()` dispatcher (new event keys, see doc 23 for the outbound event catalog — this doc can ship its notifications using plain in-app `SystemNotification` first if doc 23 isn't done yet, then swap to full `notify()` once doc 23's events exist).

## API routes

- `app/api/v1/borrower/chits/payment-intents/route.ts` — `POST` (create), `GET` (list own).
- `app/api/v1/chits/payment-intents/route.ts` — staff `GET` (tenant-wide queue, filterable by group/status).
- `app/api/v1/chits/payment-intents/[id]/route.ts` — staff `POST` with `{action:'approve'|'reject', confirmedAmount?, rejectionReason?}`.

## Web UI

- **Customer** (`app/borrower/chits/page.tsx`): on each unpaid/partial period row, add "I've paid — upload proof" opening a small form (amount, mode, reference no, file picker) → uploads via existing `/api/v1/upload` then posts the intent; show a "Pending review" badge on that period once submitted (query the member's own pending intents). Enrich the existing receipts section with `referenceNo` and the period/dividend line already computed in `getMyChitContributions` (join by matching `entityId` — receipts already carry `entityId: subscriptionId`).
- **Staff**: new page (likely `app/(dashboard)/[module]/chits/payments/page.tsx`) for the tenant-wide inbox, plus a smaller embedded panel inside `ChitGroupDetailClient.tsx` scoped to that group's pending intents.

## Mobile (Flutter)

- Borrower chit screens gain an "Upload payment proof" flow mirroring the web form: pick/capture image → upload via the existing mobile upload endpoint → POST the intent. Staff mobile (if the staff app surfaces collections) gets an equivalent approve/reject action, reusing whatever list/detail pattern the app already uses for other approval queues.

## Edge cases

- Customer submits an intent for an amount that doesn't match the actual due (over/under) — staff approval takes a `confirmedAmount` input independent of the customer's claimed `amount`, so staff can correct it (e.g. customer pays exact due but claims a rounded figure) — `collectChitSubscriptionPayment`'s existing partial-payment handling (`calculateChitPayment` status logic) takes over from there, no special-casing needed here.
- Subscription already fully paid by the time staff reviews (e.g. collected in cash by an agent in the meantime) — approval flow must re-check current `subscription.status`/`dueAmount` inside the transaction and reject/no-op with a clear error rather than posting an over-payment; surface this back to staff as "already settled — reject or record as advance" (advance-payment handling is out of scope here, just don't silently double-post).
- Duplicate reference number across two different customers (typo'd shared screenshot, or fraud attempt) — the duplicate-UTR banner is advisory only (staff makes the final call), not a hard block, since legitimate edge cases exist (bank references can collide across different narrow ranges in rare gateways).
- Proof file fails validation (`lib/fileUpload.ts` magic-byte check) — reuse the existing generic upload route's error responses verbatim, no new validation logic.

## Verification steps

- Unit test `approveChitPaymentIntent`'s idempotency: call twice concurrently (simulate via two transactions racing on the same intent), assert only one `ChitReceipt` is created (idempotencyKey uniqueness) and the second call's intent-status re-check catches the already-approved state cleanly.
- Integration: customer submits intent → appears in staff queue → approve → assert `ChitSubscription.paidAmount` updated, `ChitReceipt` + `AccountEntry(type:'collection')` created, branch wallet credited (reuses `collectChitSubscriptionPayment`'s own existing test coverage patterns if any exist under `tests/chits/`).
- Integration: reject flow posts no money, subscription unchanged, customer notified with reason.
- Manual: upload a non-image/non-PDF file, confirm rejection with the existing upload route's error message (no chit-specific duplication of that validation).

## Dependencies

Depends on nothing from Phase 1/2. Should land in Phase 3 alongside doc 22b (current-period views), since the "I've paid" button naturally sits on the current-period card. Doc 23 (WhatsApp inbound payments) reuses `ChitPaymentIntent` directly — build this model first, doc 23 only adds a second `source`.
