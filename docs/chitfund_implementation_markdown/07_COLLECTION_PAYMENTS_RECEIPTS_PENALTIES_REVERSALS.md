# Step 7 — Collections, Receipts, Penalties, and Reversals

## Goal

Upgrade chit subscription collection from simple paid amount update to a real cash collection workflow.

Current state:

- `ChitSubscription` has `dueAmount`, `paidAmount`, `status`, `paidAt`.
- Web and mobile can record payment.
- Accounting entry and branch wallet credit exist.
- Payment mode/reference/receipt are incomplete.
- Reversal is missing.
- Penalty workflow is missing.

Target state:

- Every collection has receipt number.
- Payment mode and transaction reference are stored.
- Partial payment is handled correctly.
- Penalties are separate and auditable.
- Reversal can cancel a wrong collection and post opposite accounting/wallet movement.

## Files to create

```txt
lib/chits/receipts.ts
lib/chits/collections.ts
app/api/v1/chits/receipts/[receiptId]/reverse/route.ts
```

## Files to update

```txt
app/(dashboard)/[module]/chits/actions.ts
app/(dashboard)/[module]/collection/ChitCollectionClient.tsx
app/api/v1/chits/[id]/payments/route.ts
app/api/v1/chits/subscriptions/[id]/miss/route.ts
mobile/lib/data/models/chit.dart
mobile/lib/data/services/chit_service.dart
mobile/lib/features/chits/chit_detail_screen.dart
lib/chits/calculations.ts
lib/wallet.ts
```

## Data model

Use models from Step 1:

- `ChitReceipt`
- `ChitPenalty`

Use `ChitSubscription` fields:

- `baseDueAmount`
- `dividendAmount`
- `penaltyAmount`
- `collectorId`
- `paymentMode`
- `lastReceiptNo`
- `lastPaymentRefNo`
- `notes`

## Payment semantics

All payment APIs must clearly support one of these modes:

```txt
ADD_PAYMENT     = add this amount to existing paid amount
SET_TOTAL_PAID  = set total paid amount to this value
```

For field collection, use `ADD_PAYMENT`.

Example:

```json
{
  "subscriptionId": "...",
  "amount": 3000,
  "mode": "ADD_PAYMENT",
  "paymentMode": "upi",
  "referenceNo": "UPI123",
  "notes": "Collected from customer"
}
```

## Receipt number generation

Create `lib/chits/receipts.ts`:

```ts
export async function generateChitReceiptNo(tx: any, input: {
  tenantId: string;
  branchCode?: string | null;
  receiptType: 'collection' | 'penalty' | 'payout' | 'reversal';
  date?: Date;
}) {
  const date = input.date ?? new Date();
  const yyyy = date.getFullYear();
  const prefixMap = {
    collection: 'CC',
    penalty: 'CPN',
    payout: 'CPO',
    reversal: 'CRV',
  } as const;
  const prefix = `${prefixMap[input.receiptType]}-${input.branchCode || 'BR'}-${yyyy}`;

  const count = await tx.chitReceipt.count({
    where: {
      tenantId: input.tenantId,
      receiptNo: { startsWith: prefix },
    },
  });

  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
}
```

Note: For high concurrency, replace count-based generation with a sequence table or database lock.

## Collection helper

Create `lib/chits/collections.ts`:

```ts
import { calculateChitPayment } from './calculations';
import { generateChitReceiptNo } from './receipts';

export async function collectChitSubscriptionPayment(tx: any, input: {
  tenantId: string;
  appType: string;
  branchId?: string | null;
  branchCode?: string | null;
  subscriptionId: string;
  currentPaidAmount: number;
  dueAmount: number;
  amount: number;
  mode: 'ADD_PAYMENT' | 'SET_TOTAL_PAID';
  paymentMode: string;
  referenceNo?: string | null;
  notes?: string | null;
  collectorId: string;
}) {
  const calc = calculateChitPayment({
    currentPaidAmount: input.currentPaidAmount,
    incomingAmount: input.amount,
    dueAmount: input.dueAmount,
    mode: input.mode,
  });

  if (calc.receivedDelta <= 0) {
    throw new Error('No new collection amount to post');
  }

  const receiptNo = await generateChitReceiptNo(tx, {
    tenantId: input.tenantId,
    branchCode: input.branchCode,
    receiptType: 'collection',
  });

  const subscription = await tx.chitSubscription.update({
    where: { id: input.subscriptionId },
    data: {
      paidAmount: calc.newPaidAmount,
      status: calc.status,
      paidAt: calc.status === 'paid' ? new Date() : undefined,
      collectorId: input.collectorId,
      paymentMode: input.paymentMode,
      lastReceiptNo: receiptNo,
      lastPaymentRefNo: input.referenceNo || undefined,
      notes: input.notes || undefined,
    },
  });

  await tx.chitReceipt.create({
    data: {
      tenantId: input.tenantId,
      branchId: input.branchId || undefined,
      appType: input.appType,
      receiptNo,
      receiptType: 'collection',
      entityType: 'subscription',
      entityId: input.subscriptionId,
      amount: calc.receivedDelta,
      paymentMode: input.paymentMode,
      referenceNo: input.referenceNo || undefined,
      notes: input.notes || undefined,
      issuedById: input.collectorId,
    },
  });

  await tx.accountEntry.create({
    data: {
      tenantId: input.tenantId,
      appType: input.appType,
      entryDate: new Date(),
      type: 'collection',
      category: input.paymentMode || 'cash',
      amount: calc.receivedDelta,
      description: `Chit contribution receipt ${receiptNo}`,
      referenceId: input.subscriptionId,
      referenceType: 'chit_subscription',
      createdBy: input.collectorId,
      branchId: input.branchId || undefined,
    },
  });

  if (input.branchId) {
    const { chitContributionToBranch } = await import('@/lib/wallet');
    await chitContributionToBranch(tx, {
      tenantId: input.tenantId,
      appType: input.appType,
      branchId: input.branchId,
      amount: calc.receivedDelta,
      refId: input.subscriptionId,
      byUserId: input.collectorId,
    });
  }

  return { subscription, receiptNo, receivedDelta: calc.receivedDelta, status: calc.status };
}
```

## Penalty workflow

### Create penalty

Penalty can be created when:

- Subscription is overdue.
- Subscription is marked missed.
- Admin manually applies penalty.

Fields:

- penalty type
- amount
- reason
- due subscription
- status

### Pay penalty

Penalty payment should:

1. Create `ChitReceipt` with `receiptType = penalty`.
2. Create account entry with `type = penalty_income` or existing suitable type.
3. Credit branch wallet if cash received.
4. Update `ChitPenalty.paidAmount` and status.

### Waive penalty

Only admin/superadmin should waive penalty.

Audit log required.

## Reversal workflow

Create route:

```txt
app/api/v1/chits/receipts/[receiptId]/reverse/route.ts
```

Reversal rules:

1. Only active receipt can be reversed.
2. Only admin/superadmin/developer can reverse.
3. Require reason.
4. Create reversal receipt.
5. Mark original receipt as reversed.
6. Reduce subscription paid amount by receipt amount if collection receipt.
7. Update subscription status.
8. Create negative/opposite account entry or reversal account entry.
9. Debit branch wallet if original was collection.
10. Audit log.

Payload:

```json
{
  "reason": "Wrong amount entered"
}
```

## Mark missed improvement

Current mobile route blocks partially paid subscriptions from being marked missed. Keep this rule.

Enhance missed flow:

- `status = missed`
- optionally create penalty
- optionally create notice task/notification
- audit log

## UI changes

### Collection screen

File:

```txt
app/(dashboard)/[module]/collection/ChitCollectionClient.tsx
```

Add fields:

- Amount collected
- Payment mode: cash, upi, bank, cheque
- Reference number
- Notes
- Receipt preview/print/download

### Chit detail subscription table

Add columns:

- Base due
- Dividend
- Penalty
- Payable
- Paid
- Balance
- Last receipt no
- Payment mode
- Status
- Actions: collect, mark missed, reverse latest receipt

## Mobile changes

Mobile collection should support:

- amount
- payment mode
- reference number
- notes
- receipt number after save
- offline mode later if needed

Update:

```txt
mobile/lib/data/models/chit.dart
mobile/lib/data/services/chit_service.dart
mobile/lib/features/chits/chit_detail_screen.dart
```

## Acceptance criteria

- Every collection creates a receipt number.
- Payment mode and reference number are saved.
- Partial payments calculate correctly.
- Receipts are immutable except status reversal.
- Reversal updates subscription, accounting, wallet, and audit log.
- Penalty can be created, paid, waived, and reported.
- Web and mobile use same collection helper.

## Implementation prompt for coding agent

```txt
Implement Step 7 for the LoanTrack chit-fund module.

Create shared collection and receipt helpers under lib/chits. Update web and mobile payment flows to use ADD_PAYMENT or SET_TOTAL_PAID explicitly. Every collection must create a ChitReceipt, account entry, and branch wallet credit. Add payment mode, reference number, notes, collector, and last receipt fields.

Add penalty workflow using ChitPenalty. Add receipt reversal route that marks original receipt reversed, creates reversal receipt, adjusts subscription paid amount/status, posts accounting reversal, updates branch wallet, and audit logs the action. Update web collection UI and Flutter collection model/screens.
```
