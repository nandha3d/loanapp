import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getSetting, setSetting } from '@/lib/tenant';
import { getTenantRazorpayConfigMasked, saveTenantRazorpayConfig } from '@/lib/tenantRazorpay';

/**
 * GET /api/v1/settings/payment-gateway — masked gateway config (never raw secrets).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);

  try {
    const [masked, upiId] = await Promise.all([
      getTenantRazorpayConfigMasked(ctx.tenantId),
      getSetting(ctx.tenantId, 'upi_id', ''),
    ]);
    return ok({ ...masked, upiId });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load gateway', 500);
  }
}

/**
 * POST /api/v1/settings/payment-gateway — save Tier-0 UPI + Tier-1 Razorpay keys.
 * Secrets are encrypted server-side (never stored raw). Blank secret = keep.
 * Body: { upiId?, enabled, keyId, keySecret?, webhookSecret? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!['admin', 'superadmin', 'developer'].includes(ctx.role)) return fail('Forbidden', 403);

  try {
    const body = await req.json();
    const enabled = Boolean(body.enabled);
    const keyId = String(body.keyId || '').trim();
    if (enabled && !keyId) return fail('Key ID is required to enable the gateway', 400);

    if (typeof body.upiId === 'string') {
      await setSetting(ctx.tenantId, 'upi_id', body.upiId.trim(), 'payments');
    }
    await saveTenantRazorpayConfig(ctx.tenantId, {
      enabled,
      keyId,
      keySecret: body.keySecret ? String(body.keySecret) : undefined,
      webhookSecret: body.webhookSecret ? String(body.webhookSecret) : undefined,
    });

    const masked = await getTenantRazorpayConfigMasked(ctx.tenantId);
    return ok(masked);
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to save gateway', 500);
  }
}
