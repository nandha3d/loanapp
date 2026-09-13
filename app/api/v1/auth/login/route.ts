import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { issueMobileToken, issueRefreshToken, loginWindowFailure } from '@/lib/api/v1-auth';
import { extractTenantSlugFromHost } from '@/lib/tenant';

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
    const explicitSlug = (body.tenantSlug ? String(body.tenantSlug).trim().toLowerCase() : null) ||
      req.headers.get('x-tenant-slug')?.trim().toLowerCase() ||
      extractTenantSlugFromHost(req.headers.get('host'));

    let tenantId: string | null = null;
    if (explicitSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: explicitSlug },
        select: { id: true, status: true },
      });
      if (!tenant || tenant.status !== 'active') {
        return fail('Invalid credentials', 401);
      }
      tenantId = tenant.id;
    }

    let user: any = null;
    if (tenantId) {
      user = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { phone: username }, { email: username }],
          status: 'active',
          tenantId,
        },
        include: { tenant: { select: { slug: true, status: true } } },
      });
    } else {
      // If tenant was not specified, verify whether accounts exist across distinct tenants
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [{ username }, { phone: username }, { email: username }],
          status: 'active',
          tenant: { status: 'active' },
        },
        include: { tenant: { select: { slug: true, status: true } } },
        take: 5,
      });

      const distinctTenantIds = new Set(matchingUsers.map((u) => u.tenantId));
      if (distinctTenantIds.size > 1) {
        return NextResponse.json(
          {
            data: null,
            error: 'Multiple organizations found for this account. Please specify your organization ID or tenant slug.',
            code: 'TENANT_REQUIRED',
            pagination: null,
          },
          { status: 409 },
        );
      }
      user = matchingUsers[0] ?? null;
    }
    if (!user || user.tenant.status !== 'active') {
      return fail('Invalid credentials', 401);
    }
    if (!user.passwordHash) {
      return fail('Password login not set. Please use Google Sign-In.', 401);
    }
    const valid = await compare(body.password, user.passwordHash);
    if (!valid) return fail('Invalid credentials', 401);

    const windowFailure = loginWindowFailure(user);
    if (windowFailure) return windowFailure;

    if (user.totpSecret) {
      // Caller must follow up with /api/v1/auth/2fa
      return ok({ requiresTotp: true });
    }

    const token = await issueMobileToken({ userId: user.id, tenantId: user.tenantId, branchId: user.branchId, role: user.role, appType: user.appType });
    const refreshToken = await issueRefreshToken(user.id, user.tenantId).catch(() => null);

    return ok({
      token,
      refreshToken,
      user: serializeUser(user),
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Login failed', 500);
  }
}

function serializeUser(user: any) {
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
    enabledModules: enabledModulesForRole(user.role, user.appType),
  };
}

function enabledModulesForRole(role: string, _appType: string): string[] {
  const base = ['dashboard', 'customers', 'loans', 'collection'];
  if (role === 'agent') return base;
  return [...base, 'approvals', 'analytics', 'chits', 'reports', 'settings'];
}
