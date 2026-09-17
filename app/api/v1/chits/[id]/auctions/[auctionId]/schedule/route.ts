import { NextRequest } from 'next/server';
import { fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

const RETIRED_MESSAGE = 'Auction rescheduling via this route is retired. No mobile caller uses it; reschedule from the staff web dashboard.';

export async function PATCH(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  return fail(RETIRED_MESSAGE, 410);
}

export const POST = PATCH;
