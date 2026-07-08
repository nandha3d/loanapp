# Step 6 — Prize Payout, Surety, and Security Approval

> **Implementation status (2026-07-08): BACKEND DONE, UI MISSING.** Security record auto-created on confirm; `releasePrizePayout` is gated by approved security, idempotent, posts account entry + wallet debit + receipt. No web security-approval page; mobile service methods exist but no screen calls them. See `IMPLEMENTATION_STATUS_GAP_ANALYSIS.md`.

## Goal

Prevent direct prize payout until the prized subscriber submits required surety/security and the business approves it.

Current issue:

- Existing web and mobile auction flows post prize payout immediately after recording winner.
- Real chit operations normally require surety/security verification before prize money release.

Target state:

- Auction confirmation creates a payout requirement.
- Winner security/surety is collected.
- Admin verifies and approves security.
- Only approved payout can release money.
- Payout creates account entry, wallet debit, receipt/voucher, and audit log.

## Files to create

```txt
lib/chits/security.ts
lib/chits/payout.ts
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/security/page.tsx
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/security/SecurityApprovalClient.tsx
app/api/v1/chits/[id]/auctions/[auctionId]/security/route.ts
app/api/v1/chits/[id]/auctions/[auctionId]/payout/route.ts
```

## Files to update

```txt
app/(dashboard)/[module]/chits/actions.ts
app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx
app/api/v1/chits/[id]/auctions/route.ts
mobile/lib/data/models/chit.dart
mobile/lib/data/services/chit_service.dart
mobile/lib/features/chits/chit_detail_screen.dart
lib/wallet.ts
```

## Data model

Use `ChitSecurity` from Step 1.

Recommended security statuses:

```txt
pending -> submitted -> verified -> approved -> rejected
```

Recommended payout statuses on `ChitAuction`:

```txt
not_ready -> security_pending -> ready -> paid
```

## Business process

### After auction confirmation

Set:

```txt
ChitAuction.status = confirmed
ChitAuction.payoutStatus = security_pending
```

Create default `ChitSecurity` record:

```txt
status = pending
securityType = pending
winnerMemberId = auction.winnerMemberId
```

### Security submission

Admin/branch user enters:

- Security type: guarantor, property, gold, FD, salary, cheque, other
- Security value
- Guarantor name
- Guarantor phone
- Details/remarks
- Uploaded documents through `ChitDocument`

### Security verification

Verifier checks documents and marks:

```txt
status = verified
verifiedById = current user
verifiedAt = now
```

### Security approval

Approver marks:

```txt
status = approved
approvedById = current user
approvedAt = now
```

Then update auction:

```txt
payoutStatus = ready
```

### Payout release

Only when:

- Auction status is `confirmed` or later.
- Payout status is `ready`.
- Security status is `approved`.
- Winner exists.
- Prize amount exists.
- Payout has not already been posted.

Then:

1. Create account entry `type = chit_payout`.
2. Debit branch wallet using existing `chitPayoutFromBranch`.
3. Create `ChitReceipt` or payout voucher record.
4. Set `ChitAuction.payoutStatus = paid`.
5. Audit log.

## Create payout helper

Create `lib/chits/payout.ts`:

```ts
import prisma from '@/lib/db';

export async function releaseChitPrizePayout(tx: any, input: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  auctionId: string;
  amount: number;
  periodNumber: number;
  userId: string;
}) {
  const existingEntry = await tx.accountEntry.findFirst({
    where: {
      tenantId: input.tenantId,
      referenceId: input.auctionId,
      referenceType: 'chit_auction',
      type: 'chit_payout',
    },
  });

  if (existingEntry) {
    throw new Error('Prize payout already posted for this auction');
  }

  await tx.accountEntry.create({
    data: {
      tenantId: input.tenantId,
      appType: input.appType,
      entryDate: new Date(),
      type: 'chit_payout',
      category: 'cash',
      amount: input.amount,
      description: `Chit prize payout — period ${input.periodNumber}`,
      referenceId: input.auctionId,
      referenceType: 'chit_auction',
      createdBy: input.userId,
      branchId: input.branchId || undefined,
    },
  });

  if (input.branchId) {
    const { chitPayoutFromBranch } = await import('@/lib/wallet');
    await chitPayoutFromBranch(tx, {
      tenantId: input.tenantId,
      appType: input.appType,
      branchId: input.branchId,
      amount: input.amount,
      refId: input.auctionId,
      byUserId: input.userId,
    });
  }
}
```

## Security validation helper

Create `lib/chits/security.ts`:

```ts
export function assertCanReleasePrizePayout(input: {
  auctionStatus: string;
  payoutStatus: string;
  securityStatus?: string | null;
  winnerMemberId?: string | null;
  prizeAmount?: number | null;
}) {
  if (!input.winnerMemberId) throw new Error('Auction winner is missing');
  if (!input.prizeAmount || input.prizeAmount <= 0) throw new Error('Prize amount is missing');
  if (!['confirmed', 'payout_pending'].includes(input.auctionStatus)) {
    throw new Error('Auction must be confirmed before payout');
  }
  if (input.securityStatus !== 'approved') {
    throw new Error('Security must be approved before payout');
  }
  if (input.payoutStatus !== 'ready') {
    throw new Error('Payout is not ready');
  }
}
```

## Web UI

### Auction detail page

Add card:

```txt
Prize Payout Status
- Winner
- Prize amount
- Security status
- Payout status
- Submit/Verify/Approve security button
- Release payout button
```

### Security approval page

Create:

```txt
app/(dashboard)/[module]/chits/[id]/auctions/[auctionId]/security/page.tsx
```

Fields:

- Security type
- Security value
- Guarantor name
- Guarantor phone
- Details
- Document upload references
- Submit button
- Verify button
- Approve button
- Reject button with reason

Role rules:

- Agent: read-only or submit collection documents only if business allows.
- Admin: submit/verify.
- Superadmin/developer: approve/reject and release payout.

## API routes

### Submit/update security

```http
POST /api/v1/chits/:id/auctions/:auctionId/security
```

Payload:

```json
{
  "securityType": "guarantor",
  "securityValue": 80000,
  "guarantorName": "Ravi",
  "guarantorPhone": "9876543210",
  "details": "Signed surety form received",
  "status": "submitted"
}
```

### Verify/approve security

Same route can support action:

```json
{
  "action": "approve"
}
```

or create separate routes if preferred:

```txt
/security/verify
/security/approve
/security/reject
```

### Release payout

```http
POST /api/v1/chits/:id/auctions/:auctionId/payout
```

Payload:

```json
{
  "paymentMode": "cash",
  "referenceNo": "optional",
  "notes": "Prize payout released"
}
```

Response:

```json
{
  "auctionId": "...",
  "payoutStatus": "paid",
  "amount": 75000,
  "receiptNo": "CP-2026-0001"
}
```

## Receipt/voucher

Use `ChitReceipt` with:

```txt
receiptType = payout
entityType = auction
entityId = auctionId
amount = prizeAmount
paymentMode = cash/bank/upi/cheque
referenceNo = transaction reference
```

## Accounting idempotency

Payout must be idempotent.

Before posting:

```ts
await tx.accountEntry.findFirst({
  where: {
    tenantId,
    referenceId: auctionId,
    referenceType: 'chit_auction',
    type: 'chit_payout',
  },
});
```

If exists, block duplicate payout.

## Mobile changes

Mobile should show:

- Auction payout status
- Security status
- Winner and prize amount
- Payout released or pending

Admin mobile can optionally:

- Submit security details
- Upload/attach document reference if file upload exists
- Release payout only if superadmin/developer/admin business rule allows

## Acceptance criteria

- Auction confirmation no longer posts payout.
- Payout cannot be released without approved security.
- Duplicate payout is blocked.
- Payout creates account entry, wallet debit, and receipt/voucher.
- Payout status changes to `paid`.
- Web and mobile show payout/security status.
- Every security and payout action is audit logged.

## Implementation prompt for coding agent

```txt
Implement Step 6 for the LoanTrack chit-fund module.

Add ChitSecurity workflow and prize payout approval. Auction confirmation should set payoutStatus = security_pending and must not post cash payout. Add web security approval page and API routes to submit, verify, approve/reject security. Add payout release route that requires approved security and payoutStatus = ready, then creates account entry, branch wallet debit, ChitReceipt payout voucher, and audit log.

Ensure payout is idempotent and duplicate payout is blocked. Update Flutter models/screens to show security and payout status. Enforce tenant, branch, and role security.
```
