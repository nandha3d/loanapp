import { NextRequest } from 'next/server';
import { verifySync } from 'otplib';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { issueMobileToken, issueRefreshToken, loginWindowFailure } from '@/lib/api/v1-auth';
import { checkRateLimit, getClientIp, routeKey, loginUserKey } from '@/lib/rateLimit';

/**
 * Step 2 of mobile login when the user has TOTP enabled.
 * Body: { username, code }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { username?: string; code?: string }
      | null;
    if (!body?.username || !body?.code) {
      return fail('username and code are required', 400);
    }
    const username = body.username.trim().toLowerCase();
    const ip = getClientIp(req);

    const [ipLimit, userLimit] = await Promise.all([
      checkRateLimit(routeKey('2fa', ip), { limit: 10, windowMs: 15 * 60 * 1000 }),
      checkRateLimit(loginUserKey(username),  { limit: 5,  windowMs: 15 * 60 * 1000 }),
    ]);
    if (!ipLimit.allowed || !userLimit.allowed) {
      return fail('Too many attempts. Try again later.', 429);
    }
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { phone: username }],
        status: 'active',
      },
      include: { tenant: { select: { slug: true, status: true } } },
    });
    if (!user || !user.totpSecret || user.tenant.status !== 'active') {
      return fail('Invalid code', 401);
    }
    const { valid } = verifySync({ token: body.code, secret: user.totpSecret });
    if (!valid) return fail('Invalid code', 401);

    const windowFailure = loginWindowFailure(user);
    if (windowFailure) return windowFailure;

    const token = await issueMobileToken({ userId: user.id, tenantId: user.tenantId, branchId: user.branchId, role: user.role, appType: user.appType });
    const refreshToken = await issueRefreshToken(user.id, user.tenantId).catch(() => null);

    return ok({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        username: user.username,
        role: user.role,
        branchId: user.branchId,
        appType: user.appType,
        status: user.status,
        totpEnabled: true,
        tenantSlug: user.tenant.slug,
        enabledModules: enabledModulesForRole(user.role),
      },
    });
  } catch (e: any) {
    return fail(e?.message ?? '2FA failed', 500);
  }
}

function enabledModulesForRole(role: string): string[] {
  const base = ['dashboard', 'customers', 'loans', 'collection'];
  if (role === 'agent') return base;
  return [...base, 'approvals', 'analytics', 'chits', 'reports', 'settings'];
}
