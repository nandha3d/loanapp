import { NextRequest } from 'next/server';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { fail, ok } from '@/lib/api/v1-envelope';
import { disableTwoFactor, twoFactorStatus, TwoFactorError } from '@/lib/twoFactor';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await twoFactorStatus(auth.context));
  } catch (error) {
    return fail(error instanceof TwoFactorError ? error.message : '2FA status failed',
      error instanceof TwoFactorError ? error.status : 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  try {
    return ok(await disableTwoFactor(auth.context));
  } catch (error) {
    return fail(error instanceof TwoFactorError ? error.message : '2FA disable failed',
      error instanceof TwoFactorError ? error.status : 500);
  }
}
