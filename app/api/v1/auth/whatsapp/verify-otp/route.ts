import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { issueMobileToken, issueRefreshToken, loginWindowFailure, resolveUserVerticals } from '@/lib/api/v1-auth';
import { issueBorrowerMobileToken } from '@/lib/api/borrower-mobile';
import { markAttendanceOnLogin } from '@/lib/chits/attendanceAuto';
import { isSamuraiExcludedDomain, verifyWhatsAppAuthOtp } from '@/lib/whatsappAuth';

/**
 * Endpoint to verify WhatsApp OTP and authenticate staff or borrower.
 * POST /api/v1/auth/whatsapp/verify-otp
 * Body: { phone, otp, challengeToken, tenantSlug? }
 */
export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get('host');
    const ip = getClientIp(req);

    // Rate limit: 15 verification attempts per IP per 15 mins
    const rl = await checkRateLimit(routeKey('whatsapp-auth:verify', ip), {
      limit: (process.env.NODE_ENV as string) !== 'production' ? 1000 : 15,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      return fail('Too many verification attempts. Please try again later.', 429);
    }

    const body = (await req.json().catch(() => null)) as {
      phone?: string;
      otp?: string;
      challengeToken?: string;
      tenantSlug?: string;
    } | null;

    if (!body?.phone || !body?.otp || !body?.challengeToken) {
      return fail('Phone, OTP, and challengeToken are required.', 400);
    }

    const tenantSlug =
      (body.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null) ||
      req.headers.get('x-tenant-slug')?.trim().toLowerCase();

    // Strict domain protection check for Samurai client
    const isExcluded = await isSamuraiExcludedDomain({ host, tenantSlug });
    if (isExcluded) {
      return fail('WhatsApp authentication service is not permitted for this domain.', 403);
    }

    const verification = await verifyWhatsAppAuthOtp({
      phone: body.phone,
      otp: body.otp,
      challengeToken: body.challengeToken,
      host,
      tenantSlug,
    });

    if (!verification.success || !verification.claims) {
      return fail(verification.error || 'Invalid or expired OTP.', 401);
    }

    const { claims } = verification;

    // Handle borrower login
    if (claims.purpose === 'borrower_login' || claims.customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          phone: claims.phone,
          status: 'active',
          ...(claims.tenantId ? { tenantId: claims.tenantId } : {}),
        },
        include: { tenant: { select: { slug: true } } },
      });

      if (!customer) {
        return fail('Customer record not found.', 404);
      }

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

    // Handle staff login (User)
    const user = await prisma.user.findFirst({
      where: {
        phone: claims.phone,
        status: 'active',
        ...(claims.tenantId ? { tenantId: claims.tenantId } : {}),
      },
      include: {
        tenant: {
          select: {
            slug: true,
            status: true,
            subscription: {
              select: {
                gpsTrackingEnabled: true,
                npaEnabled: true,
                kycEnabled: true,
                bureauEnabled: true,
                premiumAccountingEnabled: true,
                whatsappSmsEnabled: true,
                foreclosureEnabled: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.tenant.status !== 'active') {
      return fail('Active user account not found.', 404);
    }

    const windowFailure = loginWindowFailure(user);
    if (windowFailure) return windowFailure;

    const token = await issueMobileToken({
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
      appType: user.appType,
    });
    const refreshToken = await issueRefreshToken(user.id, user.tenantId).catch(() => null);
    const verticals = await resolveUserVerticals(user);

    return ok({
      token,
      refreshToken,
      user: serializeUser(user, verticals),
    });
  } catch (err: any) {
    console.error('[whatsapp/verify-otp] Error:', err);
    return fail(err.message || 'Internal server error', 500);
  }
}

function serializeUser(user: any, verticals: string[] = []) {
  const sub = user.tenant?.subscription;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    appType: user.appType,
    status: user.status,
    totpEnabled: Boolean(user.totpSecret),
    tenantSlug: user.tenant?.slug ?? null,
    gpsTrackingEnabled: Boolean(sub?.gpsTrackingEnabled),
    npaEnabled: Boolean(sub?.npaEnabled),
    kycEnabled: Boolean(sub?.kycEnabled),
    bureauEnabled: Boolean(sub?.bureauEnabled),
    premiumAccountingEnabled: Boolean(sub?.premiumAccountingEnabled),
    whatsappSmsEnabled: Boolean(sub?.whatsappSmsEnabled),
    foreclosureEnabled: Boolean(sub?.foreclosureEnabled),
    enabledModules: enabledModulesForRole(user.role, user.appType),
    verticals,
  };
}

function enabledModulesForRole(role: string, _appType: string): string[] {
  const base = ['dashboard', 'customers', 'loans', 'collection'];
  if (role === 'agent') return base;
  return [...base, 'approvals', 'analytics', 'chits', 'reports', 'settings'];
}
