import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiContext, ADMIN_API_ROLES } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';

export async function GET(req: Request) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if ('response' in authResult && authResult.response) return authResult.response;
    const context = 'context' in authResult ? authResult.context : (authResult as any);

    const { tenantId, appType } = context;

    const [branches, agents, loans, payments] = await Promise.all([
      prisma.branch.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { tenantId, appType, role: 'agent', status: 'active' },
        select: { id: true, name: true },
      }),
      prisma.loan.findMany({
        where: { tenantId, appType },
        select: { loanType: true, status: true, frequency: true },
      }),
      prisma.payment.findMany({
        where: { tenantId },
        select: { paymentMode: true },
      }),
    ]);

    const loanTypes = Array.from(new Set(loans.map(l => l.loanType).filter(Boolean)));
    const statuses = Array.from(new Set(loans.map(l => l.status).filter(Boolean)));
    const frequencies = Array.from(new Set(loans.map(l => l.frequency).filter(Boolean)));
    const paymentModes = Array.from(new Set(payments.map(p => p.paymentMode).filter(Boolean)));

    return apiSuccess({
      branches,
      agents,
      loanTypes,
      statuses,
      frequencies,
      paymentModes,
    });
  } catch (error: any) {
    return apiError(error.message, 500);
  }
}
