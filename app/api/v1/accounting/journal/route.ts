import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { resolveActor } from '@/lib/api/dualAuth';
import { bumpAccountBalance } from '@/lib/accounting/balances';
import { getPeriodKey, getFiscalYear, getFyStartMonth } from '@/lib/accounting/premium';

async function assignNextEntryNo(tenantId: string, entryDate: Date): Promise<string> {
  const fyStartMonth = await getFyStartMonth(tenantId); // 1-based
  const fy = getFiscalYear(entryDate, fyStartMonth);
  const fyKey = fy.replace('-', '');
  const startMonth = fyStartMonth - 1; // JS Date month index
  const fyStart = entryDate.getMonth() >= startMonth
    ? new Date(entryDate.getFullYear(), startMonth, 1)
    : new Date(entryDate.getFullYear() - 1, startMonth, 1);
  const existing = await prisma.journalEntry.findMany({
    where: { tenantId, entryNo: { startsWith: `JE-${fyKey}-` }, entryDate: { gte: fyStart } },
    select: { entryNo: true },
    orderBy: { entryNo: 'desc' },
    take: 50,
  });
  const max = existing.reduce((highest, entry) => {
    const next = Number(entry.entryNo?.match(/^JE-\d{6,8}-(\d+)$/)?.[1] ?? 0);
    return Number.isFinite(next) && next > highest ? next : highest;
  }, 0);
  return `JE-${fyKey}-${String(max + 1).padStart(4, '0')}`;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveActor(req);
  if (!ctx) return fail('Unauthorized', 401);

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const take = 50;
    const now = new Date();
    
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toStr ? new Date(toStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const branchId = searchParams.get('branchId') || undefined;

    const and: any[] = [];
    if (branchId) {
      and.push({ OR: [{ branchId }, { branchId: null }] });
    }
    if (search) {
      and.push({
        OR: [
          { narration: { contains: search } },
          { entryNo: { contains: search } },
        ],
      });
    }

    const where: any = {
      tenantId: ctx.tenantId,
      entryDate: { gte: from, lte: to },
      status,
      ...(and.length ? { AND: and } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * take,
        take,
        include: { createdBy: { select: { name: true } } },
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return ok({
      rows,
      total,
      page,
      pages: Math.ceil(total / take),
    });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await resolveActor(req);
  if (!ctx) return fail('Unauthorized', 401);

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { action, entryDate: entryDateStr, narration, branchId, lines } = body;

    if (!entryDateStr || !lines || !Array.isArray(lines) || lines.length < 2) {
      return fail('Invalid journal entries data', 400);
    }

    const entryDate = new Date(entryDateStr);
    const totalDr = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCr = lines.reduce((s, l) => s + (l.credit || 0), 0);

    if (Math.abs(totalDr - totalCr) > 0.01) {
      return fail('not_balanced', 400);
    }
    if (totalDr === 0) {
      return fail('empty_entry', 400);
    }

    const periodKey = getPeriodKey(entryDate);
    const period = await prisma.accountingPeriod.findUnique({
      where: { tenantId_periodKey: { tenantId: ctx.tenantId, periodKey } },
    });
    if (period && ['locked', 'closed'].includes(period.status) && ctx.role !== 'developer') {
      return fail('period_locked', 400);
    }

    // Save as draft
    if (action === 'draft') {
      const entry = await prisma.journalEntry.create({
        data: {
          tenantId: ctx.tenantId,
          entryDate,
          narration,
          status: 'draft',
          sourceType: 'manual',
          totalDebit: totalDr,
          totalCredit: totalCr,
          createdById: ctx.userId,
          lines: {
            create: lines.map((l, i) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description || null,
              lineNo: i,
            })),
          },
        },
      });
      return ok({ success: true, status: 'draft', entryId: entry.id });
    }

    // Otherwise, post or submit for approval
    const settings = await prisma.accountingSettings.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    const cap = ctx.role === 'admin' ? Number(settings?.adminJeCap ?? 50000) : Infinity;

    if (totalDr > cap) {
      const entry = await prisma.journalEntry.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: branchId || null,
          entryDate,
          narration,
          status: 'pending_approval',
          sourceType: 'manual',
          totalDebit: totalDr,
          totalCredit: totalCr,
          createdById: ctx.userId,
          lines: {
            create: lines.map((l, i) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description || null,
              lineNo: i,
            })),
          },
        },
      });

      await prisma.accountingApproval.create({
        data: {
          tenantId: ctx.tenantId,
          entityType: 'journal_entry',
          entityId: entry.id,
          amount: totalDr,
          level: 1,
          approverRole: 'superadmin',
          requestedById: ctx.userId,
        },
      });

      return ok({ success: true, status: 'pending_approval', entryId: entry.id });
    }

    // Directly post
    const entryNo = await assignNextEntryNo(ctx.tenantId, entryDate);
    const entry = await prisma.$transaction(async (tx) => {
      const je = await tx.journalEntry.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: branchId || null,
          entryNo,
          entryDate,
          narration,
          status: 'posted',
          sourceType: 'manual',
          totalDebit: totalDr,
          totalCredit: totalCr,
          createdById: ctx.userId,
          approvedById: ctx.userId,
          approvedAt: new Date(),
          lines: {
            create: lines.map((l, i) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description || null,
              lineNo: i,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of je.lines) {
        await bumpAccountBalance(tx as any, line.accountId, entryDate, line.debit, line.credit);
      }

      await tx.accountingAuditLog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'post',
          entityType: 'journal_entry',
          entityId: je.id,
          after: JSON.stringify({ entryNo, totalDebit: totalDr }),
        },
      });

      return je;
    });

    return ok({ success: true, status: 'posted', entryId: entry.id, entryNo });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
