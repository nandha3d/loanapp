import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const loans = await prisma.loan.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
        status: { in: ['active', 'overdue'] },
      },
      include: {
        customer: { select: { id: true, customerCode: true, name: true, phone: true } },
        instalments: {
          where: {
            status: { in: ['missed', 'upcoming', 'partial'] },
            dueDate: { lt: new Date() },
          },
          select: { id: true, dueDate: true, dueAmount: true, receivedAmount: true },
        },
      },
    });

    const items = loans
      .map((l) => {
        const overdueAmount = l.instalments.reduce(
          (s, i) => s + (Number(i.dueAmount) - Number(i.receivedAmount)),
          0,
        );
        const overdueDays = l.instalments.length > 0
          ? Math.floor(
              (Date.now() - new Date(l.instalments[0].dueDate).getTime()) /
                86400000,
            )
          : 0;
        return {
          loanId: l.id,
          loanCode: l.loanCode,
          customer: l.customer,
          overdueAmount,
          overdueDays,
          missedCount: l.instalments.length,
        };
      })
      .filter((i) => i.overdueAmount > 0)
      .sort((a, b) => b.overdueDays - a.overdueDays);

    return ok(items);
  } catch (e: any) {
    return fail(e?.message ?? 'Report failed', 500);
  }
}
