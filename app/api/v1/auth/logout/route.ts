import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/v1-envelope';

/**
 * Stateless JWT — the client clears its token. Server-side blocklist could
 * be added later if revocation matters.
 */
export async function POST(_req: NextRequest) {
  return ok({ ok: true });
}
