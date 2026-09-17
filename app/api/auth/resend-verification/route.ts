import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendVerificationEmail } from '@/lib/auth/emailVerification';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';

// POST /api/auth/resend-verification  { email }
// Re-sends the account-activation email for a PENDING account. Always returns a
// generic success so the endpoint can't be used to enumerate registered emails.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const email = body?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 });
    }

    // 5 / email / 15min, 30 / IP / 15min.
    const windowMs = 15 * 60 * 1000;
    const ip = getClientIp(req);
    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit(routeKey('resend-verify:email', email), { limit: 5, windowMs }),
      checkRateLimit(routeKey('resend-verify:ip', ip), { limit: 30, windowMs }),
    ]);
    if (!emailLimit.allowed || !ipLimit.allowed) {
      // Generic success even on limit hit (no signal to attackers).
      return NextResponse.json({ success: true, message: genericMsg() });
    }

    const user = await prisma.user.findFirst({
      where: { email, status: 'pending' },
      select: { id: true, tenantId: true, name: true, email: true },
    });

    if (user?.email) {
      const res = await sendVerificationEmail({
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        userId: user.id,
      }).catch((e) => {
        console.error('[RESEND_VERIFY]', e);
        return { success: false as const, error: e?.message };
      });
      // In development with no SMTP, surface that it was logged to the console.
      if (!res.success) {
        console.error('[RESEND_VERIFY] not delivered:', res.error);
      }
    }

    return NextResponse.json({ success: true, message: genericMsg() });
  } catch (e: any) {
    console.error('[RESEND_VERIFY_ERROR]', e);
    // Still generic — never leak internals to this public endpoint.
    return NextResponse.json({ success: true, message: genericMsg() });
  }
}

function genericMsg(): string {
  return 'If an unverified account exists for that email, a new verification link has been sent.';
}
