import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { ok } from '@/lib/api/v1-envelope';
import { TEMPLATE_PLACEHOLDER_KEYS } from '@/lib/notify/templateRenderer';

/** NOT-04: the placeholder tokens the web template editor lists. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  return ok(TEMPLATE_PLACEHOLDER_KEYS);
}
