import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiContext, ADMIN_API_ROLES } from '@/lib/apiAuth';

export async function GET(req: Request) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if ('response' in authResult && authResult.response) return authResult.response;
    const context = 'context' in authResult ? authResult.context : (authResult as any);

    const { searchParams } = new URL(req.url);
    const requestedAppType = searchParams.get('appType');
    const effectiveAppType = requestedAppType || context.appType;
    const { tenantId, branchId } = context;

    const [branches, agents, loans, payments, chitGroups, customers] = await Promise.all([
      prisma.branch.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { tenantId, appType: effectiveAppType, role: 'agent', status: 'active', ...(branchId ? { branchId } : {}) },
        select: { id: true, name: true },
      }),
      prisma.loan.findMany({
        where: { tenantId, appType: effectiveAppType, ...(branchId ? { branchId } : {}) },
        select: { loanType: true, status: true, frequency: true },
      }),
      prisma.payment.findMany({
        where: { tenantId },
        select: { paymentMode: true },
      }),
      effectiveAppType === 'chitfunds'
        ? prisma.chitGroup.findMany({
            where: { tenantId, appType: effectiveAppType, deletedAt: null, ...(branchId ? { branchId } : {}) },
            select: { id: true, name: true, groupCode: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      prisma.customer.findMany({
        where: { tenantId, appType: effectiveAppType, status: 'active', ...(branchId ? { branchId } : {}) },
        select: { id: true, name: true, customerCode: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
    ]);

    const loanTypes = Array.from(new Set(loans.map(l => l.loanType).filter(Boolean)));
    const statuses = Array.from(new Set(loans.map(l => l.status).filter(Boolean)));
    const frequencies = Array.from(new Set(loans.map(l => l.frequency).filter(Boolean)));
    const paymentModes = Array.from(new Set(payments.map(p => p.paymentMode).filter(Boolean)));

    return NextResponse.json({
      success: true,
      data: {
        branches,
        agents,
        loanTypes,
        statuses,
        frequencies,
        paymentModes,
        chitGroups: chitGroups.map((g) => ({ id: g.id, name: g.groupCode ? `${g.name} (${g.groupCode})` : g.name })),
        customers: customers.map((c) => ({ id: c.id, name: `${c.name} (${c.customerCode})` })),
      },
      error: null,
      pagination: null,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      data: null,
      error: error.message,
      pagination: null,
    }, { status: 500 });
  }
}
