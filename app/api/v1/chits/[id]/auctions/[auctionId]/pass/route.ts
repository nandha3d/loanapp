import { NextRequest } from 'next/server';
import { fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

const RETIRED_MESSAGE =
  'Legacy period-based pass is retired. There is no replacement on the canonical auction-ID room yet — simply do not bid this round.';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  return fail(RETIRED_MESSAGE, 410);
}
