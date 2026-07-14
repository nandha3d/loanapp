import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { normalizeBorrowerOtpInput, verifyBorrowerOtp } from '@/lib/borrowerOtp';
import { issueBorrowerMobileToken, verifyBorrowerChallenge } from '@/lib/api/borrower-mobile';
import { markAttendanceOnLogin } from '@/lib/chits/attendanceAuto';

function getBorrowerOtpSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET, AUTH_SECRET, or MOBILE_JWT_SECRET is required for borrower OTP.');
  return secret;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { phone?: string; otp?: string; challengeToken?: string }
    | null;
  const phone = body?.phone?.replace(/\D/g, '').slice(-10);
  const otp = normalizeBorrowerOtpInput(String(body?.otp ?? ''));
  if (!phone || phone.length < 10) return fail('Valid phone is required', 400);
  if (!otp) return fail('OTP is required', 400);
  if (!body?.challengeToken) return fail('OTP challenge is required', 400);

  try {
    const challenge = await verifyBorrowerChallenge(body.challengeToken);
    if (challenge.phone.replace(/\D/g, '').slice(-10) !== phone) {
      return fail('OTP challenge does not match this phone', 400);
    }
    if (!verifyBorrowerOtp({ otp, expectedHash: challenge.otpHash, secret: getBorrowerOtpSecret() })) {
      return fail('Invalid OTP', 401);
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: challenge.customerId,
        tenantId: challenge.tenantId,
        phone,
        status: 'active',
        deletedAt: null,
      },
      include: { tenant: { select: { slug: true } } },
    });
    if (!customer) return fail('Borrower not found', 404);

    const firstLoan =
      (await prisma.loan.findFirst({
        where: {
          customerId: customer.id,
          tenantId: customer.tenantId,
          status: { in: ['active', 'overdue'] },
          deletedAt: null,
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      })) ??
      (await prisma.loan.findFirst({
        where: { customerId: customer.id, tenantId: customer.tenantId, deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      }));

    const token = await issueBorrowerMobileToken({
      loanId: firstLoan?.id ?? '',
      tenantId: customer.tenantId,
      customerId: customer.id,
      role: 'borrower',
    });

    markAttendanceOnLogin(customer.id, customer.tenantId).catch(() => {});

    return ok({
      token,
      tenantSlug: customer.tenant.slug,
      appType: 'borrower',
      customerId: customer.id,
      loanId: firstLoan?.id ?? null,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Borrower OTP verification failed', 500);
  }
}
