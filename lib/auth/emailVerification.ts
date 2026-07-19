import { createHmac, timingSafeEqual } from 'crypto';
import { sendEmail, type EmailResult } from '@/lib/notify/channels/email';

// Stateless email-verification token: base64url(payload).hexSig.
// No DB column needed — the signature + expiry are self-contained. Activation
// is recorded by flipping the user's status from 'pending' to 'active'.

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function secret(): string {
  // No public-constant fallback: a known signing key makes activation tokens
  // forgeable by anyone.
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required for email verification tokens');
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signVerifyToken(userId: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ uid: userId, exp: now + TTL_MS }));
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyVerifyToken(token: string | null | undefined):
  | { ok: true; userId: string }
  | { ok: false; error: string } {
  if (!token || !token.includes('.')) return { ok: false, error: 'Invalid token' };
  const [payload, sig] = token.split('.', 2);
  const expected = createHmac('sha256', secret()).update(payload).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'Invalid token' };
  }
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof uid !== 'string' || typeof exp !== 'number') {
      return { ok: false, error: 'Invalid token' };
    }
    if (Date.now() > exp) return { ok: false, error: 'This link has expired' };
    return { ok: true, userId: uid };
  } catch {
    return { ok: false, error: 'Invalid token' };
  }
}

function appBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEB_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

export async function sendVerificationEmail(params: {
  tenantId: string;
  email: string;
  name?: string | null;
  userId: string;
}): Promise<EmailResult> {
  const token = signVerifyToken(params.userId);
  const link = `${appBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const { getSetting } = await import('@/lib/tenant');
  const brandName = await getSetting(params.tenantId, 'app_name', 'LoanTrack');
  return sendEmail(
    params.tenantId,
    params.email,
    `Verify your ${brandName} account`,
    `<p>Hi ${params.name ?? ''},</p>
     <p>Welcome to ${brandName}. Confirm your email to activate your account:</p>
     <p><a href="${link}" style="background:#F5A623;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Verify my account</a></p>
     <p>Or open this link:<br><a href="${link}">${link}</a></p>
     <p>This link expires in 24 hours. If you didn't sign up, ignore this email.</p>`,
    { event: 'email_verification' },
    { system: true },
  );
}
