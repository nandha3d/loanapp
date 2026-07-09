import { NextRequest } from 'next/server';
import { fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

const RETIRED_CLOSE_MESSAGE =
  'Legacy auction close is retired. Use bids plus confirm/draw, then security approval and payout release.';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  return fail(RETIRED_CLOSE_MESSAGE, 410);
}
