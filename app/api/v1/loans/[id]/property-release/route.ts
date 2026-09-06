import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { writeAudit } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id: loanId } = await params;

  // PPF-067 / ROLE-4 — handing back a title deed is not a field-agent act. The
  // route previously required only that SOME token authenticated.
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    // The loan must be in the caller's full scope, not merely exist (X-2/X-12):
    // out of scope reads as not-found rather than confirming it lives elsewhere.
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
      },
    });
    if (!loan) return fail('Loan not found', 404);

    // PPF-066 — a deed is handed back when the debt is gone, not while it is
    // outstanding. The route used to read the loan only to confirm existence.
    if (loan.status !== 'closed') {
      return fail('The mortgage cannot be released while the loan is outstanding', 409);
    }

    const pc = await prisma.propertyCollateral.findUnique({
      where: { loanId: loan.id }
    });
    if (!pc) return fail('Property collateral not found for this loan', 404);

    // PPF-065/069 — a second release re-stamped releasedAt/releasedBy, so the
    // record of who actually handed back the deed was overwritten by whoever
    // clicked last. The first release is the one that happened.
    if (pc.mortgageStatus === 'released') {
      return fail('This mortgage has already been released', 409);
    }

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
