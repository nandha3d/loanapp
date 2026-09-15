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
  businessDateKey,
  businessDateValue,
  summarizeDayClosing,
  evaluateDayClosingGate,
} from '@/lib/autofinance/operations';

/**
 * Auto Finance daily operations: end-of-day cash reconciliation and the
 * promise-to-pay call log that feeds the "Promised Customers" widget.
 */

async function requireStaff() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session;
}

/** Cash movement for one business day, used to prefill the closing modal. */
export async function getDayClosingSnapshot(dateKey?: string) {
  await requireStaff();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const key = dateKey || businessDateKey();
  const dayStart = new Date(`${key}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [collected, disbursed, receiptCount, previous, existing] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        tenantId,
        paymentDate: { gte: dayStart, lt: dayEnd },
        loan: { appType },
      },
      _sum: { amount: true },
    }),
    prisma.loan.aggregate({
      where: { tenantId, appType, createdAt: { gte: dayStart, lt: dayEnd }, status: { not: 'pending_review' } },
      _sum: { disbursed: true },
    }),
    prisma.payment.count({
      where: { tenantId, paymentDate: { gte: dayStart, lt: dayEnd }, loan: { appType } },
    }),
    // Yesterday's counted closing becomes today's opening float.
    prisma.dayClosingLog.findFirst({
      where: { tenantId, appType, businessDate: { lt: dayStart } },
      orderBy: { businessDate: 'desc' },
      select: { countedClosing: true },
    }),
    prisma.dayClosingLog.findFirst({
      where: { tenantId, appType, businessDate: dayStart },
    }),
  ]);

  const summary = summarizeDayClosing({
    openingCash: Number(previous?.countedClosing ?? 0),
    collectedCash: Number(collected._sum.amount ?? 0),
    disbursedCash: Number(disbursed._sum.disbursed ?? 0),
    // Assume a balanced count until the operator types the real figure.
    countedClosing: Number(previous?.countedClosing ?? 0)
      + Number(collected._sum.amount ?? 0)
      - Number(disbursed._sum.disbursed ?? 0),
  });

  return {
    businessDate: key,
    alreadyClosed: Boolean(existing),
    receiptCount,
    ...summary,
  };
}

/** Whether the operator must close a prior day before working the pending list. */
export async function getDayClosingGate() {
  await requireStaff();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();

  const [recent, firstLoan] = await Promise.all([
    prisma.dayClosingLog.findMany({
      where: { tenantId, appType },
      orderBy: { businessDate: 'desc' },
      take: 10,
      select: { businessDate: true },
    }),
    prisma.loan.findFirst({
      where: { tenantId, appType },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);

  return evaluateDayClosingGate(
    recent.map((r) => r.businessDate.toISOString().slice(0, 10)),
    new Date(),
    firstLoan ? businessDateKey(firstLoan.createdAt) : null,
  );
}

const closeSchema = z.object({
  businessDate: z.string().min(1),
  openingCash: z.coerce.number().min(0).default(0),
  countedClosing: z.coerce.number().min(0).default(0),
  remarks: z.string().optional().nullable(),
});

export async function closeBusinessDay(formData: FormData) {
  const session = await requireStaff();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');
  const userId = session.user?.id as string;
  const branchId = (session.user as any)?.branchId ?? null;

  const raw = Object.fromEntries(formData.entries()) as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (raw[key] === '') raw[key] = null;

  const parsed = closeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  // Never let an operator close a day that has not happened yet.
  if (data.businessDate > businessDateKey()) {
    return { error: 'You cannot close a future business day.' };
  }

  const snapshot = await getDayClosingSnapshot(data.businessDate);
  if (snapshot.alreadyClosed) {
    return { error: `${data.businessDate} is already closed.` };
  }

  const summary = summarizeDayClosing({
    openingCash: data.openingCash,
    collectedCash: snapshot.collectedCash,
    disbursedCash: snapshot.disbursedCash,
    countedClosing: data.countedClosing,
  });

  try {
    await prisma.dayClosingLog.create({
      data: {
        tenantId,
        branchId,
        appType,
        businessDate: businessDateValue(new Date(`${data.businessDate}T12:00:00.000Z`)),
        openingCash: summary.openingCash,
        collectedCash: summary.collectedCash,
        disbursedCash: summary.disbursedCash,
        expectedClosing: summary.expectedClosing,
        countedClosing: summary.countedClosing,
        variance: summary.variance,
        receiptCount: snapshot.receiptCount,
        remarks: data.remarks || null,
        closedById: userId,
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: `${data.businessDate} is already closed.` };
    throw e;
  }

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'day_close',
      entityType: 'day_closing',
      entityId: data.businessDate,
      newValue: JSON.stringify(summary),
    },
  });

  revalidatePath(modulePath(appType, '/dashboard'));
  revalidatePath(modulePath(appType, '/pending-tasks'));
  return { success: true, variance: summary.variance };
}

// ---------------------------------------------------------------------------
// Call log / promise-to-pay
// ---------------------------------------------------------------------------

const callLogSchema = z.object({
  customerId: z.string().min(1),
  loanId: z.string().optional().nullable(),
  channel: z.string().default('call'),
  outcome: z.string().default('other'),
  remarks: z.string().optional().nullable(),
  promisedDate: z.string().optional().nullable(),
  promisedAmount: z.coerce.number().min(0).optional().nullable(),
});

export async function logCustomerCall(formData: FormData) {
  const session = await requireStaff();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  await requireModule(tenantId, 'autofinance');
  const userId = session.user?.id as string;

  const raw = Object.fromEntries(formData.entries()) as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (raw[key] === '') raw[key] = null;

  const parsed = callLogSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  // Both the customer and, when given, the loan must be in this workspace.
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, tenantId, appType },
    select: { id: true },
  });
  if (!customer) return { error: 'Customer not found in your workspace' };

  if (data.loanId) {
    const loan = await prisma.loan.findFirst({
      where: { id: data.loanId, tenantId, appType, customerId: data.customerId },
      select: { id: true },
    });
    if (!loan) return { error: 'Loan not found for this customer' };
  }

  const promisedDate = data.promisedDate ? new Date(data.promisedDate) : null;
  if (promisedDate && Number.isNaN(promisedDate.getTime())) {
    return { error: 'Invalid promise date' };
  }

  await prisma.customerCallLog.create({
    data: {
      tenantId,
      appType,
      customerId: data.customerId,
      loanId: data.loanId || null,
      channel: data.channel,
      // A promise date implies the outcome, whatever the dropdown said.
      outcome: promisedDate ? 'promised' : data.outcome,
      remarks: data.remarks || null,
      promisedDate,
      promisedAmount: data.promisedAmount ?? null,
      loggedById: userId,
    },
  });

  revalidatePath(modulePath(appType, '/dashboard'));
  if (data.loanId) revalidatePath(modulePath(appType, `/loans/${data.loanId}`));
  return { success: true };
}
