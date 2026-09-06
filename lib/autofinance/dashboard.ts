import prisma from '@/lib/db';
import { startOfBusinessToday, startOfBusinessTomorrow } from '@/lib/businessTime';
import { businessDateKey } from './operations';
import type { DueRow, PromiseRow } from '@/components/autofinance/HpOperationsWidgets';

/**
 * Server-side data for the Auto Finance staff dashboard widgets.
 *
 * Kept out of the page component so the dashboard route stays readable and so
 * the same queries can back a mobile endpoint later.
 */

/** Instalments due today, plus anything still overdue, worst first. */
export async function getTodayDueList(
  tenantId: string,
  appType: string,
  limit = 100,
): Promise<DueRow[]> {
  const tomorrow = startOfBusinessTomorrow();

  const instalments = await prisma.instalment.findMany({
    where: {
      dueDate: { lt: tomorrow },
      status: { in: ['upcoming', 'partial', 'missed'] },
      loan: { tenantId, appType, status: { in: ['active', 'overdue'] }, deletedAt: null },
    },
    orderBy: [{ dueDate: 'asc' }],
    take: limit * 3,
    select: {
      dueAmount: true,
      receivedAmount: true,
      dueDate: true,
      loan: {
        select: {
          id: true,
          loanCode: true,
          customer: { select: { id: true, name: true, phone: true } },
          vehicle: { select: { registrationNo: true } },
        },
      },
    },
  });

  const today = startOfBusinessToday().getTime();
  const byLoan = new Map<string, DueRow>();

  for (const inst of instalments) {
    const outstanding = Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount));
    if (outstanding <= 0) continue;

    const dayMs = 24 * 60 * 60 * 1000;
    const daysOverdue = Math.max(0, Math.floor((today - new Date(inst.dueDate).getTime()) / dayMs));

    // One row per loan, accumulating everything it owes as of today.
    const existing = byLoan.get(inst.loan.id);
    if (existing) {
      existing.outstanding += outstanding;
      existing.dueAmount += Number(inst.dueAmount);
      existing.daysOverdue = Math.max(existing.daysOverdue, daysOverdue);
    } else {
      byLoan.set(inst.loan.id, {
        loanId: inst.loan.id,
        loanCode: inst.loan.loanCode,
        customerId: inst.loan.customer.id,
        customerName: inst.loan.customer.name,
        phone: inst.loan.customer.phone,
        registrationNo: inst.loan.vehicle?.registrationNo ?? null,
        dueAmount: Number(inst.dueAmount),
        outstanding,
        daysOverdue,
      });
    }
  }

  return [...byLoan.values()]
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstanding - a.outstanding)
    .slice(0, limit);
}

/**
 * Open promise-to-pay records: the latest unfulfilled promise per customer,
 * from today backwards. A promise older than today is flagged as broken.
 */
export async function getPromisedCustomers(
  tenantId: string,
  appType: string,
  limit = 50,
): Promise<PromiseRow[]> {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() - 30);

  const logs = await prisma.customerCallLog.findMany({
    where: {
      tenantId,
      appType,
      fulfilledAt: null,
      promisedDate: { not: null, gte: horizon },
    },
    orderBy: { promisedDate: 'asc' },
    take: limit * 2,
    select: {
      id: true,
      promisedDate: true,
      promisedAmount: true,
      remarks: true,
      customer: { select: { id: true, name: true, phone: true } },
      loan: { select: { loanCode: true } },
    },
  });

  const todayKey = businessDateKey();
  const seen = new Set<string>();
  const rows: PromiseRow[] = [];

  for (const log of logs) {
    if (seen.has(log.customer.id)) continue;
    seen.add(log.customer.id);
    const key = log.promisedDate!.toISOString().slice(0, 10);
    rows.push({
      id: log.id,
      customerId: log.customer.id,
      customerName: log.customer.name,
      phone: log.customer.phone,
      loanCode: log.loan?.loanCode ?? null,
      promisedDate: key,
      promisedAmount: log.promisedAmount != null ? Number(log.promisedAmount) : null,
      remarks: log.remarks,
      overdue: key < todayKey,
    });
    if (rows.length >= limit) break;
  }

  return rows;
}
