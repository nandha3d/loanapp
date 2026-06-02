import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { issueMobileToken, rotateRefreshToken } from '@/lib/api/v1-auth';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { refreshToken?: string } | null;
    if (!body?.refreshToken) return fail('refreshToken is required', 400);

    const result = await rotateRefreshToken(body.refreshToken);
    if (!result) return fail('Invalid or expired refresh token', 401);

    const accessToken = await issueMobileToken(result.claims);
    return ok({ token: accessToken, refreshToken: result.newRefreshToken });
  } catch (e: any) {
    return fail(e?.message ?? 'Token refresh failed', 500);
  }
}
