import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { sendEmail } from '@/lib/notify/channels/email';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { getSetting } from '@/lib/tenant';

function timeBucket() {
  return Math.floor(Date.now() / 1000 / 600);
}

function generateOtp(email: string, bucket: number): string {
  const secret = process.env.NEXTAUTH_SECRET ?? 'fallback-secret';
  const raw = createHmac('sha256', secret)
    .update(`${email.toLowerCase()}:${bucket}`)
    .digest('hex');
  return String(parseInt(raw.substring(0, 8), 16) % 1_000_000).padStart(6, '0');
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const email = body?.email?.trim().toLowerCase();
    if (!email) return fail('email is required', 400);

    // Rate limiting — 5 req/email/10min and 20 req/IP/10min.
    // Return a success-shaped response on limit hit so attackers get no
    // signal (preserves the anti-enumeration property of this route).
    const windowMs = 10 * 60 * 1000;
    const ip = getClientIp(req);
    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit(`fpw:email:${email}`, { limit: 5, windowMs }),
      checkRateLimit(`fpw:ip:${ip}`, { limit: 20, windowMs }),
    ]);
    if (!emailLimit.allowed || !ipLimit.allowed) {
      return ok({ sent: true });
    }

    const user = await prisma.user.findFirst({
      where: { email, status: 'active' },
      select: { id: true, tenantId: true, name: true },
    });

    if (user) {
      const otp = generateOtp(email, timeBucket());
      const brandName = await getSetting(user.tenantId, 'app_name', 'LoanTrack');
      await sendEmail(
        user.tenantId,
        email,
        `Your ${brandName} password reset code`,
        `<p>Hi ${user.name ?? ''},</p>
         <p>Your password reset code is: <strong style="font-size:24px;letter-spacing:4px">${otp}</strong></p>
         <p>This code expires in 10 minutes.</p>
         <p>If you did not request this, ignore this email.</p>`,
        { event: 'password_reset' },
        { system: true },
      );
    }

    // Always return success to prevent email enumeration
    return ok({ sent: true });
  } catch (e: any) {
    return fail(e?.message ?? 'Request failed', 500);
  }
}
