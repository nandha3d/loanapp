import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { PremiumAccountingServiceError } from '@/lib/accounting/premiumMobileService';
import { getVendorAgeing } from '@/lib/accounting/vendors';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await getVendorAgeing(auth.context));
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Ageing failed',
      error instanceof PremiumAccountingServiceError ? error.status : 500);
  }
}
