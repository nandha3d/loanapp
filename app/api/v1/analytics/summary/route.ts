import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  // §7.2 / ROLE-4 — analytics is not an agent capability, and the handler must
  // refuse it server-side rather than relying on the proxy redirect.
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const loanBase: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  const { from, to } = monthRange();

  try {
    const [activeLoans, overdueLoans, closedLoans, instalments] =
      await Promise.all([
        prisma.loan.count({ where: { ...loanBase, status: 'active' } }),
        prisma.loan.count({ where: { ...loanBase, status: 'overdue' } }),
        prisma.loan.count({ where: { ...loanBase, status: 'closed' } }),
        prisma.instalment.findMany({
          where: { loan: loanBase, dueDate: { gte: from, lte: to } },
          select: { dueAmount: true, receivedAmount: true, status: true },
        }),
      ]);

    const expected = instalments.reduce(
      (s, i) => s + Number(i.dueAmount),
      0,
    );
    const collected = instalments
      .filter((i) => i.status === 'paid' || i.status === 'partial')
      .reduce((s, i) => s + Number(i.receivedAmount), 0);
    const onTime = instalments.filter((i) => i.status === 'paid').length;
    const total = instalments.length || 1;

    return ok({
      activeLoans,
      overdueLoans,
      closedLoans,
      monthExpected: expected,
      monthCollected: collected,
      efficiency: expected > 0
        ? Math.round((collected / expected) * 1000) / 10
        : 0,
      onTimeRatio: Math.round((onTime / total) * 100),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Analytics failed', 500);
  }
}
