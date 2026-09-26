import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { startTwoFactorSetup, TwoFactorError } from '@/lib/twoFactor';

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await startTwoFactorSetup(auth.context));
  } catch (error) {
    return fail(error instanceof TwoFactorError ? error.message : '2FA setup failed',
      error instanceof TwoFactorError ? error.status : 500);
  }
}
