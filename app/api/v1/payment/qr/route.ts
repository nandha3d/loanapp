import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * GET /api/v1/payment/qr
 * Returns admin-configured UPI ID + uploaded QR image path.
 * Any authenticated user (agents need it for collection).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  try {
    const rows = await prisma.appSetting.findMany({
      where: {
        tenantId: ctx.tenantId,
        key: { in: ['upi_id', 'upi_qr_url'] },
      },
      select: { key: true, value: true },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return ok({
      upiId: map['upi_id'] ?? null,
      qrUrl: map['upi_qr_url'] ?? null,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'QR fetch failed', 500);
  }
}
