import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { writeAuditLog, getFiscalYear, getPeriodKey } from '@/lib/accounting/premium';
import { bumpAccountBalance } from '@/lib/accounting/balances';

async function autoCreateFYPeriods(tenantId: string, fiscalYear: string): Promise<any[]> {
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
    } catch {}
  }
  return created.length > 0 ? created : await prisma.accountingPeriod.findMany({ where: { tenantId, fiscalYear }, orderBy: { periodFrom: 'asc' } });
}

function groupByAccount(lines: any[]): Record<string, { net: number }> {
  const map: Record<string, { net: number }> = {};
  for (const l of lines) {
    if (!map[l.accountId]) map[l.accountId] = { net: 0 };
    map[l.accountId].net += Number(l.credit) - Number(l.debit);
  }
  return map;
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const today = new Date();
    const fy = searchParams.get('fiscalYear') ?? getFiscalYear(today);

    let periods = await prisma.accountingPeriod.findMany({
      where: { tenantId: ctx.tenantId, fiscalYear: fy },
      include: {
        lockedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
        closingJE: { select: { id: true, entryNo: true } },
      },
      orderBy: { periodFrom: 'asc' },
    });

    if (periods.length === 0) {
      periods = await autoCreateFYPeriods(ctx.tenantId, fy);
    }

    const result = await Promise.all(periods.map(async (p) => {
      const [incomeAgg, expenseAgg] = await Promise.all([
        prisma.journalLine.aggregate({
          _sum: { credit: true, debit: true },
          where: { entry: { tenantId: ctx.tenantId, status: 'posted', entryDate: { gte: p.periodFrom, lte: p.periodTo } }, account: { classType: 'income' } },
        }),
        prisma.journalLine.aggregate({
          _sum: { debit: true, credit: true },
          where: { entry: { tenantId: ctx.tenantId, status: 'posted', entryDate: { gte: p.periodFrom, lte: p.periodTo } }, account: { classType: 'expense' } },
        }),
      ]);
      const netIncome = Number(incomeAgg._sum.credit ?? 0) - Number(incomeAgg._sum.debit ?? 0);
      const netExpense = Number(expenseAgg._sum.debit ?? 0) - Number(expenseAgg._sum.credit ?? 0);
      const netProfit = netIncome - netExpense;

      return {
        id: p.id,
        periodKey: p.periodKey,
        periodFrom: p.periodFrom.toISOString(),
        periodTo: p.periodTo.toISOString(),
        fiscalYear: p.fiscalYear,
        status: p.status,
        netProfit,
        closingJE: p.closingJE,
        lockedBy: p.lockedBy,
        closedBy: p.closedBy,
        lockedAt: p.lockedAt?.toISOString() || null,
        closedAt: p.closedAt?.toISOString() || null,
      };
    }));

    return ok(result);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { action, periodId, reason } = body;

    if (!periodId) {
      return fail('Missing periodId', 400);
    }

    const period = await prisma.accountingPeriod.findFirst({
      where: { id: periodId, tenantId: ctx.tenantId },
    });
    if (!period) {
      return fail('Period not found', 404);
    }

    if (action === 'soft_lock') {
      await prisma.$transaction([
        prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: 'soft_locked', lockedById: ctx.userId, lockedAt: new Date() } }),
        prisma.periodLock.create({ data: { periodId, action: 'soft_lock', reason: reason || null, byUserId: ctx.userId } }),
      ]);
      await writeAuditLog({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'soft_lock_period', entityType: 'period', entityId: periodId, reason });
      return ok({ success: true });
    }

    if (action === 'lock') {
      await prisma.$transaction([
        prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: 'locked', lockedById: ctx.userId, lockedAt: new Date() } }),
        prisma.periodLock.create({ data: { periodId, action: 'lock', reason: reason || null, byUserId: ctx.userId } }),
      ]);
      await writeAuditLog({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'lock_period', entityType: 'period', entityId: periodId, reason });
      return ok({ success: true });
    }

    if (action === 'close') {
      if (period.status === 'closed') {
        return ok({ success: true, closingJEId: period.closingJEId });
      }

      const [incomeAgg, expenseAgg] = await Promise.all([
        prisma.journalLine.findMany({
          where: { entry: { tenantId: ctx.tenantId, status: 'posted', entryDate: { gte: period.periodFrom, lte: period.periodTo } }, account: { classType: 'income' } },
          include: { account: true },
        }),
        prisma.journalLine.findMany({
          where: { entry: { tenantId: ctx.tenantId, status: 'posted', entryDate: { gte: period.periodFrom, lte: period.periodTo } }, account: { classType: 'expense' } },
          include: { account: true },
        }),
      ]);

      let retainedAcct = await prisma.account.findFirst({ where: { tenantId: ctx.tenantId, code: '3300' } });
      if (!retainedAcct) {
        retainedAcct = await prisma.account.create({
          data: { tenantId: ctx.tenantId, code: '3300', name: 'Current Year Earnings', classType: 'equity', subType: 'reserves', normalSide: 'credit', isActive: true },
        });
      }

      const jeLines: any[] = [];
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
        await prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: 'closed', closedById: ctx.userId, closedAt: new Date() } });
        return ok({ success: true, closingJEId: null });
      }

      const fyKey = period.fiscalYear.replace('-', '');
      const count = await prisma.journalEntry.count({ where: { tenantId: ctx.tenantId } });
      const entryNo = `JE-${fyKey}-${String(count + 1).padStart(4, '0')}`;
      const totalDr = jeLines.reduce((s, l) => s + l.debit, 0);
      const totalCr = jeLines.reduce((s, l) => s + l.credit, 0);

      const closingJEId = await prisma.$transaction(async (tx) => {
        const je = await tx.journalEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryDate: period.periodTo,
            entryNo,
            narration: `Close ${period.periodKey}`,
            sourceType: 'period_close',
            status: 'posted',
            createdById: ctx.userId,
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
          data: { status: 'closed', closedById: ctx.userId, closedAt: new Date(), closingJEId: je.id },
        });

        await tx.periodLock.create({ data: { periodId, action: 'close', byUserId: ctx.userId } });

        return je.id;
      });

      await writeAuditLog({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'close_period', entityType: 'period', entityId: periodId });
      return ok({ success: true, closingJEId });
    }

    if (action === 'unlock') {
      if (!reason || reason.length < 10) {
        return fail('reasons_too_short', 400);
      }
      await prisma.$transaction([
        prisma.accountingPeriod.update({ where: { id: periodId }, data: { status: 'open', lockedById: null, lockedAt: null } }),
        prisma.periodLock.create({ data: { periodId, action: 'unlock', reason, byUserId: ctx.userId } }),
      ]);
      await writeAuditLog({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'unlock_period', entityType: 'period', entityId: periodId, reason });
      return ok({ success: true });
    }

    if (action === 'reopen') {
      if (!reason || reason.length < 10) {
        return fail('reasons_too_short', 400);
      }

      await prisma.$transaction(async (tx) => {
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
            const fyKey = period.fiscalYear.replace('-', '');
            const count = await tx.journalEntry.count({ where: { tenantId: ctx.tenantId } });
            const entryNo = `JE-${fyKey}-${String(count + 1).padStart(4, '0')}`;

            const reversalJE = await tx.journalEntry.create({
              data: {
                tenantId: ctx.tenantId,
                entryDate: new Date(),
                entryNo,
                narration: `Reversal of period close ${period.periodKey}`,
                sourceType: 'reversal',
                status: 'posted',
                createdById: ctx.userId,
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

        await tx.periodLock.create({ data: { periodId, action: 'reopen', reason, byUserId: ctx.userId } });
      });

      await writeAuditLog({ tenantId: ctx.tenantId, userId: ctx.userId, action: 'reopen_period', entityType: 'period', entityId: periodId, reason });
      return ok({ success: true });
    }

    return fail('Invalid action', 400);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
