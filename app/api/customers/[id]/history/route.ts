import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiContext, isApiError } from '@/lib/apiAuth';
import { calculateCreditScore } from '@/lib/creditScore';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiContext();
  if (isApiError(authResult)) return authResult.response;
  const { context } = authResult;

  const { id } = await params;

  try {
    const loans = await prisma.loan.findMany({
      where: { customerId: id, tenantId: context.tenantId, appType: context.appType },
      include: {
        instalments: true,
        penalties: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const creditProfile = calculateCreditScore(loans);

    return NextResponse.json({
      loans: loans.map(l => ({
        id: l.id,
        loanCode: l.loanCode,
        principal: l.principal.toString(),
        status: l.status,
        createdAt: l.createdAt,
      })),
      profile: creditProfile,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
