import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { checkRateLimit, getClientIp, routeKey } from '@/lib/rateLimit';
import { extractTenantSlugFromHost } from '@/lib/tenant';
import { isSamuraiExcludedDomain, normalisePhoneForWhatsApp, sendWhatsAppAuthOtp } from '@/lib/whatsappAuth';

/**
 * Endpoint to trigger WhatsApp OTP authentication for staff or borrowers.
 * POST /api/v1/auth/whatsapp/send-otp
 * Body: { phone, purpose?, tenantSlug? }
 */
export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get('host');
    const ip = getClientIp(req);

    // Rate limit: 10 OTP send requests per IP per 15 mins
    const rl = await checkRateLimit(routeKey('whatsapp-auth:send', ip), {
      limit: (process.env.NODE_ENV as string) !== 'production' ? 1000 : 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.allowed) {
      return fail('Too many OTP requests. Please try again later.', 429);
    }

    const body = (await req.json().catch(() => null)) as {
      phone?: string;
      purpose?: 'login' | 'borrower_login' | '2fa' | 'reset_password' | 'registration';
      tenantSlug?: string;
    } | null;

    if (!body?.phone) {
      return fail('Phone number is required.', 400);
    }

    const tenantSlug =
      (body.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null) ||
      req.headers.get('x-tenant-slug')?.trim().toLowerCase() ||
      extractTenantSlugFromHost(host);

    // Strict domain protection check for Samurai client
    const isExcluded = await isSamuraiExcludedDomain({ host, tenantSlug });
    if (isExcluded) {
      return fail('WhatsApp authentication service is not permitted for this domain.', 403);
    }

    const normalised = normalisePhoneForWhatsApp(body.phone);
    if (!normalised) {
      return fail('Please provide a valid 10-digit mobile number.', 400);
    }

    let tenantId: string | null = null;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, status: true },
      });
      if (tenant?.status === 'active') {
        tenantId = tenant.id;
      }
    }

    const purpose = body.purpose || 'login';
    let userId: string | null = null;
    let customerId: string | null = null;

    if (purpose === 'registration') {
      // Owner registration OTP: Ensure the phone number isn't already taken
      const existingUser = await prisma.user.findFirst({
        where: { phone: normalised.digits10 },
        select: { id: true },
      });
      if (existingUser) {
        return fail('An account with this phone number already exists. Please log in instead.', 409);
      }
    } else if (purpose === 'borrower_login') {
      const customer = await prisma.customer.findFirst({
        where: {
          phone: normalised.digits10,
          status: 'active',
          ...(tenantId ? { tenantId } : {}),
        },
        select: { id: true, tenantId: true },
      });
      if (!customer) {
        return fail('No active customer account found with this phone number.', 404);
      }
      customerId = customer.id;
      tenantId = customer.tenantId;
    } else {
      // Staff login (agent, admin, superadmin, developer)
      const user = await prisma.user.findFirst({
        where: {
          phone: normalised.digits10,
          status: 'active',
          ...(tenantId ? { tenantId } : {}),
        },
        select: { id: true, tenantId: true },
      });
      if (!user) {
        return fail('No active staff account found with this phone number.', 404);
      }
      userId = user.id;
      tenantId = user.tenantId;
    }

    const result = await sendWhatsAppAuthOtp({
      phone: normalised.digits10,
      tenantId,
      host,
      tenantSlug,
      purpose,
      userId,
      customerId,
    });

    if (!result.success) {
      return fail(result.error || 'Failed to send WhatsApp OTP.', 400);
    }

    return ok({
      message: 'OTP sent successfully to your WhatsApp number.',
      challengeToken: result.challengeToken,
      ...(result.testOtp ? { testOtp: result.testOtp } : {}),
    });
  } catch (err: any) {
    console.error('[whatsapp/send-otp] Error:', err);
    return fail(err.message || 'Internal server error', 500);
  }
}
