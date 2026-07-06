import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { getAgentRouteIds } from '@/lib/access';
import { canAgentAccessCustomer } from '@/lib/loanPolicy';
import { buildCollectionIdempotencyKey, getCollectionSubmissionBlockReason, getLoanCollectionBlockReason } from '@/lib/collectionPolicy';
import { getSetting } from '@/lib/tenant';
import { recordPaymentLedger } from '@/lib/paymentService';
import { reallocateLoanRepayments } from '@/lib/repayments';
import { creditCollection } from '@/lib/wallet';

type Tx = Prisma.TransactionClient;

function startOfDay(value?: string | Date | null): Date {
  const d = value ? new Date(value) : new Date();
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  } else {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  }
}

type CollectibleInstalment = {
  id: string;
  instalmentNo: number;
  dueDate: Date | string;
  dueAmount: Prisma.Decimal | number | string;
  receivedAmount: Prisma.Decimal | number | string | null;
  status: string;
};

function sameBusinessDay(a: Date | string, b: Date): boolean {
  return startOfDay(a).getTime() === b.getTime();
}

function remainingCollectibleFromInstalments(instalments: CollectibleInstalment[]): number {
  const totalDue = instalments.reduce((sum, inst) => sum + Number(inst.dueAmount), 0);
  const totalReceived = instalments.reduce((sum, inst) => sum + Number(inst.receivedAmount ?? 0), 0);
  return Math.max(0, totalDue - totalReceived);
}

async function getLoanRemainingCollectible(tx: Tx, loanId: string): Promise<number> {
  const instalments = await tx.instalment.findMany({
    where: { loanId, status: { not: 'waived' } },
    select: { id: true, instalmentNo: true, dueDate: true, dueAmount: true, receivedAmount: true, status: true },
  });
  return remainingCollectibleFromInstalments(instalments);
}

function pickActualCollectionInstalment(
  instalments: CollectibleInstalment[],
  collectionDate: Date,
): CollectibleInstalment | null {
  const byDate = [...instalments].sort((a, b) => {
    const dueDelta = startOfDay(a.dueDate).getTime() - startOfDay(b.dueDate).getTime();
    if (dueDelta !== 0) return dueDelta;
    return a.instalmentNo - b.instalmentNo;
  });
  const dueOnCollectionDate = byDate.find((inst) => sameBusinessDay(inst.dueDate, collectionDate));
  if (dueOnCollectionDate) return dueOnCollectionDate;

  const open = byDate.filter((inst) => Number(inst.dueAmount) > Number(inst.receivedAmount ?? 0));
  return open.find((inst) => startOfDay(inst.dueDate).getTime() < collectionDate.getTime())
    ?? open[0]
    ?? byDate[0]
    ?? null;
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
  collectionDate?: string | Date | null;
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
  /**
   * Loan-level fast path: the caller runs the expensive loan reallocation,
   * daily-rollup recompute and float credit once after the actual-date write.
   * Single-instalment callers leave these unset.
   */
  skipReallocate?: boolean;
  skipRollup?: boolean;
  /**
   * Prefetched decision for whether cash collection must wait for customer
   * confirmation (agent-only). When provided, skips the per-call user lookup.
   */
  forceConfirmation?: boolean;
  /**
   * Prefetched tenant setting `upi_manual_verification` ('true' = admin must
   * verify UPI by hand). When undefined, looked up per call. Manual mode is
   * OFF by default — UPI/online entries auto-verify and credit the account
   * immediately, exactly like the admin "Credited to Account" button.
   */
  upiManualVerification?: boolean;
  /**
   * Actual-view collection: keep the entered amount on this instalment row even
   * when it exceeds the row's scheduled due. Used by loan-level/today-date
   * payments; callers must cap the amount at loan level before passing it in.
   */
  allowOverpayment?: boolean;
  maxAppliedAmount?: number;
};

/**
 * Records a collection against ONE instalment (actual mode — no redistribution).
 * By default it is capped at the instalment's remaining due; actual-date
 * collection callers can opt into overpayment on the selected row after capping
 * at loan level. Ensures the agent's DailyCollection,
 * writes the CollectionEntry + Payment ledger, updates the instalment, and
 * reallocates loan status. Returns the created entry id and the applied amount.
 * Shared by the cash, approved-photo, and QR collection paths.
 */
export async function recordCollection(
  tx: Tx,
  input: RecordCollectionInput,
): Promise<{ entryId: string; applied: number; created: boolean }> {
  const { tenantId, appType, agentId, instalment, amount, paymentMode, idempotencyKey } = input;
  const today = startOfDay(input.collectionDate);

  // Idempotency: if this exact entry already exists, return it.
  const existing = await tx.collectionEntry.findFirst({
    where: { idempotencyKey, tenantId },
    select: { id: true, receivedAmount: true },
  });
  if (existing) return { entryId: existing.id, applied: Number(existing.receivedAmount), created: false };

  const daily = await tx.dailyCollection.upsert({
    where: {
      tenantId_appType_agentId_date: {
        tenantId,
        appType,
        agentId,
        date: today,
      },
    },
    update: {},
    create: {
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

  const room = Math.max(
    0,
    Number(instalment.dueAmount) - Number(instalment.receivedAmount ?? 0),
  );
  const maxAppliedAmount = input.maxAppliedAmount == null
    ? amount
    : Math.max(0, Number(input.maxAppliedAmount));
  if (input.allowOverpayment) {
    if (maxAppliedAmount <= 0) throw new Error('already_paid: loan fully collected');
  } else if (room <= 0) {
    throw new Error('already_paid: instalment fully collected');
  }
  const applied = input.allowOverpayment
    ? Math.min(amount, maxAppliedAmount)
    : Math.min(amount, room);

  const gps = input.gps ?? null;

  // feeConfirmationMandatory is an AGENT-only toggle. Only force customer
  // confirmation when the collector is actually an agent — admins/managers
  // collecting keep their original privilege (no mandatory confirmation).
  // Loan-level callers prefetch this once and pass `forceConfirmation`.
  let forceConfirmation = input.forceConfirmation;
  if (forceConfirmation === undefined) {
    const agent = await tx.user.findUnique({
      where: { id: agentId },
      select: { role: true, feeConfirmationMandatory: true },
    });
    forceConfirmation = agent?.role === 'agent' && !!agent?.feeConfirmationMandatory;
  }

  let verificationStatus = input.verificationStatus ?? 'pending';
  if (paymentMode === 'cash' && forceConfirmation && verificationStatus === 'pending') {
    verificationStatus = 'pending_confirmation';
  }

  // UPI/online auto-verify: unless the tenant opted into manual verification,
  // a digital payment is verified at collection time and credited to the
  // account ledger right away (same as the dashboard verify button). Only
  // applies when the caller didn't already decide the status (QR proof etc.
  // pass 'verified' explicitly and handle their own posting).
  let autoVerifiedUpi = false;
  if ((paymentMode === 'upi' || paymentMode === 'online') && verificationStatus === 'pending') {
    let manual = input.upiManualVerification;
    if (manual === undefined) {
      manual = (await getSetting(tenantId, 'upi_manual_verification', 'false')) === 'true';
    }
    if (!manual) {
      verificationStatus = 'verified';
      autoVerifiedUpi = true;
    }
  }

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
      verificationStatus,
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

  // Credit the account for auto-verified digital payments — byte-for-byte what
  // the manual "Credited to Account" verification writes.
  if (autoVerifiedUpi) {
    await tx.accountEntry.create({
      data: {
        tenantId,
        appType,
        entryDate: new Date(),
        type: 'collection',
        category: 'upi',
        amount: applied,
        description: `Auto-verified UPI collection (entry ${entry.id})`,
        referenceId: entry.id,
        referenceType: 'payment',
        createdBy: agentId,
        branchId: instalment.loan.branchId,
      },
    });
  }

  await tx.instalment.update({
    where: { id: instalment.id },
    data: { receivedAmount: { increment: applied }, receivedAt: new Date() },
  });

  // Loan reallocation + daily rollup are O(n) each. Loan-level callers can
  // defer both and run them once after the actual-date write.
  if (!input.skipReallocate) {
    await reallocateLoanRepayments(tx, instalment.loanId);
  }

  if (!input.skipRollup) {
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
  }

  // Cash-in-hand: a collecting agent now holds this cash -> credit their float.
  // Best-effort so a missing wallet table never breaks collection (mirrors the
  // v1 collection route). Self-pay callers pass creditFloat=false.
  if (input.creditFloat) {
    try {
      await creditCollection(tx, { tenantId, appType, agentId, amount: applied, entryId: entry.id });
    } catch (err) {
      console.error('[wallet] collection credit failed:', err);
    }
  }

  return { entryId: entry.id, applied, created: true };
}

export type CollectionActor = {
  tenantId: string;
  appType: string;
  userId: string;
  branchId: string | null;
  role: string;
};

export type SubmitCollectionEntryInput = {
  instalmentId: string;
  receivedAmount: number;
  paymentMode?: string;
  remarks?: string | null;
  collectionDate?: string | Date | null;
  idempotencyKey?: string;
  gps?: CollectionGpsCapture | null;
};

export type SubmitCollectionEntryOptions = {
  enforceBranchScope?: boolean;
  writeAudit?: boolean;
  appendDirectPaymentRemark?: boolean;
};

export async function submitCollectionEntry(
  actor: CollectionActor,
  input: SubmitCollectionEntryInput,
  options: SubmitCollectionEntryOptions = {},
) {
  const instalmentId = String(input.instalmentId || '');
  const receivedAmount = Number(input.receivedAmount);
  const paymentMode = String(input.paymentMode || 'cash');
  if (!instalmentId || !Number.isFinite(receivedAmount) || receivedAmount <= 0) {
    throw new Error('invalid_amount');
  }

  const instalment = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    include: { loan: { include: { customer: true } } },
  });
  if (
    !instalment ||
    instalment.loan.tenantId !== actor.tenantId ||
    instalment.loan.appType !== actor.appType
  ) {
    throw new Error('not_found');
  }

  const block = getCollectionSubmissionBlockReason({
    loanStatus: instalment.loan.status,
    dueAmount: Number(instalment.dueAmount),
    receivedAmount: Number(instalment.receivedAmount || 0),
  });
  if (block) throw new Error(`already_paid: ${block}`);

  if (options.enforceBranchScope && actor.branchId && instalment.loan.branchId !== actor.branchId) {
    throw new Error('forbidden');
  }
  if (actor.role === 'agent') {
    // Match the read-side scope (buildAgentCustomerAccessWhere): an agent may
    // collect for a customer assigned directly to them OR on one of their
    // routes. Route-only here wrongly rejected directly-assigned customers.
    const routeIds = await getAgentRouteIds(actor.userId);
    if (!canAgentAccessCustomer(instalment.loan.customer, routeIds, actor.userId)) {
      throw new Error('forbidden');
    }
  }

  const collectionDate = startOfDay(input.collectionDate);
  const idempotencyKey =
    input.idempotencyKey ??
    buildCollectionIdempotencyKey({
      tenantId: actor.tenantId,
      agentId: actor.userId,
      instalmentId,
      receivedAmount,
      paymentMode,
      collectionDate,
    });

  const allocationRemark = `Direct payment for instalment #${instalment.instalmentNo} (+₹${receivedAmount})`;
  const remarks = options.appendDirectPaymentRemark
    ? [input.remarks ?? null, allocationRemark].filter(Boolean).join(' | ')
    : input.remarks ?? null;

  const result = await prisma.$transaction(async (tx) => {
    const remaining = await getLoanRemainingCollectible(tx, instalment.loanId);
    const amountToRecord = Math.min(receivedAmount, remaining);
    const rec = await recordCollection(tx, {
      tenantId: actor.tenantId,
      appType: actor.appType,
      agentId: actor.userId,
      instalment,
      amount: amountToRecord,
      paymentMode,
      idempotencyKey,
      collectionDate,
      remarks,
      creditFloat: true,
      gps: input.gps ?? null,
      allowOverpayment: true,
      maxAppliedAmount: amountToRecord,
    });

    const entry = await tx.collectionEntry.findUnique({ where: { id: rec.entryId } });
    if (!entry) throw new Error('collection_entry_not_found');

    if (options.writeAudit && rec.created) {
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: 'create',
          entityType: 'collection',
          entityId: entry.id,
          newValue: JSON.stringify({ instalmentId, receivedAmount, paymentMode, allocation: allocationRemark }),
        },
      });
    }

    return { entry, applied: rec.applied, created: rec.created };
  });

  return { ...result, instalment };
}

export type ActualLoanCollectionInput = {
  loanId: string;
  amount: number;
  paymentMode?: string;
  remarks?: string | null;
  collectionDate?: string | Date | null;
  /** Base idempotency key; the date-row instalment id is appended for stability. */
  idempotencyKey?: string;
  gps?: CollectionGpsCapture | null;
};

export type ActualLoanCollectionResult = {
  posted: { instalmentId: string; instalmentNo: number; applied: number }[];
  applied: number;
  leftover: number;
};

/**
 * Collects ONE payment and records it on the collection-date instalment for the
 * Actual schedule. It does not split the money across overdue rows; the
 * Distributed schedule remains a display-only projection of total received.
 *
 * Example: customer owes ₹500 overdue + ₹100 today and pays ₹300 today →
 * today's row receives ₹300 in Actual; Distributed can show how that ₹300 would
 * cover older dues.
 *
 * Runs in ONE transaction. Reuses `recordCollection`, so ledger, daily rollup,
 * wallet float, and loan reallocation behave exactly as a normal collection.
 * Idempotent: replaying the same payment reuses the same collection key.
 */
export async function recordActualLoanCollection(
  actor: CollectionActor,
  input: ActualLoanCollectionInput,
  options: { enforceBranchScope?: boolean } = {},
): Promise<ActualLoanCollectionResult> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid_amount');
  const paymentMode = String(input.paymentMode || 'cash');

  const loan = await prisma.loan.findUnique({
    where: { id: input.loanId },
    include: { customer: true },
  });
  if (!loan || loan.tenantId !== actor.tenantId || loan.appType !== actor.appType) {
    throw new Error('not_found');
  }

  const loanBlock = getLoanCollectionBlockReason(loan.status);
  if (loanBlock) throw new Error(`already_paid: ${loanBlock}`);

  if (options.enforceBranchScope && actor.branchId && loan.branchId !== actor.branchId) {
    throw new Error('forbidden');
  }
  if (actor.role === 'agent') {
    const routeIds = await getAgentRouteIds(actor.userId);
    if (!canAgentAccessCustomer(loan.customer, routeIds, actor.userId)) {
      throw new Error('forbidden');
    }
  }

  const collectionDate = startOfDay(input.collectionDate);

  // Prefetch the agent-only confirmation decision ONCE (avoids a user lookup per
  // instalment inside the transaction).
  const collector = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { role: true, feeConfirmationMandatory: true },
  });
  const forceConfirmation = collector?.role === 'agent' && !!collector?.feeConfirmationMandatory;

  // Prefetch the UPI manual-verification setting once for the whole batch.
  const upiManualVerification =
    (await getSetting(actor.tenantId, 'upi_manual_verification', 'false')) === 'true';

  return prisma.$transaction(
    async (tx) => {
      const instalments = await tx.instalment.findMany({
        where: { loanId: input.loanId },
        include: { loan: { include: { customer: { select: { routeId: true } } } } },
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      });

      const payable = instalments.filter((inst) => inst.status !== 'waived');
      const loanRemaining = remainingCollectibleFromInstalments(payable);
      const amountToRecord = Math.min(amount, loanRemaining);
      if (amountToRecord <= 0) throw new Error('already_paid: loan fully collected');
      const targetInstalment = pickActualCollectionInstalment(payable, collectionDate);
      if (!targetInstalment) throw new Error('already_paid: nothing to collect');

      const posted: ActualLoanCollectionResult['posted'] = [];
      let dailyId: string | null = null;
      let firstEntryId: string | null = null;
      let cashApplied = 0;
      const idempotencyKey = input.idempotencyKey
        ? `${input.idempotencyKey}:${targetInstalment.id}`
        : buildCollectionIdempotencyKey({
            tenantId: actor.tenantId,
            agentId: actor.userId,
            instalmentId: targetInstalment.id,
            receivedAmount: amountToRecord,
            paymentMode,
            collectionDate,
          });

      const rec = await recordCollection(tx, {
        tenantId: actor.tenantId,
        appType: actor.appType,
        agentId: actor.userId,
        instalment: targetInstalment as never,
        amount: amountToRecord,
        paymentMode,
        idempotencyKey,
        collectionDate,
        remarks: input.remarks ?? null,
        creditFloat: false,
        forceConfirmation,
        upiManualVerification,
        skipReallocate: true,
        skipRollup: true,
        gps: input.gps ?? null,
        allowOverpayment: true,
        maxAppliedAmount: amountToRecord,
      });
      posted.push({
        instalmentId: targetInstalment.id,
        instalmentNo: targetInstalment.instalmentNo,
        applied: rec.applied,
      });
      if (rec.created) {
        firstEntryId = rec.entryId;
        cashApplied = rec.applied;
      }

      // Run the deferred work exactly once.
      await reallocateLoanRepayments(tx, input.loanId);

      const daily = await tx.dailyCollection.findUnique({
        where: {
          tenantId_appType_agentId_date: {
            tenantId: actor.tenantId,
            appType: actor.appType,
            agentId: actor.userId,
            date: collectionDate,
          },
        },
        select: { id: true },
      });
      dailyId = daily?.id ?? null;
      if (dailyId) {
        const all = await tx.collectionEntry.findMany({
          where: { collectionId: dailyId },
          select: { receivedAmount: true, dueAmount: true },
        });
        await tx.dailyCollection.update({
          where: { id: dailyId },
          data: {
            totalCollected: all.reduce((s, e) => s + Number(e.receivedAmount), 0),
            totalExpected: all.reduce((s, e) => s + Number(e.dueAmount), 0),
            entriesCount: all.length,
          },
        });
      }

      // Credit the collecting agent's float once with the whole cash amount.
      if (cashApplied > 0 && firstEntryId) {
        try {
          await creditCollection(tx, {
            tenantId: actor.tenantId,
            appType: actor.appType,
            agentId: actor.userId,
            amount: cashApplied,
            entryId: firstEntryId,
          });
        } catch (err) {
          console.error('[wallet] actual collection credit failed:', err);
        }
      }

      return { posted, applied: rec.applied, leftover: Math.max(0, amount - rec.applied) };
    },
    { timeout: 30000, maxWait: 15000 },
  );
}
