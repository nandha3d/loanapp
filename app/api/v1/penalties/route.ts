import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { ensurePendingPenaltiesForMissedLoans, groupPenaltiesByLoan, penaltyListWhere, penaltyNet } from '@/lib/penalties';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const routeId = searchParams.get('routeId')?.trim();
  const q = searchParams.get('q')?.trim();
  const pageParam = searchParams.get('page');
  const page = pageParam === null ? null : Number(pageParam);
  if (page !== null && (!Number.isSafeInteger(page) || page < 1)) {
    return fail('Invalid page', 400);
  }
  const loanScope = {
    tenantId: ctx.tenantId,
    appType: ctx.appType,
    ...scopedBranchWhere(ctx),
  };
  const status = searchParams.get('status');
  const where = penaltyListWhere({
    ...loanScope,
    status,
    routeId,
    q,
  });

  try {
    await ensurePendingPenaltiesForMissedLoans({
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      branchId: ctx.branchId ?? undefined,
      routeId: routeId || undefined,
    });
    // DEC-03 (B): ?groupBy=loan — one row per loan with its own totals,
    // paged by loan so a loan's rows are never split across pages.
    if (searchParams.get('groupBy') === 'loan') {
      const [rows, agg] = await Promise.all([
        prisma.penalty.findMany({
          where,
          include: {
            loan: { select: { loanCode: true } },
            customer: { select: { id: true, customerCode: true, name: true, routeId: true, route: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.penalty.aggregate({
          where: { loan: loanScope },
          _sum: { grossPenalty: true, settledAmount: true, waivedAmount: true },
        }),
      ]);
      const groups = groupPenaltiesByLoan(rows);
      const pageNo = page ?? 1;
      return ok({
        rows: groups.slice((pageNo - 1) * 50, pageNo * 50),
        total: groups.length,
        page: pageNo,
        pages: Math.max(1, Math.ceil(groups.length / 50)),
        kpis: {
          totalGross: Number(agg._sum.grossPenalty || 0),
          totalSettled: Number(agg._sum.settledAmount || 0),
          totalWaived: Number(agg._sum.waivedAmount || 0),
          net: penaltyNet({
            grossPenalty: agg._sum.grossPenalty ?? 0,
            settledAmount: agg._sum.settledAmount ?? 0,
            waivedAmount: agg._sum.waivedAmount ?? 0,
          }),
        },
      });
    }
    const [penalties, total, aggregates] = await Promise.all([
      prisma.penalty.findMany({
      where,
      include: {
        loan: {
          select: {
            id: true,
            loanCode: true,
          },
        },
        customer: {
          select: {
            id: true, customerCode: true, name: true, routeId: true,
            route: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(page === null ? {} : { skip: (page - 1) * 50, take: 50 }),
      }),
      page === null ? Promise.resolve(0) : prisma.penalty.count({ where }),
      page === null ? Promise.resolve(null) : prisma.penalty.aggregate({
        where: { loan: loanScope },
        _sum: { grossPenalty: true, settledAmount: true, waivedAmount: true },
      }),
    ]);
    // DEC-03 (B): net per row and in the KPIs, so clients do not subtract.
    const rows = penalties.map((p) => ({ ...p, net: penaltyNet(p) }));
    if (page === null) return ok(rows);
    return ok({
      rows,
      total,
      page,
      pages: Math.ceil(total / 50),
      kpis: {
        totalGross: Number(aggregates?._sum.grossPenalty || 0),
        totalSettled: Number(aggregates?._sum.settledAmount || 0),
        totalWaived: Number(aggregates?._sum.waivedAmount || 0),
        net: penaltyNet({
          grossPenalty: aggregates?._sum.grossPenalty ?? 0,
          settledAmount: aggregates?._sum.settledAmount ?? 0,
          waivedAmount: aggregates?._sum.waivedAmount ?? 0,
        }),
      },
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Penalties failed', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role === 'agent') {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { loanId, grossPenalty, notes } = body;

    if (!loanId || !grossPenalty) {
      return fail('Missing loanId or grossPenalty', 400);
    }

    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
      },
    });
    if (!loan) return fail('Loan not found', 404);

    const penalty = await prisma.penalty.create({
      data: {
        loanId: loan.id,
        customerId: loan.customerId,
        grossPenalty: Number(grossPenalty),
        missedDays: Math.round(Number(grossPenalty) / 10),
        status: 'pending',
        notes: notes || null,
      },
    });

    return ok(penalty);
  } catch (e: any) {
    return fail(e?.message ?? 'Create penalty failed', 500);
  }
}

