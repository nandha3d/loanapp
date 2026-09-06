import { NextRequest } from 'next/server';
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
      | { username?: string; password?: string }
      | null;
    if (!body?.username || !body?.password) {
      return fail('username and password are required', 400);
    }
    const username = String(body.username).trim().toLowerCase();

    const slug =
      req.headers.get('x-tenant-slug') ||
      extractTenantSlugFromHost(req.headers.get('host'));
    let tenantId: string | null = null;
    if (slug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, status: true },
      });
      if (tenant && tenant.status === 'active') tenantId = tenant.id;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { phone: username }, { email: username }],
        status: 'active',
        ...(tenantId ? { tenantId } : {}),
      },
      include: { tenant: { select: { slug: true, status: true } } },
    });
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
