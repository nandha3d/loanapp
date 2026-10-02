import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { recordCollection, type CollectionGpsCapture } from '@/lib/collectionWrite';
import { depositToOfficeInTx } from '@/lib/wallet';
import { postSettledCollections, settleAgentCashInTx } from '@/lib/cashSettlement';
import { getCollectionSubmissionBlockReason, COLLECTIBLE_LOAN_STATUSES } from '@/lib/collectionPolicy';
import { modulePath } from '@/types/modules';
import { startOfBusinessDayUtc, parseBusinessDayUtc } from '@/lib/businessTime';

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
  if (!value) return startOfBusinessDayUtc();
  if (typeof value === 'string') return parseBusinessDayUtc(value);
  return startOfBusinessDayUtc(value);
}

/**
 * A run by id, as the actor may see it: tenant + module always; staff by the
 * ACTIVE branch (SCOPE-3). Agents are checked by `run.agentId` after the lookup
 * (SCOPE-5), so no branch filter for them here.
 */
export function runAccessWhere(actor: Pick<RunActor, 'tenantId' | 'appType' | 'branchId' | 'role'>, id: string) {
  return {
    id,
    tenantId: actor.tenantId,
    appType: actor.appType,
    ...(actor.role !== 'agent' && actor.branchId ? { branchId: actor.branchId } : {}),
  };
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
 * instalment, ordered by the route's walking sequence, then today's due
 * before overdue (oldest first) — MONEY-10.
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
    // MONEY-10 (RUN-01): within a stop, today's due first, then overdue
    // oldest-first. The sheet only holds rows due on or before today.
    .sort((a, b) =>
      a.stopSeq - b.stopSeq ||
      Number(a.overdue) - Number(b.overdue) ||
      a.dueDate.getTime() - b.dueDate.getTime() ||
      a.instalmentNo - b.instalmentNo);

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

  const route = await prisma.route.findFirst({
    where: { id: input.routeId, tenantId: actor.tenantId, appType: actor.appType },
    select: { id: true, branchId: true },
  });

  return prisma.collectionRun.create({
    data: {
      tenantId: actor.tenantId,
      branchId: route?.branchId ?? actor.branchId ?? null,
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
  /** One instalment row — or leave empty and send `loanId` for a loan-level line. */
  instalmentId: string;
  /** DEC-03 (B): loan-level line; the server splits it over the loan's rows (MONEY-10). */
  loanId?: string;
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
/** DEC-03 (B): one entry per loan on the sheet — the totals both clients show. */
export type RunSheetLoan = {
  loanId: string;
  loanCode: string;
  customerId: string;
  customerCode: string | null;
  name: string;
  phone: string | null;
  stopSeq: number;
  totalOutstanding: number;
  dueCount: number;
  overdue: boolean;
  maxDaysOverdue: number;
  firstInstalmentId: string;
};

/** Groups sheet rows per loan, keeping the sheet (MONEY-10) order. */
export function groupRunSheetByLoan(rows: RunSheetRow[]): RunSheetLoan[] {
  const byLoan = new Map<string, RunSheetLoan>();
  for (const r of rows) {
    const g = byLoan.get(r.loanId);
    if (!g) {
      byLoan.set(r.loanId, {
        loanId: r.loanId, loanCode: r.loanCode, customerId: r.customerId, customerCode: r.customerCode,
        name: r.name, phone: r.phone, stopSeq: r.stopSeq, totalOutstanding: r.outstanding, dueCount: 1,
        overdue: r.overdue, maxDaysOverdue: r.daysOverdue, firstInstalmentId: r.instalmentId,
      });
    } else {
      g.totalOutstanding = Math.round((g.totalOutstanding + r.outstanding) * 100) / 100;
      g.dueCount += 1;
      g.overdue = g.overdue || r.overdue;
      g.maxDaysOverdue = Math.max(g.maxDaysOverdue, r.daysOverdue);
    }
  }
  return [...byLoan.values()];
}

/**
 * DEC-03 (B): split a loan-level amount over that loan's sheet rows in sheet
 * order (today first, then overdue oldest-first — MONEY-10). Returns the
 * per-instalment amounts and whatever exceeds the rows on the sheet.
 */
export function splitLoanAmount(rows: Array<{ instalmentId: string; outstanding: number }>, amount: number) {
  const parts: Array<{ instalmentId: string; amount: number }> = [];
  let remaining = Math.round(amount * 100) / 100;
  for (const r of rows) {
    if (remaining <= 0) break;
    const pay = Math.round(Math.min(remaining, r.outstanding) * 100) / 100;
    if (pay <= 0) continue;
    parts.push({ instalmentId: r.instalmentId, amount: pay });
    remaining = Math.round((remaining - pay) * 100) / 100;
  }
  return { parts, unapplied: Math.max(0, remaining) };
}

export async function collectRunLines(
  actor: RunActor,
  runId: string,
  lines: RunCollectLine[],
): Promise<RunCollectResult> {
  const run = await prisma.collectionRun.findFirst({
    where: runAccessWhere(actor, runId),
  });
  if (!run) throw new Error('run_not_found');
  if (run.status === 'closed' || run.status === 'reconciled') throw new Error('run_closed');
  if (run.agentId !== actor.userId) throw new Error('not_run_owner');

  const posted: RunCollectResult['posted'] = [];
  const skipped: RunCollectResult['skipped'] = [];

  // DEC-03 (B): expand loan-level lines on the server, in sheet order.
  if (lines.some((l) => l.loanId && !l.instalmentId)) {
    const sheet = run.routeId ? await buildRouteSheet(actor, run.routeId, run.date) : [];
    const expanded: RunCollectLine[] = [];
    for (const line of lines) {
      if (!line.loanId || line.instalmentId) { expanded.push(line); continue; }
      const amount = Number(line.receivedAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        skipped.push({ instalmentId: '', reason: 'invalid_amount' });
        continue;
      }
      const { parts, unapplied } = splitLoanAmount(sheet.filter((r) => r.loanId === line.loanId), amount);
      if (parts.length === 0) skipped.push({ instalmentId: '', reason: 'nothing_due' });
      if (unapplied > 0) skipped.push({ instalmentId: parts.at(-1)?.instalmentId ?? '', reason: 'exceeds_due' });
      for (const p of parts) expanded.push({ ...line, instalmentId: p.instalmentId, receivedAmount: p.amount });
    }
    lines = expanded;
  }
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
            appType: actor.appType,
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
  const run = await prisma.collectionRun.findFirst({ where: runAccessWhere(actor, runId) });
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
  const run = await prisma.collectionRun.findFirst({ where: runAccessWhere(actor, runId) });
  if (!run) throw new Error('run_not_found');
  if (actor.role === 'agent' && run.agentId !== actor.agentId) throw new Error('forbidden');
  if (run.status === 'reconciled') throw new Error('already_reconciled');
  if (run.status !== 'closed') throw new Error('run_not_closed');

  const cashCollected = Number(run.cashCollected);
  const cashDeposited = Number(input.cashDeposited);
  if (!Number.isFinite(cashDeposited) || cashDeposited < 0) throw new Error('invalid_amount');
  const variance = Number((cashDeposited - cashCollected).toFixed(2));

  // MON-02 (X-6): the deposit, the variance approval, the run update and the
  // audit commit together; the run is claimed so it can be reconciled once.
  // An admin reconciling an agent's run settles the cash through the one
  // settlement path (lib/cashSettlement.ts); an agent's own deposit keeps the
  // plain float → branch move (an agent never verifies their own collections).
  const settleActor = { tenantId: actor.tenantId, appType: actor.appType, userId: actor.userId, branchId: actor.branchId ?? null };
  const isAdminSettle = actor.role !== 'agent';
  const { updated, settled } = await prisma.$transaction(async (tx) => {
    const claimed = await tx.collectionRun.updateMany({
      where: { id: run.id, status: 'closed' },
      data: { status: 'reconciled' },
    });
    if (claimed.count !== 1) throw new Error('already_reconciled');

    let settled: Awaited<ReturnType<typeof settleAgentCashInTx>> | null = null;
    if (cashDeposited > 0 && run.branchId) {
      const note = `Route run deposit${input.depositRef ? ` · ref ${input.depositRef}` : ''}`;
      if (isAdminSettle) {
        settled = await settleAgentCashInTx(tx, settleActor, {
          agentId: run.agentId,
          amount: cashDeposited,
          note,
          routeId: run.routeId,
        });
      } else {
        await depositToOfficeInTx(tx, {
          tenantId: actor.tenantId,
          appType: actor.appType,
          agentId: run.agentId,
          branchId: run.branchId,
          amount: cashDeposited,
          byUserId: actor.userId,
          note,
        });
      }
    }

    if (variance !== 0) {
      await tx.approvalRequest.create({
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

    const updated = await tx.collectionRun.update({
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

    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: 'update',
        entityType: 'collection_run',
        entityId: run.id,
        newValue: JSON.stringify({ status: 'reconciled', cashCollected, cashDeposited, variance }),
      },
    });
    return { updated, settled };
  });
  // GL for the collections the settlement verified, after commit (ACC-7).
  if (settled) await postSettledCollections(settleActor, settled);

  // Announce the variance approval AFTER the reconciliation has committed
  // (NOTIF-1). Raising the ApprovalRequest without this left a cash discrepancy
  // sitting in the queue that no admin was ever told about (NOTIF-6).
  if (variance !== 0) {
    const { notifyApprovers } = await import('@/lib/notify/approvers');
    const sign = variance > 0 ? 'excess' : 'shortfall';
    await notifyApprovers({
      tenantId: actor.tenantId,
      branchId: run.branchId,
      requesterBranchId: actor.branchId,
      requesterRole: actor.role,
      appType: actor.appType,
      type: 'run_variance_review',
      icon: 'account_balance_wallet',
      title: 'Route run cash variance',
      message: `Agent deposited ${cashDeposited} against ${cashCollected} collected — ${sign} of ${Math.abs(variance)}.`,
      link: modulePath(actor.appType, '/approvals'),
    });
  }

  return updated;
}
