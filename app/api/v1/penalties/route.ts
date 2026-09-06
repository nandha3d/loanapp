import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  // §7.2 — penalties are not an agent capability, and ROLE-4 requires the
  // handler to refuse it rather than relying on the proxy redirect.
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const where: any = {
    loan: {
      tenantId: ctx.tenantId,
      appType: ctx.appType,
      ...scopedBranchWhere(ctx),
    },
  };
  const status = searchParams.get('status');
  if (status) where.status = status;

  try {
    const penalties = await prisma.penalty.findMany({
      where,
      include: {
        loan: {
          select: {
            id: true,
            loanCode: true,
            customer: { select: { id: true, customerCode: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(penalties);
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
      where: { id: loanId, tenantId: ctx.tenantId },
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

