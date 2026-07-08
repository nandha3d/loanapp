import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { resolveGoldRate } from '@/lib/gold/liveRate';

// Effective ₹/gram for a purity — live provider rate when configured, else the
// tenant's manual AppSetting rate. Used to prefill the pledge form rate field.
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const purity = new URL(req.url).searchParams.get('purity') || '24K';
  const rate = await resolveGoldRate(auth.context.tenantId, purity);
  return ok(rate);
}
