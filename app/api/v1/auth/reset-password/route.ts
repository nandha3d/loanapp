import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { hash } from 'bcryptjs';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

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

function isValidOtp(email: string, otp: string): boolean {
  const bucket = timeBucket();
  // Accept current and previous bucket (handles boundary edge cases)
  return otp === generateOtp(email, bucket) || otp === generateOtp(email, bucket - 1);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      email?: string;
      otp?: string;
      newPassword?: string;
    } | null;

    const email = body?.email?.trim().toLowerCase();
    const otp = body?.otp?.trim();
    const newPassword = body?.newPassword;

    if (!email || !otp || !newPassword) {
      return fail('email, otp, and newPassword are required', 400);
    }

    // Brute-force guard on the 6-digit OTP: 3 attempts/email and 10/IP per 10 min.
    const windowMs = 10 * 60 * 1000;
    const ip = getClientIp(req);
    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit(`rpw:email:${email}`, { limit: 3, windowMs }),
      checkRateLimit(`rpw:ip:${ip}`, { limit: 10, windowMs }),
    ]);
    if (!emailLimit.allowed || !ipLimit.allowed) {
      return fail('Too many attempts. Try again later.', 429);
    }
    if (newPassword.length < 8) {
      return fail('Password must be at least 8 characters', 400);
    }
    if (!isValidOtp(email, otp)) {
      return fail('Invalid or expired code', 400);
    }

    const user = await prisma.user.findFirst({
      where: { email, status: 'active' },
      select: { id: true },
    });
    if (!user) return fail('Invalid or expired code', 400);

    const passwordHash = await hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return ok({ reset: true });
  } catch (e: any) {
    return fail(e?.message ?? 'Reset failed', 500);
  }
}
