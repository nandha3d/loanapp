'use server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { writeAuditLog, getFiscalYear, getPeriodKey } from '@/lib/accounting/premium';
import { bumpAccountBalance } from '@/lib/accounting/balances';

export async function listPeriods(fiscalYear?: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const today = new Date();
  const fy = fiscalYear ?? getFiscalYear(today);

  let periods = await prisma.accountingPeriod.findMany({
    where: { tenantId, fiscalYear: fy },
    include: {
      lockedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      closingJE: { select: { id: true, entryNo: true } },
    },
    orderBy: { periodFrom: 'asc' },
  });

  // If no periods exist for this FY, auto-create them
  if (periods.length === 0) {
    periods = await autoCreateFYPeriods(tenantId, fy);
  }

  // Compute net profit for each period from journal lines
  const result = await Promise.all(periods.map(async (p) => {
    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.journalLine.aggregate({
        _sum: { credit: true, debit: true },
        where: { entry: { tenantId, status: 'posted', entryDate: { gte: p.periodFrom, lte: p.periodTo } }, account: { classType: 'income' } },
      }),
      prisma.journalLine.aggregate({
        _sum: { debit: true, credit: true },
        where: { entry: { tenantId, status: 'posted', entryDate: { gte: p.periodFrom, lte: p.periodTo } }, account: { classType: 'expense' } },
      }),
    ]);
    const netIncome = Number(incomeAgg._sum.credit ?? 0) - Number(incomeAgg._sum.debit ?? 0);
    const netExpense = Number(expenseAgg._sum.debit ?? 0) - Number(expenseAgg._sum.credit ?? 0);
    const netProfit = netIncome - netExpense;

    return {
      id: p.id,
      periodKey: p.periodKey,
      periodFrom: p.periodFrom,
      periodTo: p.periodTo,
      fiscalYear: p.fiscalYear,
      status: p.status,
      netProfit,
      closingJE: p.closingJE,
      lockedBy: p.lockedBy,
      closedBy: p.closedBy,
      lockedAt: p.lockedAt,
      closedAt: p.closedAt,
    };
  }));

  return result;
}

async function autoCreateFYPeriods(tenantId: string, fiscalYear: string): Promise<any[]> {
  // FY '2026-27' starts April 2026
  const fyStart = parseInt(fiscalYear.split('-')[0]);
  const startMonth = 3; // April = month index 3 (0-based)
  const created = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(fyStart, startMonth + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const periodFrom = new Date(year, month, 1);
    const periodTo = new Date(year, month + 1, 0);
    try {
      const p = await prisma.accountingPeriod.create({
        data: { tenantId, periodKey, periodFrom, periodTo, fiscalYear, status: 'open' },
      });
      created.push(p);
    } catch {} // May already exist
  }
  return created.length > 0 ? created : await prisma.accountingPeriod.findMany({ where: { tenantId, fiscalYear }, orderBy: { periodFrom: 'asc' } });
}

export async function ensurePeriodExists(tenantId: string, date: Date) {
  const periodKey = getPeriodKey(date);
  const fiscalYear = getFiscalYear(date);
  const month = date.getMonth();
  const year = date.getFullYear();
  const periodFrom = new Date(year, month, 1);
  const periodTo = new Date(year, month + 1, 0);

  return prisma.accountingPeriod.upsert({
    where: { tenantId_periodKey: { tenantId, periodKey } },
    create: { tenantId, periodKey, periodFrom, periodTo, fiscalYear, status: 'open' },
    update: {},
  });
}

export async function softLockPeriod(periodId: string, reason?: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  await prisma.$transaction([
    prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: 'soft_locked', lockedById: session.user!.id!, lockedAt: new Date() } }),
    prisma.periodLock.create({ data: { periodId, action: 'soft_lock', reason, byUserId: session.user!.id! } }),
  ]);

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'soft_lock_period', entityType: 'period', entityId: periodId, reason });
  return { ok: true };
}

export async function lockPeriod(periodId: string, reason?: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  await prisma.$transaction([
    prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: 'locked', lockedById: session.user!.id!, lockedAt: new Date() } }),
    prisma.periodLock.create({ data: { periodId, action: 'lock', reason, byUserId: session.user!.id! } }),
  ]);

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'lock_period', entityType: 'period', entityId: periodId, reason });
  return { ok: true };
}

export async function closePeriod(periodId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, tenantId } });
  if (!period) return { ok: false, error: 'Period not found' };
  if (period.status === 'closed') return { ok: true, data: { closingJEId: period.closingJEId } }; // Idempotent

  // Compute P&L
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.journalLine.findMany({
      where: { entry: { tenantId, status: 'posted', entryDate: { gte: period.periodFrom, lte: period.periodTo } }, account: { classType: 'income' } },
      include: { account: true },
    }),
    prisma.journalLine.findMany({
      where: { entry: { tenantId, status: 'posted', entryDate: { gte: period.periodFrom, lte: period.periodTo } }, account: { classType: 'expense' } },
      include: { account: true },
    }),
  ]);

  // Find or create 3300 Current Year Earnings
  let retainedAcct = await prisma.account.findFirst({ where: { tenantId, code: '3300' } });
  if (!retainedAcct) {
    retainedAcct = await prisma.account.create({
      data: { tenantId, code: '3300', name: 'Current Year Earnings', classType: 'equity', subType: 'reserves', normalSide: 'credit', isActive: true },
    });
  }

  // Build closing JE lines
  const jeLines: any[] = [];

  // Group by account
  const incomeByAccount = groupByAccount(incomeAgg);
  for (const [accountId, { net }] of Object.entries(incomeByAccount)) {
    if (Math.abs(net) < 0.01) continue;
    jeLines.push({ accountId, debit: net, credit: 0, description: 'Period close — zero income', lineNo: jeLines.length });
    jeLines.push({ accountId: retainedAcct.id, debit: 0, credit: net, description: 'Period close — to retained earnings', lineNo: jeLines.length });
  }

  const expenseByAccount = groupByAccount(expenseAgg);
  for (const [accountId, { net }] of Object.entries(expenseByAccount)) {
    if (Math.abs(net) < 0.01) continue;
    jeLines.push({ accountId: retainedAcct.id, debit: net, credit: 0, description: 'Period close — from retained earnings', lineNo: jeLines.length });
    jeLines.push({ accountId, debit: 0, credit: net, description: 'Period close — zero expense', lineNo: jeLines.length });
  }

  if (jeLines.length === 0) {
    // Nothing to close — just mark as closed
    await prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: 'closed', closedById: session.user!.id!, closedAt: new Date() } });
    return { ok: true, data: { closingJEId: null } };
  }

  const fyKey = period.fiscalYear.replace('-','');
  const count = await prisma.journalEntry.count({ where: { tenantId } });
  const entryNo = `JE-${fyKey}-${String(count + 1).padStart(4, '0')}`;
  const totalDr = jeLines.reduce((s, l) => s + l.debit, 0);
  const totalCr = jeLines.reduce((s, l) => s + l.credit, 0);

  const result = await prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({
      data: {
        tenantId,
        entryDate: period.periodTo,
        entryNo,
        narration: `Close ${period.periodKey}`,
        sourceType: 'period_close',
        status: 'posted',
        createdById: session.user!.id!,
        totalDebit: totalDr,
        totalCredit: totalCr,
        lines: { create: jeLines },
      },
    });

    for (const line of jeLines) {
      await bumpAccountBalance(tx, line.accountId, period.periodTo, line.debit, line.credit);
    }

    await tx.accountingPeriod.update({
      where: { id: periodId },
      data: { status: 'closed', closedById: session.user!.id!, closedAt: new Date(), closingJEId: je.id },
    });

    await tx.periodLock.create({ data: { periodId, action: 'close', byUserId: session.user!.id! } });

    return { closingJEId: je.id };
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'close_period', entityType: 'period', entityId: periodId });
  return { ok: true, data: result };
}

function groupByAccount(lines: any[]): Record<string, { net: number }> {
  const map: Record<string, { net: number }> = {};
  for (const l of lines) {
    if (!map[l.accountId]) map[l.accountId] = { net: 0 };
    map[l.accountId].net += Number(l.credit) - Number(l.debit);
  }
  return map;
}

export async function unlockPeriod(periodId: string, reason: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };
  if (!reason || reason.length < 10) return { ok: false, error: 'no_reason' };

  await prisma.$transaction([
    prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: 'open', lockedById: null, lockedAt: null } }),
    prisma.periodLock.create({ data: { periodId, action: 'unlock', reason, byUserId: session.user!.id! } }),
  ]);

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'unlock_period', entityType: 'period', entityId: periodId, reason });
  return { ok: true };
}

export async function reopenPeriod(periodId: string, reason: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };
  if (!reason || reason.length < 10) return { ok: false, error: 'no_reason' };

  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, tenantId } });
  if (!period) return { ok: false, error: 'Not found' };

  await prisma.$transaction(async (tx) => {
    // If closed, reverse the closing JE
    if (period.closingJEId) {
      const closingJE = await tx.journalEntry.findUnique({ where: { id: period.closingJEId }, include: { lines: true } });
      if (closingJE) {
        const reversalLines = closingJE.lines.map((l, i) => ({
          accountId: l.accountId,
          debit: Number(l.credit),
          credit: Number(l.debit),
          description: `Reversal: ${l.description}`,
          lineNo: i,
        }));
        const fyKey = period.fiscalYear.replace('-','');
        const count = await tx.journalEntry.count({ where: { tenantId } });
        const entryNo = `JE-${fyKey}-${String(count + 1).padStart(4, '0')}`;

        const reversalJE = await tx.journalEntry.create({
          data: {
            tenantId,
            entryDate: new Date(),
            entryNo,
            narration: `Reversal of period close ${period.periodKey}`,
            sourceType: 'reversal',
            status: 'posted',
            createdById: session.user!.id!,
            totalDebit: reversalLines.reduce((s, l) => s + l.debit, 0),
            totalCredit: reversalLines.reduce((s, l) => s + l.credit, 0),
            lines: { create: reversalLines },
          },
        });

        for (const line of reversalLines) {
          await bumpAccountBalance(tx, line.accountId, new Date(), line.debit, line.credit);
        }

        await tx.journalEntry.update({ where: { id: period.closingJEId }, data: { reversedById: reversalJE.id } });
      }
    }

    await tx.accountingPeriod.update({
      where: { id: periodId },
      data: { status: 'open', closedById: null, closedAt: null, closingJEId: null, lockedById: null, lockedAt: null },
    });

    await tx.periodLock.create({ data: { periodId, action: 'reopen', reason, byUserId: session.user!.id! } });
  });

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'reopen_period', entityType: 'period', entityId: periodId, reason });
  return { ok: true };
}

export async function listAuditLog(filter: { action?: string; entityType?: string; from?: string; to?: string }, cursor?: string, limit = 50) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const rows = await prisma.accountingAuditLog.findMany({
    where: {
      tenantId,
      action: filter.action || undefined,
      entityType: filter.entityType || undefined,
      createdAt: {
        gte: filter.from ? new Date(filter.from) : undefined,
        lte: filter.to ? new Date(filter.to) : undefined,
      },
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return { rows: data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export async function getDistinctFiscalYears() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const periods = await prisma.accountingPeriod.findMany({
    where: { tenantId },
    select: { fiscalYear: true },
    distinct: ['fiscalYear'],
    orderBy: { fiscalYear: 'desc' },
  });

  return periods.map(p => p.fiscalYear);
}
