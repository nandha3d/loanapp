import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { verifyTwoFactorSetup, TwoFactorError } from '@/lib/twoFactor';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.setupToken !== 'string' || typeof body.code !== 'string') {
    return fail('setupToken and code required', 400);
  }
  try {
    return ok(await verifyTwoFactorSetup(auth.context, body.setupToken, body.code));
  } catch (error) {
    return fail(error instanceof TwoFactorError ? error.message : '2FA verification failed',
      error instanceof TwoFactorError ? error.status : 500);
  }
}
