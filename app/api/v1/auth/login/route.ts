import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { issueMobileToken, issueRefreshToken, loginWindowFailure, resolveUserVerticals } from '@/lib/api/v1-auth';
import { extractTenantSlugFromHost, getTenantIdFromHost } from '@/lib/tenant';

/**
 * Mobile login. Returns either a token + user, or `{ requiresTotp: true }`
 * when the account has TOTP enabled. Caller then calls /api/v1/auth/2fa.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { username?: string; password?: string; tenantSlug?: string }
      | null;
    if (!body?.username || !body?.password) {
      return fail('username and password are required', 400);
    }
    const username = String(body.username).trim().toLowerCase();
    const rawHost = req.headers.get('host');
    const explicitSlug = (body.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null) ||
      req.headers.get('x-tenant-slug')?.trim().toLowerCase();

    let tenantId: string | null = null;
    if (explicitSlug) {
      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [{ slug: explicitSlug }, { customDomain: explicitSlug }],
        },
        select: { id: true, status: true },
      });
      if (!tenant || tenant.status !== 'active') {
        return fail('Invalid credentials', 401);
      }
      tenantId = tenant.id;
    } else if (rawHost) {
      tenantId = await getTenantIdFromHost(rawHost);
    }

    const tenantInclude = {
      tenant: {
        select: {
          name: true,
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
    } as const;

    let user: any = null;
    if (tenantId) {
      user = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { phone: username }, { email: username }],
          deletedAt: null,
          tenantId,
        },
        include: tenantInclude,
      });
    } else {
      // If tenant was not specified, verify matching active/pending accounts across tenants.
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [{ username }, { phone: username }, { email: username }],
          deletedAt: null,
          tenant: { status: 'active' },
        },
        include: tenantInclude,
        take: 10,
      });

      const distinctTenantIds = new Set(matchingUsers.map((u) => u.tenantId));
      if (distinctTenantIds.size > 1) {
        // Verify password across candidate rows first so another tenant with an
        // unrelated password never triggers a false TENANT_REQUIRED blocker.
        const verifiedCandidates: typeof matchingUsers = [];
        for (const candidate of matchingUsers) {
          if (candidate.passwordHash && (await compare(body.password, candidate.passwordHash))) {
            verifiedCandidates.push(candidate);
          }
        }
        if (verifiedCandidates.length === 0) {
          return fail('Invalid credentials', 401);
        }
        if (verifiedCandidates.length === 1) {
          user = verifiedCandidates[0];
        } else {
          return NextResponse.json(
            {
              data: {
                tenants: verifiedCandidates.map((u) => ({
                  slug: u.tenant.slug,
                  name: u.tenant.name,
                })),
              },
              error: 'Multiple organizations found for this account. Please select your organization.',
              code: 'TENANT_REQUIRED',
              pagination: null,
            },
            { status: 409 },
          );
        }
      } else {
        user = matchingUsers[0] ?? null;
      }
    }
    if (!user || user.tenant.status !== 'active') {
      return fail('Invalid credentials', 401);
    }
    if (!user.passwordHash) {
      return fail('Password login not set. Please use Google Sign-In.', 401);
    }
    const valid = await compare(body.password, user.passwordHash);
    if (!valid) return fail('Invalid credentials', 401);

    if (user.status === 'pending') {
      return NextResponse.json(
        {
          data: null,
          error: 'Please verify your email address before logging in.',
          code: 'EMAIL_NOT_VERIFIED',
          pagination: null,
        },
        { status: 403 },
      );
    }
    if (user.status !== 'active') {
      return fail('Account is inactive or suspended.', 403);
    }

    const windowFailure = loginWindowFailure(user);
    if (windowFailure) return windowFailure;

    if (user.totpSecret) {
      // Caller must follow up with /api/v1/auth/2fa
      return ok({ requiresTotp: true });
    }

    const token = await issueMobileToken({ userId: user.id, tenantId: user.tenantId, branchId: user.branchId, role: user.role, appType: user.appType });
    const refreshToken = await issueRefreshToken(user.id, user.tenantId).catch(() => null);
    const verticals = await resolveUserVerticals(user);

    return ok({
      token,
      refreshToken,
      user: serializeUser(user, verticals),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Login failed', 500);
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
