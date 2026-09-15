/**
 * Mirror of `signVerifyToken` in lib/auth/emailVerification.ts.
 *
 * We cannot import that module here: it pulls in lib/notify/channels/email →
 * lib/tenant → lib/auth, which drags next-auth's server entry into a plain node
 * process. So the signer is replicated, and the *verifier* under test is the
 * real one — if the token format ever drifts, ML-021 fails loudly rather than
 * silently passing, which is exactly the failure mode we want.
 */
import { createHmac } from 'node:crypto';
import { loadE2eEnv } from './env';

const TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  loadE2eEnv();
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET / AUTH_SECRET is required to sign a verification token.');
  return s;
}

export function signVerifyToken(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + TTL_MS })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}
