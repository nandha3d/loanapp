import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { calculateCreditScore } from '@/lib/creditScore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  try {
    const loans = await prisma.loan.findMany({
      where: {
        customerId: id,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
      },
      include: { instalments: true, penalties: true },
      orderBy: { createdAt: 'desc' },
    });
    const profile = calculateCreditScore(loans);
    return ok({
      loans: loans.map((l) => ({
        id: l.id,
        loanCode: l.loanCode,
        principal: l.principal.toString(),
        status: l.status,
        createdAt: l.createdAt,
      })),
      profile,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Loan history failed', 500);
  }
}
