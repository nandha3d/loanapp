import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/v1-envelope';
import { verifyMobileToken, revokeMobileToken } from '@/lib/api/v1-auth';

/**
 * Revokes the current access token and any active refresh tokens server-side.
 */
export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) {
      try {
        const claims = await verifyMobileToken(token);
        await revokeMobileToken(token, claims.userId);
      } catch {
        // Even if token verification fails, register revocation key
        await revokeMobileToken(token);
      }
    }
  }
  return ok({ ok: true });
}
