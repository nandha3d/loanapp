import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';

/**
 * GET /api/v1/kyc/queue — customers awaiting KYC review (admin only).
 * Returns those whose KYC isn't yet verified/rejected, with a document count.
 */
const PENDING_KYC_STATUSES = [
  'pending',
  'otp_initiated',
  'video_submitted',
  'video_under_review',
] as const;

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) {
    return fail('Forbidden', 403);
  }

  try {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: ctx.tenantId,
        appType: ctx.appType,
        ...scopedBranchWhere(ctx),
        kycStatus: { in: [...PENDING_KYC_STATUSES] },
      },
      select: {
        id: true,
        customerCode: true,
        name: true,
        phone: true,
        kycStatus: true,
        kycMethod: true,
        aadhaarVerified: true,
        updatedAt: true,
        agent: { select: { name: true } },
        _count: { select: { kycDocuments: true } },
        kycSessions: {
          select: {
            id: true,
            method: true,
            status: true,
            responseData: true,
            createdAt: true,
            videoFilePath: true,
            videoFileName: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    return ok(customers);
  } catch (e: any) {
    return fail(e?.message ?? 'KYC queue failed', 500);
  }
}
