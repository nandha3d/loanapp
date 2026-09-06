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

  // PPF-143 / ROLE-4 — seizing an asset is not a field-agent act. The route
  // previously required only that SOME token authenticated.
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    // Full scope, not mere existence (X-2/X-12).
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
      },
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
    // PPF-142 — this used to coerce anything that was not the literal
    // "repossessed" to "active", so a single misspelling ("reposessed") quietly
    // released an asset the office was holding. An unrecognised status is now
    // refused instead of silently inverting the operator's intent.
    const REPOSSESSION_STATUSES = ['repossessed', 'active'] as const;
    const status = body.status === undefined ? 'repossessed' : String(body.status);
    if (!(REPOSSESSION_STATUSES as readonly string[]).includes(status)) {
      return fail(
        `Invalid status "${status}" — expected one of ${REPOSSESSION_STATUSES.join(', ')}`,
        400,
      );
    }
    const reason = body.reason || '';

    await prisma.productFinanceItem.update({
      where: { id: pi.id },
      data: {
        repossessionStatus: status,
        repossessedAt: status === 'repossessed' ? new Date() : null,
        // PPF-141 — the reason belongs on the record a recovery clerk reads,
        // not only in the audit log.
        repossessionReason: status === 'repossessed' ? (reason || null) : null,
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
