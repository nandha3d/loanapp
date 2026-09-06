import { NextRequest } from 'next/server';
import bcryptjs from 'bcryptjs';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { BORROWER_OTP_TTL_SECONDS, generateBorrowerOtp, hashBorrowerOtp } from '@/lib/borrowerOtp';
import { issueBorrowerChallenge, issueBorrowerMobileToken } from '@/lib/api/borrower-mobile';
import { markAttendanceOnLogin } from '@/lib/chits/attendanceAuto';

function getBorrowerOtpSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET, AUTH_SECRET, or MOBILE_JWT_SECRET is required for borrower OTP.');
  return secret;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { phone?: string; password?: string } | null;
  const phone = body?.phone?.replace(/\D/g, '').slice(-10);
  if (!phone || phone.length < 10) return fail('Valid phone is required', 400);

  try {
    // Rate limit: OTP requests and password attempts share one bucket per IP.
    const rl = await checkRateLimit(routeKey('borrower-mobile:login', getClientIp(req)), {
      limit: (process.env.NODE_ENV as string) !== 'production' ? 1000 : 15,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) return fail('Too many login attempts. Please try again later.', 429);

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

    // Password login (same credential as the web borrower portal). OTP stays
    // the first-time-setup path; production has no SMS sender, so customers
    // with a password set must be able to log in with it directly.
    if (body?.password !== undefined) {
      if (!customer.passwordHash) {
        return fail('Password not set for this account. Use OTP login to set one.', 400);
      }
      const match = await bcryptjs.compare(String(body.password), customer.passwordHash);
      if (!match) return fail('Incorrect password', 401);

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
    }

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
      passwordExists: !!customer.passwordHash,
      ...((process.env.NODE_ENV as string) !== 'production' ? { testOtp: code } : {}),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Borrower login failed', 500);
  }
}
