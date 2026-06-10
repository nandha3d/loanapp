import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { resolveActor } from '@/lib/api/dualAuth';
import { bumpAccountBalance } from '@/lib/accounting/balances';
import { writeAuditLog, getPeriodKey, getFiscalYear, getFyStartMonth } from '@/lib/accounting/premium';

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await resolveActor(req);
  if (!ctx) return fail('Unauthorized', 401);

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
          orderBy: { lineNo: 'asc' },
        },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        reversedBy: { select: { id: true, entryNo: true } },
      },
    });

    if (!entry) {
      return fail('Journal entry not found', 404);
    }

    return ok(entry);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await resolveActor(req);
  if (!ctx) return fail('Unauthorized', 401);

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { action } = body;

    // Approval / Rejection / Reversal / Post Draft require superadmin or developer
    const needsSuper = ['approve', 'reject', 'reverse'].includes(action);
    if (needsSuper && !['superadmin', 'developer'].includes(ctx.role)) {
      return fail('Forbidden', 403);
    }

    if (action === 'approve') {
      const entry = await prisma.journalEntry.findFirst({
        where: { id, tenantId: ctx.tenantId, status: 'pending_approval' },
        include: { lines: true },
      });
      if (!entry) return fail('Journal entry not found or not pending approval', 404);

      const entryNo = await assignNextEntryNo(ctx.tenantId, entry.entryDate);
      await prisma.$transaction(async (tx) => {
        await tx.journalEntry.update({
          where: { id },
          data: { status: 'posted', entryNo, approvedById: ctx.userId, approvedAt: new Date() },
        });
        for (const line of entry.lines) {
          await bumpAccountBalance(tx as any, line.accountId, entry.entryDate, line.debit, line.credit);
        }
        await tx.accountingApproval.updateMany({
          where: { entityId: id, status: 'pending' },
          data: { status: 'approved', approvedById: ctx.userId, reviewedAt: new Date() },
        });
        await tx.accountingAuditLog.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            action: 'approve',
            entityType: 'journal_entry',
            entityId: id,
            after: JSON.stringify({ entryNo }),
          },
        });
      });

      return ok({ success: true, entryNo });
    }

    if (action === 'reject') {
      const { note } = body;
      await prisma.journalEntry.update({
        where: { id, tenantId: ctx.tenantId },
        data: { status: 'rejected' },
      });
      await prisma.accountingApproval.updateMany({
        where: { entityId: id, status: 'pending' },
        data: { status: 'rejected', approvedById: ctx.userId, reviewNote: note || '', reviewedAt: new Date() },
      });
      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'reject',
        entityType: 'journal_entry',
        entityId: id,
        reason: note || '',
      });

      return ok({ success: true });
    }

    if (action === 'reverse') {
      const { reason } = body;
      if (!reason) return fail('Reversal reason is mandatory', 400);

      const original = await prisma.journalEntry.findFirst({
        where: { id, tenantId: ctx.tenantId, status: 'posted' },
        include: { lines: true },
      });
      if (!original) return fail('Original journal entry not found or not posted', 404);

      const entryDate = new Date();
      const entryNo = await assignNextEntryNo(ctx.tenantId, entryDate);
      const periodKey = getPeriodKey(entryDate);
      const period = await prisma.accountingPeriod.findUnique({
        where: { tenantId_periodKey: { tenantId: ctx.tenantId, periodKey } },
      });
      if (period && ['locked', 'closed'].includes(period.status) && ctx.role !== 'developer') {
        return fail('period_locked', 400);
      }

      const reversal = await prisma.$transaction(async (tx) => {
        const rev = await tx.journalEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryNo,
            entryDate,
            narration: `Reversal of ${original.entryNo ?? id}: ${reason}`,
            status: 'posted',
            sourceType: 'reversal',
            sourceId: original.id,
            dedupKey: `reversal:${original.id}`,
            totalDebit: original.totalCredit,
            totalCredit: original.totalDebit,
            createdById: ctx.userId,
            approvedById: ctx.userId,
            approvedAt: new Date(),
            lines: {
              create: original.lines.map(l => ({
                accountId: l.accountId,
                debit: l.credit,
                credit: l.debit,
                description: l.description,
                lineNo: l.lineNo,
              })),
            },
          },
          include: { lines: true },
        });

        await tx.journalEntry.update({
          where: { id },
          data: { status: 'reversed', reversedById: rev.id },
        });

        for (const line of rev.lines) {
          await bumpAccountBalance(tx as any, line.accountId, entryDate, line.debit, line.credit);
        }

        await tx.accountingAuditLog.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            action: 'reverse',
            entityType: 'journal_entry',
            entityId: id,
            after: JSON.stringify({ reversalId: rev.id, reason }),
          },
        });

        return rev;
      });

      return ok({ success: true, reversalId: reversal.id, entryNo });
    }

    if (action === 'post_draft') {
      const draft = await prisma.journalEntry.findFirst({
        where: { id, tenantId: ctx.tenantId, status: 'draft' },
        include: { lines: true },
      });
      if (!draft) return fail('Draft journal entry not found', 404);

      const totalDr = draft.lines.reduce((s, l) => s + Number(l.debit), 0);
      const totalCr = draft.lines.reduce((s, l) => s + Number(l.credit), 0);
      if (Math.abs(totalDr - totalCr) > 0.01) return fail('not_balanced', 400);
      if (totalDr === 0) return fail('empty_entry', 400);

      const periodKey = getPeriodKey(draft.entryDate);
      const period = await prisma.accountingPeriod.findUnique({
        where: { tenantId_periodKey: { tenantId: ctx.tenantId, periodKey } },
      });
      if (period && ['locked', 'closed'].includes(period.status) && ctx.role !== 'developer') {
        return fail('period_locked', 400);
      }

      const settings = await prisma.accountingSettings.findUnique({
        where: { tenantId: ctx.tenantId },
      });
      const cap = ctx.role === 'admin' ? Number(settings?.adminJeCap ?? 50000) : Infinity;

      if (totalDr > cap) {
        await prisma.journalEntry.update({
          where: { id },
          data: { status: 'pending_approval' },
        });
        await prisma.accountingApproval.create({
          data: {
            tenantId: ctx.tenantId,
            entityType: 'journal_entry',
            entityId: id,
            amount: totalDr,
            level: 1,
            approverRole: 'superadmin',
            requestedById: ctx.userId,
          },
        });
        return ok({ success: true, status: 'pending_approval', entryId: id });
      }

      const entryNo = await assignNextEntryNo(ctx.tenantId, draft.entryDate);
      await prisma.$transaction(async (tx) => {
        await tx.journalEntry.update({
          where: { id },
          data: { status: 'posted', entryNo, approvedById: ctx.userId, approvedAt: new Date() },
        });
        for (const line of draft.lines) {
          await bumpAccountBalance(tx as any, line.accountId, draft.entryDate, Number(line.debit), Number(line.credit));
        }
        await tx.accountingAuditLog.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            action: 'post',
            entityType: 'journal_entry',
            entityId: id,
            after: JSON.stringify({ entryNo, totalDebit: totalDr }),
          },
        });
      });

      return ok({ success: true, status: 'posted', entryNo });
    }

    if (action === 'delete_draft') {
      const draft = await prisma.journalEntry.findFirst({
        where: { id, tenantId: ctx.tenantId, status: 'draft' },
      });
      if (!draft) return fail('Draft journal entry not found', 404);

      await prisma.journalLine.deleteMany({ where: { entryId: id } });
      await prisma.journalEntry.delete({ where: { id } });
      await writeAuditLog({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'delete',
        entityType: 'journal_entry',
        entityId: id,
        reason: 'Deleted draft entry',
      });

      return ok({ success: true });
    }

    return fail('Invalid action', 400);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
