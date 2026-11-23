import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, resolveUserVerticals } from '@/lib/api/v1-auth';
import { getSetting } from '@/lib/tenant';
import { getAppLockPolicy } from '@/lib/appLock';

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

  // Verticals the user has access to (microlending/autofinance/chitfunds/
  // goldloan) — drives the mobile portal module cards, mirroring web /portal.
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: user.tenantId },
    select: {
      gpsTrackingEnabled: true,
      npaEnabled: true,
      kycEnabled: true,
      bureauEnabled: true,
      premiumAccountingEnabled: true,
      whatsappSmsEnabled: true,
      foreclosureEnabled: true,
      receiptPdfAllowed: true,
      nachEnabled: true,
    },
  });
  const verticals = await resolveUserVerticals(user);
  const requestedAppType = req.headers.get('x-app-type')?.trim().toLowerCase();
  const effectiveAppType =
    requestedAppType &&
    user.role !== 'agent' &&
    verticals.includes(requestedAppType as any)
      ? requestedAppType
      : user.appType;
  const isChitEffective = effectiveAppType === 'chitfunds';

  // Tenant security policy: the mobile app only shows the biometric lock
  // screen when this is explicitly enabled (Settings → Security).
  const { biometricLockRequired, timeoutMinutes: appLockTimeoutMinutes } = await getAppLockPolicy(user.tenantId);
  const kycMethod = await getSetting(user.tenantId, 'kyc_method', 'manual_upload');

  return ok({
    verticals,
    biometricLockRequired,
    // Minutes the app may be backgrounded/idle before it asks to unlock (0 = every time).
    appLockTimeoutMinutes,
    gpsTrackingEnabled: !isChitEffective && Boolean(subscription?.gpsTrackingEnabled),
    npaEnabled: !isChitEffective && Boolean(subscription?.npaEnabled),
    kycEnabled: Boolean(subscription?.kycEnabled),
    kycMethod,
    // LOAN-02: mobile shows the Bullet option only when the tenant enabled it.
    bulletTermEnabled: !isChitEffective && (await (await import('@/lib/features')).isBulletTermEnabled(user.tenantId)),
    // LOAN-03: mobile offers Interest-Only only when the tenant enabled it.
    interestOnlyEnabled: !isChitEffective && (await (await import('@/lib/features')).isInterestOnlyEnabled(user.tenantId)),
    // CUST-07: country code for wa.me links (setting phone_country_code, default 91).
    phoneCountryCode: await getSetting(user.tenantId, 'phone_country_code', '91'),
    bureauEnabled: !isChitEffective && Boolean(subscription?.bureauEnabled),
    premiumAccountingEnabled: Boolean(subscription?.premiumAccountingEnabled),
    whatsappSmsEnabled: Boolean(subscription?.whatsappSmsEnabled),
    foreclosureEnabled: !isChitEffective && Boolean(subscription?.foreclosureEnabled),
    // SET-02: plan gate for receipt / document PDFs (web hides the toggle without it).
    receiptPdfAllowed: Boolean(subscription?.receiptPdfAllowed),
    // eNACH is a plan feature (Enterprise by default), not a tenant setting.
    nachEnabled: !isChitEffective && Boolean(subscription?.nachEnabled),
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    username: user.username,
    role: user.role,
    branchId: user.branchId,
    appType: effectiveAppType,
    status: user.status,
    totpEnabled: Boolean(user.totpSecret),
    tenantSlug: user.tenant.slug,
    bypassLoanApproval: !isChitEffective && (user.role === 'agent' ? Boolean(user.bypassLoanApproval) : true),
    enabledModules: enabledModulesForRole(user.role, effectiveAppType),
  });
}

function enabledModulesForRole(role: string, appType: string): string[] {
  if (appType === 'chitfunds') {
    const chitBase = ['dashboard', 'customers', 'chits', 'collection'];
    if (role === 'agent') return chitBase;
    return [...chitBase, 'accounting', 'reports', 'settings'];
  }
  const base = ['dashboard', 'customers', 'loans', 'collection'];
  if (role === 'agent') return base;
  return [...base, 'approvals', 'analytics', 'chits', 'reports', 'settings'];
}
