import { Prisma } from '@prisma/client';
import { recordPaymentLedger } from '@/lib/paymentService';
import { reallocateLoanRepayments } from '@/lib/repayments';
import { creditCollection } from '@/lib/wallet';

type Tx = Prisma.TransactionClient;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Optional GPS capture stamped onto the collection entry (mCollect route runs). */
export type CollectionGpsCapture = {
  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracy?: number | null;
  gpsTimestamp?: Date | null;
  gpsAltitude?: number | null;
  locationStatus?: string | null;
};

export type RecordCollectionInput = {
  tenantId: string;
  appType: string;
  agentId: string;
  instalment: {
    id: string;
    loanId: string;
    instalmentNo: number;
    dueAmount: Prisma.Decimal | number | string;
    receivedAmount: Prisma.Decimal | number | string | null;
    loan: { customerId: string; branchId: string | null; customer: { routeId: string | null } };
  };
  amount: number;
  paymentMode: string;
  idempotencyKey: string;
  /** 'verified' for QR/approved-photo, 'pending' for unverified cash. */
  verificationStatus?: string;
  remarks?: string | null;
  /**
   * Stream tag: 'field' (default, legacy) | 'route_run' | 'self_pay_upi'.
   * Lets reports separate agent-cash from digital collection. Defaults preserve
   * existing behaviour for every current caller.
   */
  source?: string;
  /** Batch run this entry belongs to (mCollect-A). */
  runId?: string | null;
  /**
   * Credit the collecting agent's cash float (cash now in hand). Default false
   * to keep the existing QR/proof caller's behaviour byte-for-byte. Route runs
   * pass true for cash lines; self-pay never credits agent float.
   */
  creditFloat?: boolean;
  /** Optional GPS capture for field collection. */
  gps?: CollectionGpsCapture | null;
};

/**
 * Records a collection against ONE instalment (actual mode — no redistribution),
 * capped at the instalment's remaining due. Ensures the agent's DailyCollection,
 * writes the CollectionEntry + Payment ledger, updates the instalment, and
 * reallocates loan status. Returns the created entry id and the applied amount.
 * Shared by the cash, approved-photo, and QR collection paths.
 */
export async function recordCollection(
  tx: Tx,
  input: RecordCollectionInput,
): Promise<{ entryId: string; applied: number }> {
  const { tenantId, appType, agentId, instalment, amount, paymentMode, idempotencyKey } = input;
  const today = startOfToday();

  // Idempotency: if this exact entry already exists, return it.
  const existing = await tx.collectionEntry.findFirst({
    where: { idempotencyKey, tenantId },
    select: { id: true, receivedAmount: true },
  });
  if (existing) return { entryId: existing.id, applied: Number(existing.receivedAmount) };

  let daily = await tx.dailyCollection.findFirst({
    where: { tenantId, appType, agentId, date: today },
    select: { id: true },
  });
  if (!daily) {
    daily = await tx.dailyCollection.create({
      data: {
        tenantId,
        appType,
        agentId,
        branchId: instalment.loan.branchId,
        routeId: instalment.loan.customer.routeId,
        date: today,
        totalExpected: 0,
        totalCollected: 0,
        entriesCount: 0,
        status: 'open',
      },
      select: { id: true },
    });
  }

  const room = Math.max(
    0,
    Number(instalment.dueAmount) - Number(instalment.receivedAmount ?? 0),
  );
  const applied = Math.min(amount, room);
  if (applied <= 0) throw new Error('already_paid: instalment fully collected');

  const gps = input.gps ?? null;
  const entry = await tx.collectionEntry.create({
    data: {
      tenantId,
      idempotencyKey,
      collectionId: daily.id,
      customerId: instalment.loan.customerId,
      loanId: instalment.loanId,
      dueAmount: Number(instalment.dueAmount),
      receivedAmount: applied,
      paymentMode,
      remarks: input.remarks ?? null,
      agentId,
      verificationStatus: input.verificationStatus ?? 'pending',
      source: input.source ?? 'field',
      runId: input.runId ?? null,
      lat: gps?.latitude ?? null,
      lng: gps?.longitude ?? null,
      gpsAccuracyM: gps?.gpsAccuracy ?? null,
      gpsCapturedAt: gps?.gpsTimestamp ?? null,
      gpsAltitude: gps?.gpsAltitude ?? null,
      locationStatus: gps?.locationStatus ?? 'not_captured',
    },
    select: { id: true },
  });

  await recordPaymentLedger(tx, {
    tenantId,
    loanId: instalment.loanId,
    instalmentId: instalment.id,
    amount: applied,
    paymentMode,
  });

  await tx.instalment.update({
    where: { id: instalment.id },
    data: { receivedAmount: { increment: applied }, receivedAt: new Date() },
  });

  await reallocateLoanRepayments(tx, instalment.loanId);

  const all = await tx.collectionEntry.findMany({
    where: { collectionId: daily.id },
    select: { receivedAmount: true, dueAmount: true },
  });
  await tx.dailyCollection.update({
    where: { id: daily.id },
    data: {
      totalCollected: all.reduce((s, e) => s + Number(e.receivedAmount), 0),
      totalExpected: all.reduce((s, e) => s + Number(e.dueAmount), 0),
      entriesCount: all.length,
    },
  });

  // Cash-in-hand: a collecting agent now holds this cash -> credit their float.
  // Best-effort so a missing wallet table never breaks collection (mirrors the
  // v1 collection route). Self-pay callers pass creditFloat=false.
  if (input.creditFloat) {
    try {
      await creditCollection(tx, { tenantId, agentId, amount: applied, entryId: entry.id });
    } catch (err) {
      console.error('[wallet] collection credit failed:', err);
    }
  }

  return { entryId: entry.id, applied };
}
