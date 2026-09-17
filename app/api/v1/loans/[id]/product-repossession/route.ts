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

    const pi = await prisma.productFinanceItem.findUnique({
      where: { loanId: loan.id }
    });
    if (!pi) return fail('Product item not found for this loan', 404);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // tolerate empty body
    }
    const status = body.status === 'repossessed' ? 'repossessed' : 'active';
    const reason = body.reason || '';

    await prisma.productFinanceItem.update({
      where: { id: pi.id },
      data: {
        repossessionStatus: status,
        repossessedAt: status === 'repossessed' ? new Date() : null,
      }
    });

    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: status === 'repossessed' ? 'product_repossession' : 'product_activate',
      entityType: 'loan',
      entityId: loan.id,
      newValue: { status, reason }
    });

    return ok({ success: true, status });
  } catch (e: any) {
    console.error('[PRODUCT_REPOSSESSION_API]', e);
    return fail(e?.message ?? 'Product repossession failed', 500);
  }
}
