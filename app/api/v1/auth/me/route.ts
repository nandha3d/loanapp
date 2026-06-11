import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getSetting } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const { userId } = auth.context;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: { select: { slug: true, status: true } } },
  });
  if (!user || user.tenant.status !== 'active') {
    return fail('User not found', 404);
  }

  // Verticals the tenant subscribed to (microlending/autofinance/chitfunds/
  // goldloan) — drives the mobile portal module cards, mirroring web /portal.
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: user.tenantId },
    select: { enabledModules: true },
  });
  let verticals: string[] = [];
  try {
    const parsed = JSON.parse(subscription?.enabledModules || '[]');
    if (Array.isArray(parsed)) verticals = parsed.filter((m) => typeof m === 'string');
  } catch { /* malformed JSON → empty list */ }

  // Tenant security policy: the mobile app only shows the biometric lock
  // screen when this is explicitly enabled (Settings → Security).
  const biometricLockRequired =
    (await getSetting(user.tenantId, 'biometric_lock_required', 'false')) === 'true';

  return ok({
    verticals,
    biometricLockRequired,
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
    tenantSlug: user.tenant.slug,
    enabledModules: enabledModulesForRole(user.role),
  });
}

function enabledModulesForRole(role: string): string[] {
  const base = ['dashboard', 'customers', 'loans', 'collection'];
  if (role === 'agent') return base;
  return [...base, 'approvals', 'analytics', 'chits', 'reports', 'settings'];
}
