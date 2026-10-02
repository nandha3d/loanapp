import { NextRequest } from 'next/server';
import { fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

/**
 * Retired. Add-ons are bundled into subscription plans (lib/planFeatures.ts), so
 * there is nothing left to buy or confirm and no charge is ever created here.
 * The route stays so older mobile builds get a clear message instead of a 404.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  return fail('Add-ons are now included in subscription plans. Upgrade your plan to unlock this feature.', 410);
}
