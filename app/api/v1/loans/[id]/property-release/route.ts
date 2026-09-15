import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { writeAudit } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id: loanId } = await params;

  try {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, tenantId: ctx.tenantId }
    });
    if (!loan) return fail('Loan not found', 404);

    const pc = await prisma.propertyCollateral.findUnique({
      where: { loanId: loan.id }
    });
    if (!pc) return fail('Property collateral not found for this loan', 404);

    await prisma.propertyCollateral.update({
      where: { id: pc.id },
      data: {
        mortgageStatus: 'released',
        releasedAt: new Date(),
        releasedBy: ctx.userId,
      }
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'property_release',
      entityType: 'loan',
      entityId: loan.id,
      newValue: { status: 'released' }
    });

    return ok({ success: true, status: 'released' });
  } catch (e: any) {
    console.error('[PROPERTY_RELEASE_API]', e);
    return fail(e?.message ?? 'Property release failed', 500);
  }
}
