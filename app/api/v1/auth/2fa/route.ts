import { NextRequest } from 'next/server';
import { authenticator } from 'otplib';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { issueMobileToken } from '@/lib/api/v1-auth';

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
    const valid = authenticator.verify({ token: body.code, secret: user.totpSecret });
    if (!valid) return fail('Invalid code', 401);

    const token = await issueMobileToken({
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
      appType: user.appType,
    });

    return ok({
      token,
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
