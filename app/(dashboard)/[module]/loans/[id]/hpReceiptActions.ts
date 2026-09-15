'use server';

import prisma from '@/lib/db';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { requireModule } from '@/lib/moduleGate';
import { modulePath } from '@/types/modules';
import {
  planWaterfallAllocation,
  summarizeWaterfallByInstalment,
  type WaterfallInstalment,
} from '@/lib/autofinance/allocation';

/**
 * Auto Finance EMI receipt: takes one bulk amount and settles the ledger in
 * waterfall order (oldest overdue first, penalty before due, remainder onto
 * upcoming instalments).
 *
 * The allocation is recomputed on the server from live rows — the client's
 * preview is advisory only and is never trusted for the write.
 */

async function requireStaff() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session;
}

const receiptSchema = z.object({
  loanId: z.string().min(1),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  paymentMode: z.string().default('cash'),
  referenceNumber: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  /** Admin override — zero or reduce the accrued penalty before allocating. */
  penaltyOverride: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

/** Loads the loan's instalments plus their outstanding penalty, for planning. */
async function loadWaterfallRows(loanId: string): Promise<WaterfallInstalment[]> {
  const [instalments, penalties] = await Promise.all([
    prisma.instalment.findMany({
      where: { loanId },
      orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
      select: {
        id: true, instalmentNo: true, dueDate: true,
        dueAmount: true, receivedAmount: true, status: true,
      },
    }),
    prisma.penalty.findMany({
      where: { loanId, status: 'pending' },
      select: { instalmentId: true, grossPenalty: true, settledAmount: true, waivedAmount: true },
    }),
  ]);

  const penaltyByInstalment = new Map<string, number>();
  for (const p of penalties) {
    if (!p.instalmentId) continue;
    const outstanding = Math.max(
      0,
      Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount),
    );
    penaltyByInstalment.set(
      p.instalmentId,
      (penaltyByInstalment.get(p.instalmentId) ?? 0) + outstanding,
    );
  }

  return instalments.map((i) => ({
    id: i.id,
    instalmentNo: i.instalmentNo,
    dueDate: i.dueDate,
    dueAmount: Number(i.dueAmount),
    receivedAmount: Number(i.receivedAmount),
    status: i.status,
    penaltyOutstanding: penaltyByInstalment.get(i.id) ?? 0,
  }));
}

/**
 * Read-only preview used by the receipt modal so the agent sees exactly which
 * rows a bulk amount will clear before confirming.
 */
export async function previewHpReceipt(loanId: string, amount: number, penaltyOverride?: number) {
  await requireStaff();
  const tenantId = await getDefaultTenantId();

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId },
    select: { id: true },
  });
  if (!loan) return { error: 'Loan not found in your workspace' };

  let rows = await loadWaterfallRows(loanId);
  if (penaltyOverride != null) {
    rows = applyPenaltyOverride(rows, penaltyOverride);
  }

  const plan = planWaterfallAllocation(rows, amount);
  return {
    plan: {
      ...plan,
      lines: plan.lines.map((l) => ({ ...l, dueDate: l.dueDate.toISOString() })),
    },
  };
}

/**
 * Scales the accrued penalty down to the admin's override total, spreading the
 * reduction oldest-first so the earliest rows are cleared first.
 */
function applyPenaltyOverride(rows: WaterfallInstalment[], override: number): WaterfallInstalment[] {
  let budget = Math.max(0, override);
  return rows.map((row) => {
    const accrued = row.penaltyOutstanding ?? 0;
    const kept = Math.min(accrued, budget);
    budget -= kept;
    return { ...row, penaltyOutstanding: kept };
  });
}

export async function recordHpReceipt(formData: FormData) {
  const session = await requireStaff();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');
  const userId = session.user?.id as string;

  const raw = Object.fromEntries(formData.entries()) as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (raw[key] === '') raw[key] = null;

  const parsed = receiptSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const loan = await prisma.loan.findFirst({
    where: { id: data.loanId, tenantId, appType },
    select: { id: true, loanCode: true, status: true, totalCollected: true, totalInstalments: true },
  });
  if (!loan) return { error: 'Loan not found in your workspace' };
  if (loan.status === 'closed') return { error: 'This loan is already closed.' };

  const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
  if (Number.isNaN(paymentDate.getTime())) return { error: 'Invalid payment date' };

  let rows = await loadWaterfallRows(loan.id);
  if (data.penaltyOverride != null) rows = applyPenaltyOverride(rows, data.penaltyOverride);

  const plan = planWaterfallAllocation(rows, data.amount, paymentDate);
  const perInstalment = summarizeWaterfallByInstalment(plan);

  if (perInstalment.length === 0 && plan.unapplied === plan.amount) {
    return { error: 'Nothing is outstanding on this loan — no allocation was possible.' };
  }

  const receiptNo = `RC-${Date.now().toString(36).toUpperCase()}`;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        tenantId,
        loanId: loan.id,
        amount: data.amount,
        paymentMode: data.paymentMode || 'cash',
        paymentDate,
        status: 'completed',
        paymentType: 'general',
        referenceNumber: data.referenceNumber || receiptNo,
      },
    });

    for (const entry of perInstalment) {
      if (entry.dueApplied > 0) {
        await tx.paymentAllocation.create({
          data: { paymentId: payment.id, instalmentId: entry.instalmentId, amount: entry.dueApplied },
        });

        const current = rows.find((r) => r.id === entry.instalmentId)!;
        const newReceived = current.receivedAmount + entry.dueApplied;
        await tx.instalment.update({
          where: { id: entry.instalmentId },
          data: {
            receivedAmount: newReceived,
            status: newReceived >= current.dueAmount ? 'paid' : 'partial',
            receivedAt: paymentDate,
            paymentMode: data.paymentMode || 'cash',
            remarks: data.remarks || undefined,
          },
        });
      }

      if (entry.penaltyApplied > 0) {
        // Settle the oldest pending penalties on this instalment first.
        const pending = await tx.penalty.findMany({
          where: { loanId: loan.id, instalmentId: entry.instalmentId, status: 'pending' },
          orderBy: { createdAt: 'asc' },
        });
        let left = entry.penaltyApplied;
        for (const p of pending) {
          if (left <= 0) break;
          const outstanding = Math.max(
            0,
            Number(p.grossPenalty) - Number(p.settledAmount) - Number(p.waivedAmount),
          );
          const applied = Math.min(outstanding, left);
          left -= applied;
          const settled = Number(p.settledAmount) + applied;
          await tx.penalty.update({
            where: { id: p.id },
            data: {
              settledAmount: settled,
              settledById: userId,
              settledAt: paymentDate,
              status: settled + Number(p.waivedAmount) >= Number(p.grossPenalty) ? 'settled' : 'pending',
            },
          });
        }
      }
    }

    // Recompute loan roll-ups from the instalment rows we just wrote.
    const fresh = await tx.instalment.findMany({
      where: { loanId: loan.id },
      select: { dueAmount: true, receivedAmount: true, status: true },
    });
    const paidCount = fresh.filter((i) => i.status === 'paid' || i.status === 'waived').length;
    const totalCollected = fresh.reduce((sum, i) => sum + Number(i.receivedAmount), 0);
    const allSettled = paidCount === fresh.length && fresh.length > 0;

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        paidCount,
        totalCollected,
        status: allSettled ? 'closed' : 'active',
        closedAt: allSettled ? paymentDate : null,
        closureType: allSettled ? 'normal' : null,
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'hp_receipt',
      entityType: 'loan',
      entityId: loan.id,
      newValue: JSON.stringify({
        receiptNo,
        amount: data.amount,
        duePaid: plan.duePaid,
        penaltyPaid: plan.penaltyPaid,
        unapplied: plan.unapplied,
        instalmentsCleared: plan.instalmentsCleared,
      }),
    },
  });

  revalidatePath(modulePath(appType, `/loans/${loan.loanCode}`));
  revalidatePath(modulePath(appType, '/loans'));
  return {
    success: true,
    receiptNo,
    duePaid: plan.duePaid,
    penaltyPaid: plan.penaltyPaid,
    unapplied: plan.unapplied,
    instalmentsCleared: plan.instalmentsCleared,
  };
}
