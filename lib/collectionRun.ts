import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { recordCollection, type CollectionGpsCapture } from '@/lib/collectionWrite';
import { depositToOffice } from '@/lib/wallet';
import { getCollectionSubmissionBlockReason, COLLECTIBLE_LOAN_STATUSES } from '@/lib/collectionPolicy';

/**
 * mCollect-A — route batch collection run engine.
 *
 * One agent opens a RUN over a route, collects from every due customer on a
 * single sheet, then reconciles + deposits the day's cash. Every money write
 * goes through the shared `recordCollection` helper, so the instalment / ledger
 * / daily-rollup / wallet behaviour is identical to single-entry collection —
 * a run is purely an organisational wrapper.
 */

export type RunActor = {
  tenantId: string;
  appType: string;
  agentId: string;
  branchId: string | null;
  role: string;
  userId: string;
};

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

/** Digital line (UPI) lands in the bank, not the agent's cash float. */
function isDigital(paymentMode: string): boolean {
  return paymentMode === 'upi' || paymentMode === 'qr' || paymentMode === 'netbanking' || paymentMode === 'card';
}

export type RunSheetRow = {
  stopSeq: number;
  customerId: string;
  customerCode: string | null;
  name: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  loanId: string;
  loanCode: string;
  instalmentId: string;
  instalmentNo: number;
  dueDate: Date;
  dueAmount: number;
  receivedAmount: number;
  outstanding: number;
  overdue: boolean;
  daysOverdue: number;
};

/**
 * Builds the ordered collection sheet for a route: one row per due/overdue
 * instalment, ordered by the route's walking sequence then due date.
 */
export async function buildRouteSheet(
  actor: Pick<RunActor, 'tenantId' | 'appType'>,
  routeId: string,
  asOf?: Date,
): Promise<RunSheetRow[]> {
  const today = startOfDay(asOf);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [stops, instalments] = await Promise.all([
    prisma.routeStop.findMany({
      where: { tenantId: actor.tenantId, routeId },
      select: { customerId: true, sequence: true },
    }),
    prisma.instalment.findMany({
      where: {
        dueDate: { lt: tomorrow },
        status: { in: ['upcoming', 'missed', 'partial'] },
        loan: {
          tenantId: actor.tenantId,
          appType: actor.appType,
          status: { in: [...COLLECTIBLE_LOAN_STATUSES] },
          customer: { routeId },
        },
      },
      include: {
        loan: {
          select: {
            id: true,
            loanCode: true,
            customer: {
              select: { id: true, customerCode: true, name: true, phone: true },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
    }),
  ]);

  const seqByCustomer = new Map(stops.map((s) => [s.customerId, s.sequence]));
  const geo = await prisma.customerGeocode.findMany({
    where: { tenantId: actor.tenantId, customerId: { in: instalments.map((i) => i.loan.customer.id) } },
    select: { customerId: true, latitude: true, longitude: true },
  });
  const geoByCustomer = new Map(geo.map((g) => [g.customerId, g]));

  const rows: RunSheetRow[] = instalments
    .map((i) => {
      const dueAmount = Number(i.dueAmount);
      const receivedAmount = Number(i.receivedAmount || 0);
      const outstanding = Math.max(0, dueAmount - receivedAmount);
      const due = startOfDay(i.dueDate);
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
      const g = geoByCustomer.get(i.loan.customer.id);
      return {
        stopSeq: seqByCustomer.get(i.loan.customer.id) ?? 9999,
        customerId: i.loan.customer.id,
        customerCode: i.loan.customer.customerCode,
        name: i.loan.customer.name,
        phone: i.loan.customer.phone,
        lat: g ? g.latitude : null,
        lng: g ? g.longitude : null,
        loanId: i.loan.id,
        loanCode: i.loan.loanCode,
        instalmentId: i.id,
        instalmentNo: i.instalmentNo,
        dueDate: i.dueDate,
        dueAmount,
        receivedAmount,
        outstanding,
        overdue: due < today,
        daysOverdue,
      };
    })
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => a.stopSeq - b.stopSeq || a.dueDate.getTime() - b.dueDate.getTime());

  return rows;
}

/**
 * Opens (or returns the existing) run for an agent+route+day, snapshotting the
 * expected total. Idempotent on the unique (tenant, appType, agent, route, day).
 */
export async function openRun(
  actor: RunActor,
  input: { routeId: string; date?: string | Date | null; lat?: number | null; lng?: number | null },
) {
  const date = startOfDay(input.date);
  const sheet = await buildRouteSheet(actor, input.routeId, date);
  const expectedTotal = sheet.reduce((s, r) => s + r.outstanding, 0);
  const stopsExpected = new Set(sheet.map((r) => r.customerId)).size;

  const existing = await prisma.collectionRun.findFirst({
    where: {
      tenantId: actor.tenantId,
      appType: actor.appType,
      agentId: actor.agentId,
      routeId: input.routeId,
      date,
    },
  });
  if (existing) {
    // Refresh the expected snapshot while the run is still open (dues may shift).
    if (existing.status === 'open') {
      return prisma.collectionRun.update({
        where: { id: existing.id },
        data: { expectedTotal, stopsExpected },
      });
    }
    return existing;
  }

  return prisma.collectionRun.create({
    data: {
      tenantId: actor.tenantId,
      branchId: actor.branchId,
      appType: actor.appType,
      agentId: actor.agentId,
      routeId: input.routeId,
      date,
      status: 'open',
      expectedTotal,
      stopsExpected,
      openedAt: new Date(),
      openLat: input.lat ?? null,
      openLng: input.lng ?? null,
      createdById: actor.userId,
    },
  });
}

async function refreshRunTotals(tx: Prisma.TransactionClient, runId: string) {
  const entries = await tx.collectionEntry.findMany({
    where: { runId },
    select: { receivedAmount: true, paymentMode: true, customerId: true },
  });
  let cash = 0;
  let digital = 0;
  const customers = new Set<string>();
  for (const e of entries) {
    const amt = Number(e.receivedAmount);
    if (isDigital(e.paymentMode)) digital += amt;
    else cash += amt;
    customers.add(e.customerId);
  }
  await tx.collectionRun.update({
    where: { id: runId },
    data: {
      collectedTotal: cash + digital,
      cashCollected: cash,
      digitalCollected: digital,
      stopsCollected: customers.size,
      status: 'collecting',
    },
  });
}

export type RunCollectLine = {
  instalmentId: string;
  receivedAmount: number;
  paymentMode?: string;
  lat?: number | null;
  lng?: number | null;
  remarks?: string | null;
};

export type RunCollectResult = {
  posted: { instalmentId: string; entryId: string; applied: number }[];
  skipped: { instalmentId: string; reason: string }[];
};

/**
 * Posts a batch of collection lines against an open run, in ONE transaction.
 * Each line reuses `recordCollection` (capping, ledger, daily rollup, idempotent,
 * float credit for cash). Invalid lines are skipped & reported, never abort the
 * whole batch — a field agent must not lose 9 good collections to 1 bad row.
 */
export async function collectRunLines(
  actor: RunActor,
  runId: string,
  lines: RunCollectLine[],
): Promise<RunCollectResult> {
  const run = await prisma.collectionRun.findFirst({
    where: { id: runId, tenantId: actor.tenantId },
  });
  if (!run) throw new Error('run_not_found');
  if (run.status === 'closed' || run.status === 'reconciled') throw new Error('run_closed');
  if (actor.role === 'agent' && run.agentId !== actor.agentId) throw new Error('forbidden');

  const posted: RunCollectResult['posted'] = [];
  const skipped: RunCollectResult['skipped'] = [];
  // Digital (verified) lines need a GL entry now — cash lines wait for handover.
  const digitalPosts: { entryId: string; loanId: string; loanCode: string; amount: number; branchId: string | null }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const amount = Number(line.receivedAmount);
      if (!line.instalmentId || !Number.isFinite(amount) || amount <= 0) {
        skipped.push({ instalmentId: line.instalmentId, reason: 'invalid_amount' });
        continue;
      }
      const instalment = await tx.instalment.findUnique({
        where: { id: line.instalmentId },
        include: { loan: { include: { customer: { select: { routeId: true } } } } },
      });
      if (
        !instalment ||
        instalment.loan.tenantId !== actor.tenantId ||
        instalment.loan.appType !== actor.appType
      ) {
        skipped.push({ instalmentId: line.instalmentId, reason: 'not_found' });
        continue;
      }
      // Line must belong to this run's route (defensive — sheet is route-scoped).
      if (run.routeId && instalment.loan.customer.routeId !== run.routeId) {
        skipped.push({ instalmentId: line.instalmentId, reason: 'wrong_route' });
        continue;
      }
      const block = getCollectionSubmissionBlockReason({
        loanStatus: instalment.loan.status,
        dueAmount: Number(instalment.dueAmount),
        receivedAmount: Number(instalment.receivedAmount || 0),
      });
      if (block) {
        skipped.push({ instalmentId: line.instalmentId, reason: block });
        continue;
      }

      const paymentMode = String(line.paymentMode || 'cash');
      const gps: CollectionGpsCapture | null =
        line.lat != null && line.lng != null
          ? { latitude: line.lat, longitude: line.lng, gpsTimestamp: new Date(), locationStatus: 'captured' }
          : null;

      const rec = await recordCollection(tx, {
        tenantId: actor.tenantId,
        appType: actor.appType,
        agentId: actor.agentId,
        instalment: instalment as never,
        amount,
        paymentMode,
        idempotencyKey: `run:${runId}:${line.instalmentId}:${amount}:${paymentMode}`,
        verificationStatus: isDigital(paymentMode) ? 'verified' : 'pending',
        remarks: line.remarks ?? `Route run collection (#${instalment.instalmentNo})`,
        source: 'route_run',
        runId,
        creditFloat: !isDigital(paymentMode),
        gps,
      });
      posted.push({ instalmentId: line.instalmentId, entryId: rec.entryId, applied: rec.applied });
      if (isDigital(paymentMode)) {
        digitalPosts.push({
          entryId: rec.entryId,
          loanId: instalment.loanId,
          loanCode: instalment.loan.loanCode,
          amount: rec.applied,
          branchId: instalment.loan.branchId,
        });
      }
    }

    await refreshRunTotals(tx, runId);
  });

  // GL for digital (verified) lines — Dr Bank / Cr Loan Receivable. Cash lines
  // are posted at handover (existing flow). Fire-and-forget, idempotent.
  if (digitalPosts.length) {
    void import('@/lib/accounting/autoPost').then(({ autoPostCollection }) =>
      Promise.all(
        digitalPosts.map((d) =>
          autoPostCollection({
            tenantId: actor.tenantId,
            entryId: d.entryId,
            loanId: d.loanId,
            loanCode: d.loanCode,
            amount: d.amount,
            date: new Date(),
            branchId: d.branchId,
            createdById: actor.userId,
            paymentMode: 'upi',
          }),
        ),
      ),
    ).catch((e) => console.error('[run] digital collection JE failed:', e));
  }

  return { posted, skipped };
}

export async function closeRun(actor: RunActor, runId: string) {
  const run = await prisma.collectionRun.findFirst({ where: { id: runId, tenantId: actor.tenantId } });
  if (!run) throw new Error('run_not_found');
  if (actor.role === 'agent' && run.agentId !== actor.agentId) throw new Error('forbidden');
  if (run.status === 'reconciled') throw new Error('run_reconciled');
  return prisma.collectionRun.update({
    where: { id: run.id },
    data: { status: 'closed', closedAt: new Date() },
  });
}

/**
 * Reconciles a closed run: the agent declares the cash they are depositing.
 * - exact match  -> post the wallet deposit (agent float -> branch pool).
 * - variance     -> still deposit the declared cash, record the variance, and
 *                   raise an ApprovalRequest. Never silently absorbed.
 */
export async function reconcileRun(
  actor: RunActor,
  runId: string,
  input: { cashDeposited: number; depositRef?: string | null; note?: string | null },
) {
  const run = await prisma.collectionRun.findFirst({ where: { id: runId, tenantId: actor.tenantId } });
  if (!run) throw new Error('run_not_found');
  if (actor.role === 'agent' && run.agentId !== actor.agentId) throw new Error('forbidden');
  if (run.status === 'reconciled') throw new Error('already_reconciled');
  if (run.status !== 'closed') throw new Error('run_not_closed');

  const cashCollected = Number(run.cashCollected);
  const cashDeposited = Number(input.cashDeposited);
  if (!Number.isFinite(cashDeposited) || cashDeposited < 0) throw new Error('invalid_amount');
  const variance = Number((cashDeposited - cashCollected).toFixed(2));

  // Deposit the declared cash to the branch pool (hard-blocked above held float).
  if (cashDeposited > 0 && run.branchId) {
    await depositToOffice({
      tenantId: actor.tenantId,
      agentId: run.agentId,
      branchId: run.branchId,
      amount: cashDeposited,
      byUserId: actor.userId,
      note: `Route run deposit${input.depositRef ? ` · ref ${input.depositRef}` : ''}`,
    });
  }

  if (variance !== 0) {
    await prisma.approvalRequest.create({
      data: {
        tenantId: actor.tenantId,
        appType: actor.appType,
        requestType: 'run_reconcile_variance',
        entityType: 'collection_run',
        entityId: run.id,
        requestedById: actor.userId,
        requestedChanges: JSON.stringify({ cashCollected, cashDeposited, variance }),
        reason: input.note ?? `Deposit variance of ${variance} on route run`,
        status: 'pending',
      },
    });
  }

  const updated = await prisma.collectionRun.update({
    where: { id: run.id },
    data: {
      status: 'reconciled',
      reconciledAt: new Date(),
      cashDeposited,
      depositRef: input.depositRef ?? null,
      varianceAmount: variance,
      notes: input.note ?? run.notes,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'update',
      entityType: 'collection_run',
      entityId: run.id,
      newValue: JSON.stringify({ status: 'reconciled', cashCollected, cashDeposited, variance }),
    },
  });

  return updated;
}
