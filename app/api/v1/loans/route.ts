import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  const status = searchParams.get('status');

  const where: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;

  if (ctx.role === 'agent') {
    const routeIds = await getAgentRouteIds(ctx.userId);
    if (routeIds.length === 0) return ok([]);
    where.customer = { routeId: { in: routeIds } };
  }

  try {
    const loans = await prisma.loan.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true, phone: true } },
        instalments: {
          where: { status: { in: ['upcoming', 'partial', 'missed'] } },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(loans);
  } catch (e: any) {
    return fail(e?.message ?? 'Loans list failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const customerId = String(body.customerId || '');
    const principal = Number(body.principal);
    const interestRate = Number(body.interestRate ?? 0);
    const interestType = String(body.interestType || 'upfront_fixed');
    const tenure = Number(body.tenure);
    const frequency = String(body.frequency || 'daily');
    const startDate = new Date(body.startDate || new Date());
    const penaltyRate = Number(body.penaltyRate ?? 0);

    if (!customerId || !principal || !tenure) {
      return fail('customerId, principal, tenure required', 400);
    }
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: ctx.tenantId, appType: ctx.appType },
    });
    if (!customer) return fail('Customer not found', 404);

    const { calculateLoanPreview } = await import('@/lib/loanCalculator');
    const preview = calculateLoanPreview({
      principal,
      interestType,
      interestRate,
      tenure,
      frequency,
      startDate: startDate.toISOString(),
      dueDay: body.dueDay ?? null,
    });

    const { generateCode } = await import('@/lib/utils');
    const { getBranding } = await import('@/lib/tenant');
    const branding = await getBranding(ctx.tenantId);
    const count = await prisma.loan.count({
      where: { tenantId: ctx.tenantId, appType: ctx.appType },
    });
    const loanCode = generateCode(branding.loanCodePrefix, count + 1, 5);

    const loan = await prisma.loan.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        appType: ctx.appType,
        loanCode,
        customerId,
        principal,
        disbursed: principal,
        interestType,
        interestRate,
        tenure,
        frequency,
        startDate,
        endDate: new Date(preview.endDate),
        perInstalment: preview.perInstalment,
        totalRepayable: preview.totalRepayable,
        penaltyRate,
        status: 'pending_review',
        instalments: {
          create: preview.instalments.map((i: any) => ({
            tenantId: ctx.tenantId,
            instalmentNo: i.instalmentNo,
            dueDate: new Date(i.dueDate),
            dueAmount: i.dueAmount,
            receivedAmount: 0,
            status: 'upcoming',
          })),
        },
      },
      include: { instalments: true, customer: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'loan',
        entityId: loan.id,
        newValue: JSON.stringify({ loanCode, principal, customerId }),
      },
    });

    return ok(loan);
  } catch (e: any) {
    return fail(e?.message ?? 'Loan create failed', 500);
  }
}
