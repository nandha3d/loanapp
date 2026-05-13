import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

function range(searchParams: URLSearchParams) {
  const now = new Date();
  const from = new Date(searchParams.get('from') || new Date(now.getFullYear(), now.getMonth(), 1));
  const to = new Date(searchParams.get('to') || now);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export async function GET(request: Request) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'collection_efficiency';
    const { from, to } = range(searchParams);
    const loanBase: any = { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) };
    const routeId = searchParams.get('routeId');
    const agentId = searchParams.get('agentId');

    if (type === 'collection_efficiency') {
      const where: any = { loan: loanBase, dueDate: { gte: from, lte: to } };
      if (routeId) where.loan.customer = { routeId };
      if (agentId) where.agentId = agentId;
      const instalments = await prisma.instalment.findMany({ where, select: { dueAmount: true, receivedAmount: true, status: true } });
      const expected = instalments.reduce((sum, item) => sum + Number(item.dueAmount), 0);
      const collected = instalments
        .filter((item) => item.status === 'paid' || item.status === 'partial')
        .reduce((sum, item) => sum + Number(item.receivedAmount), 0);
      return apiSuccess({ expected, collected, efficiency: expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 0 });
    }

    if (type === 'penalty') {
      const data = await prisma.penalty.aggregate({
        where: { loan: loanBase, createdAt: { gte: from, lte: to } },
        _sum: { grossPenalty: true, settledAmount: true, waivedAmount: true },
        _count: true,
      });
      return apiSuccess({
        count: data._count,
        accrued: Number(data._sum.grossPenalty || 0),
        settled: Number(data._sum.settledAmount || 0),
        waived: Number(data._sum.waivedAmount || 0),
      });
    }

    if (type === 'disbursement') {
      const where: any = { ...loanBase, createdAt: { gte: from, lte: to } };
      if (routeId) where.customer = { routeId };
      const loans = await prisma.loan.findMany({ where, select: { id: true, loanCode: true, principal: true, disbursed: true, createdAt: true } });
      return apiSuccess({
        count: loans.length,
        totalPrincipal: loans.reduce((sum, loan) => sum + Number(loan.principal), 0),
        totalDisbursed: loans.reduce((sum, loan) => sum + Number(loan.disbursed), 0),
        loans,
      });
    }

    if (type === 'agent_performance') {
      const agents = await prisma.user.findMany({ where: { tenantId: context.tenantId, appType: context.appType, role: 'agent', status: 'active' } });
      const data = await Promise.all(agents.map(async (agent) => {
        const instalments = await prisma.instalment.findMany({
          where: { loan: { ...loanBase, customer: { agentId: agent.id } }, dueDate: { gte: from, lte: to } },
          select: { dueAmount: true, receivedAmount: true, status: true },
        });
        const expected = instalments.reduce((sum, item) => sum + Number(item.dueAmount), 0);
        const collected = instalments
          .filter((item) => item.status === 'paid' || item.status === 'partial')
          .reduce((sum, item) => sum + Number(item.receivedAmount), 0);
        return { id: agent.id, name: agent.name, expected, collected, hitRate: expected > 0 ? Math.round((collected / expected) * 100) : 0 };
      }));
      return apiSuccess(data);
    }

    if (type === 'aging') {
      const overdueLoans = await prisma.loan.findMany({
        where: { ...loanBase, status: { in: ['active', 'overdue'] }, ...(routeId ? { customer: { routeId } } : {}) },
        include: { customer: { select: { name: true } }, instalments: { where: { status: { in: ['missed', 'upcoming'] }, dueDate: { lt: new Date() } } }, penalties: { where: { status: 'pending' } } },
      });
      return apiSuccess(overdueLoans);
    }

    return apiError('Invalid report type', 400);
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
