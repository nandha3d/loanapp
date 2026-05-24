import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail, parseCursorPaging } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { getAgentRouteIds } from '@/lib/access';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  const status = searchParams.get('status');
  // PAGE-02: cursor pagination.
  const { cursor, limit } = parseCursorPaging(req.url, { defaultLimit: 20, maxLimit: 100 });

  const where: any = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;

  if (ctx.role === 'agent') {
    const routeIds = await getAgentRouteIds(ctx.userId);
    if (routeIds.length === 0) return ok([], { nextCursor: null, limit });
    where.customer = { routeId: { in: routeIds } };
  }

  try {
    const rows = await prisma.loan.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, customerCode: true, phone: true } },
        instalments: {
          where: { status: { in: ['upcoming', 'partial', 'missed'] } },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]!.id : null;
    return ok(data, { nextCursor, limit });
  } catch (e: any) {
    return fail(e?.message ?? 'Loans list failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (!['admin', 'superadmin', 'developer', 'agent'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const customerId = String(body.customerId || '');
    const principal = Number(body.principal);
    const rate = Number(body.deduction ?? body.interestRate ?? 0);
    const deductionType = String(
      body.deductionType ?? body.interestType ?? 'upfront_fixed',
    );
    const tenure = Number(body.tenure);
    const frequency = String(body.frequency || 'daily');
    const startDateStr = body.startDate || new Date().toISOString();
    const startDate = new Date(startDateStr);
    const penaltyRate = Number(body.penaltyRate ?? 0);
    const loanType = String(body.loanType || 'cheque');
    const collateralDetails: string | null = body.collateralDetails ?? null;
    const voucherRef: string | null = body.voucherRef ?? null;
    const dueDay = body.dueDay != null ? Number(body.dueDay) : null;
    const guarantorInput = body.guarantor as
      | {
          name?: string;
          phone?: string;
          aadharNumber?: string;
          address?: string;
          relation?: string;
          photoUrl?: string;
        }
      | undefined;
    const cheques = Array.isArray(body.securityCheques)
      ? (body.securityCheques as Array<{
          bankName?: string;
          chequeNumber?: string;
          amount?: number;
          imageUrl?: string;
        }>)
      : [];

    if (!customerId || !principal || !tenure) {
      return fail('customerId, principal, tenure required', 400);
    }
    if (Number.isNaN(startDate.getTime())) {
      return fail('Invalid start date', 400);
    }
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: ctx.tenantId, appType: ctx.appType },
    });
    if (!customer) return fail('Customer not found', 404);

    if (voucherRef) {
      const dup = await prisma.loan.findFirst({
        where: { tenantId: ctx.tenantId, voucherRef },
      });
      if (dup) return fail(`Voucher reference "${voucherRef}" already used`, 409);
    }

    const { calculateLoanPreview } = await import('@/lib/loanCalculator');
    const preview = calculateLoanPreview({
      principal,
      interestType: deductionType,
      interestRate: rate,
      tenure,
      frequency,
      startDate,
      dueDay,
    });

    const { calculateEndDate, generateCode } = await import('@/lib/utils');
    const { getBranding } = await import('@/lib/tenant');
    const branding = await getBranding(ctx.tenantId);
    const count = await prisma.loan.count({
      where: { tenantId: ctx.tenantId, appType: ctx.appType },
    });
    const loanCode = generateCode(branding.loanCodePrefix, count + 1, 5);
    const endDate = calculateEndDate(startDate, frequency, tenure);

    let guarantorId: string | null = null;
    if (guarantorInput?.name && guarantorInput?.phone) {
      const { encryptAadharNumber } = await import('@/lib/pii');
      const g = await prisma.guarantor.create({
        data: {
          customerId,
          name: guarantorInput.name,
          phone: guarantorInput.phone,
          aadharNumber: guarantorInput.aadharNumber
            ? encryptAadharNumber(guarantorInput.aadharNumber)
            : null,
          address: guarantorInput.address || null,
          relation: guarantorInput.relation || null,
          photo: guarantorInput.photoUrl || null,
        },
      });
      guarantorId = g.id;
    }

    const chequeData = cheques
      .filter((c) => c.bankName && c.chequeNumber)
      .map((c) => ({
        customerId,
        bankName: String(c.bankName),
        chequeNumber: String(c.chequeNumber),
        amount: c.amount != null ? Number(c.amount) : null,
        imagePath: c.imageUrl || null,
      }));

    const loan = await prisma.loan.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: ctx.branchId,
        appType: ctx.appType,
        loanCode,
        customerId,
        loanType,
        collateralDetails,
        guarantorId,
        principal,
        deduction: preview.deduction,
        deductionType,
        disbursed: preview.disbursedAmount,
        frequency,
        dueDay,
        tenure,
        startDate,
        endDate,
        perInstalment: preview.perInstalment,
        penaltyRate,
        voucherRef,
        totalPayable: preview.totalPayable,
        totalInstalments: tenure,
        createdById: ctx.userId,
        status: ctx.role === 'agent' ? 'pending_review' : 'active',
        instalments: {
          create: preview.schedule.map((i) => ({
            instalmentNo: i.instalmentNo,
            dueDate: new Date(i.dueDate),
            dueAmount: i.dueAmount,
            receivedAmount: 0,
            status: 'upcoming',
          })),
        },
        ...(chequeData.length > 0
          ? { securityCheques: { create: chequeData } }
          : {}),
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
    console.error('[/api/v1/loans POST]', e);
    return fail(e?.message ?? 'Loan create failed', 500);
  }
}
