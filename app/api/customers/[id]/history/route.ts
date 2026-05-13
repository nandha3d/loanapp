import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { calculateCreditScore } from '@/lib/creditScore';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const loans = await prisma.loan.findMany({
      where: { customerId: id },
      include: {
        instalments: true,
        penalties: true,
      },
      orderBy: { createdAt: 'desc' }
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
      profile: creditProfile
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
