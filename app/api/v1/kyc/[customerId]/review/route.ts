import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

/**
 * POST /api/v1/kyc/[customerId]/review — verify or reject a customer's KYC
 * (admin only). Sets the canonical kycStatus + verifier metadata; rejection
 * requires a reason. Mirrors the web's manual KYC decision.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }
  const { customerId } = await params;

  try {
    const body = (await req.json()) as { decision?: string; reason?: string };
    const decision = String(body.decision || '');
    if (decision !== 'verified' && decision !== 'rejected') {
      return fail("decision must be 'verified' or 'rejected'", 400);
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (decision === 'rejected' && !reason) {
      return fail('A reason is required to reject KYC', 400);
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
      },
      select: { id: true },
    });
    if (!customer) return fail('Customer not found', 404);

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        kycStatus: decision,
        kycVerifiedAt: decision === 'verified' ? new Date() : null,
        kycVerifiedById: ctx.userId,
        kycRejectedReason: decision === 'rejected' ? reason : null,
      },
      select: { id: true, kycStatus: true },
    });

    await prisma.auditLog
      .create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: decision === 'verified' ? 'kyc_verify' : 'kyc_reject',
          entityType: 'customer',
          entityId: customerId,
          newValue: JSON.stringify({ kycStatus: decision, reason: reason || undefined }),
        },
      })
      .catch(() => {});

    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? 'KYC review failed', 500);
  }
}
