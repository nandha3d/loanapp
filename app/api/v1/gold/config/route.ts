import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getGoldConfig } from '@/lib/gold/settings';

// Gold/Silver pledge config (rates, interest %, scheme, processing fee, field
// visibility) — all from per-tenant AppSetting, never hardcoded. Read by the
// web + mobile pledge forms so both stay in sync.
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const config = await getGoldConfig(auth.context.tenantId);
  return ok(config);
}
