import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext, scopedBranchWhere } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET() {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;
    const { context } = authResult;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const loanWhere = { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) };
    const customerWhere = { tenantId: context.tenantId, appType: context.appType, ...scopedBranchWhere(context) };

    const [
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayInstalments,
      pendingPenalties,
      activeAgents,
      recentLoans,
    ] = await Promise.all([
      prisma.loan.count({ where: { ...loanWhere, status: 'active' } }),
      prisma.loan.count({ where: { ...loanWhere, status: 'overdue' } }),
      prisma.customer.count({ where: { ...customerWhere, status: { not: 'blacklisted' } } }),
      prisma.instalment.findMany({
        where: { loan: loanWhere, dueDate: { gte: today, lt: tomorrow } },
        include: { loan: { include: { customer: true } } },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.penalty.count({ where: { loan: loanWhere, status: 'pending' } }),
      prisma.user.count({ where: { tenantId: context.tenantId, appType: context.appType, role: 'agent', status: 'active', ...scopedBranchWhere(context) } }),
      prisma.loan.findMany({
        where: loanWhere,
        include: { customer: { select: { id: true, customerCode: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const todayExpected = todayInstalments.reduce((sum, item) => sum + Number(item.dueAmount), 0);
    const todayCollected = todayInstalments
      .filter((item) => item.status === 'paid' || item.status === 'partial')
      .reduce((sum, item) => sum + Number(item.receivedAmount), 0);

    return apiSuccess({
      activeLoans,
      overdueLoans,
      totalCustomers,
      todayExpected,
      todayCollected,
      pendingPenalties,
      activeAgents,
      recentLoans,
      todayInstalments,
    });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
