import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { BORROWER_OTP_TTL_SECONDS, generateBorrowerOtp, hashBorrowerOtp } from '@/lib/borrowerOtp';
import { issueBorrowerChallenge } from '@/lib/api/borrower-mobile';

function getBorrowerOtpSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET, AUTH_SECRET, or MOBILE_JWT_SECRET is required for borrower OTP.');
  return secret;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const phone = body?.phone?.replace(/\D/g, '').slice(-10);
  if (!phone || phone.length < 10) return fail('Valid phone is required', 400);

  try {
    const tenantSlug = req.headers.get('x-tenant-slug');
    const customer = await prisma.customer.findFirst({
      where: {
        phone,
        status: 'active',
        deletedAt: null,
        ...(tenantSlug ? { tenant: { slug: tenantSlug, status: 'active' } } : { tenant: { status: 'active' } }),
      },
      include: { tenant: { select: { slug: true } } },
    });
    if (!customer) return fail('Borrower not found', 404);

    const code = generateBorrowerOtp();
    const challengeToken = await issueBorrowerChallenge(
      {
        tenantId: customer.tenantId,
        customerId: customer.id,
        phone: customer.phone,
        otpHash: hashBorrowerOtp(code, getBorrowerOtpSecret()),
        role: 'borrower_otp',
      },
      BORROWER_OTP_TTL_SECONDS,
    );

    return ok({
      otpRequired: true,
      challengeToken,
      tenantSlug: customer.tenant.slug,
      ...((process.env.NODE_ENV as string) !== 'production' ? { testOtp: code } : {}),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Borrower login failed', 500);
  }
}
