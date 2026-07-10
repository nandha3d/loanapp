import { NextRequest } from 'next/server';
import { fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';

const RETIRED_MESSAGE =
  'Legacy period-based join is retired. Use the room/attendance routes on the canonical auction-ID room.';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;

  return fail(RETIRED_MESSAGE, 410);
}
