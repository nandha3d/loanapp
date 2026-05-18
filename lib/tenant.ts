import prisma from './db';
import { auth } from './auth';
import { headers, cookies } from 'next/headers';
import { cache } from 'react';
import { assertTenantSubscriptionAccess } from './subscription';

type SessionUserContext = {
  appType?: string | null;
  role?: string | null;
  tenantId?: string | null;
};

const TENANT_BYPASS_ROLES = new Set(['superadmin', 'developer']);

export const RESERVED_SLUGS = [
  'www', 'api', 'admin', 'app', 'portal',
  'support', 'static', 'assets'
];

export function isReservedSlug(slug: string | null): boolean {
  if (!slug) return false;
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  return host.toLowerCase().split(':')[0] || null;
}

export function extractTenantSlugFromHost(
  host: string | null | undefined,
  rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.APP_ROOT_DOMAIN || '',
): string | null {
  const hostname = normalizeHost(host);
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return null;
  }

  const normalizedRoot = normalizeHost(rootDomain);
  if (normalizedRoot) {
    if (hostname === normalizedRoot) return null;
    if (hostname.endsWith(`.${normalizedRoot}`)) {
      const slug = hostname.slice(0, -(normalizedRoot.length + 1)).split('.')[0];
      return slug || null;
    }
    return null;
  }

  const labels = hostname.split('.');
  return labels.length > 2 ? labels[0] : null;
}

export function isTenantHostAllowedForSession({
  requestedTenantId,
  sessionTenantId,
  role,
}: {
  requestedTenantId?: string | null;
  sessionTenantId?: string | null;
  role?: string | null;
}): boolean {
  if (!requestedTenantId || !sessionTenantId || requestedTenantId === sessionTenantId) return true;
  return TENANT_BYPASS_ROLES.has(role || '');
}

export async function getUserAppType(): Promise<string> {
  const session = await auth();
  const user = session?.user as SessionUserContext | undefined;
  const role = user?.role;

  const cookieStore = await cookies();
  const activeApp = cookieStore.get('active_app_type')?.value;

  const headerStore = await headers();
  const pathname = headerStore.get('x-loantrack-path') || '';

  // Determine if the route is exclusive to a module
  let routeModule: string | null = null;
  if (pathname === '/vehicles' || pathname.startsWith('/vehicles/')) {
    routeModule = 'autofinance';
  } else if (pathname === '/chits' || pathname.startsWith('/chits/')) {
    routeModule = 'chitfunds';
  }

  if (role === 'developer') {
    if (routeModule) return routeModule;
    return activeApp || 'microlending';
  }
  if (role === 'superadmin') {
    const { getActiveBranchId, getBranchEnabledModules } = await import('./branch');
    const branchId = await getActiveBranchId();
    if (branchId) {
      const modules = await getBranchEnabledModules(branchId);
      if (modules.length > 0) {
        // If route is module-exclusive and that module is enabled, use it
        if (routeModule && modules.includes(routeModule as any)) {
          return routeModule;
        }
        // Otherwise, respect activeApp cookie first if it's enabled
        if (activeApp && modules.includes(activeApp as any)) {
          return activeApp;
        }
        return modules[0];
      }
    }
    if (routeModule) return routeModule;
    if (activeApp) return activeApp;
    return user?.appType || 'microlending';
  }
  if (role === 'admin') {
    const { getActiveModules } = await import('./branch');
    const allowed = await getActiveModules();
    if (allowed.length > 0) {
      // If route is module-exclusive and that module is enabled, use it
      if (routeModule && allowed.includes(routeModule as any)) {
        return routeModule;
      }
      // Otherwise, respect activeApp cookie first if it's enabled
      if (activeApp && allowed.includes(activeApp as any)) {
        return activeApp;
      }
      return allowed[0];
    }
  }

  if (routeModule && routeModule === user?.appType) {
    return routeModule;
  }

  // Respect activeApp first if set and not overridden by exclusive routes
  if (activeApp && !routeModule) {
    return activeApp;
  }

  return user?.appType || 'microlending';
}

// ─── Tenant Context ───────────────────────────
// Request-scoped cache: safe for serverless/edge — no stale data across requests

async function getFallbackDefaultTenantId(): Promise<string> {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) throw new Error('Default tenant not found. Run: npx prisma db seed');
  return tenant.id;
}

export async function getTenantIdFromHost(host: string | null | undefined): Promise<string | null> {
  const slug = extractTenantSlugFromHost(host);
  if (!slug) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!tenant || tenant.status !== 'active') return null;
  return tenant.id;
}

export const getCurrentTenantId = cache(async (): Promise<string> => {
  const session = await auth();
  const user = session?.user as SessionUserContext | undefined;
  const headerStore = await headers();
  const requestedTenantId = await getTenantIdFromHost(headerStore.get('host'));
  const pathname = headerStore.get('x-loantrack-path') || '';

  if (!isTenantHostAllowedForSession({
    requestedTenantId,
    sessionTenantId: user?.tenantId,
    role: user?.role,
  })) {
    throw new Error('Tenant host does not match the authenticated user.');
  }

  const tenantId = user?.tenantId && !TENANT_BYPASS_ROLES.has(user.role || '')
    ? user.tenantId
    : requestedTenantId || user?.tenantId || await getFallbackDefaultTenantId();

  if (
    !pathname.startsWith('/subscription') &&
    !pathname.startsWith('/portal') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/branch-requests')
  ) {
    await assertTenantSubscriptionAccess(tenantId);
  }
  return tenantId;
});

export const getDefaultTenantId = getCurrentTenantId;

export async function getTenantSettings(tenantId: string) {
  const settings = await prisma.appSetting.findMany({ where: { tenantId } });
  const map: Record<string, string> = {};
  settings.forEach(s => { map[s.key] = s.value; });
  return map;
}

export async function getSetting(tenantId: string, key: string, fallback: string = ''): Promise<string> {
  const setting = await prisma.appSetting.findUnique({
    where: { tenantId_key: { tenantId, key } }
  });
  return setting?.value ?? fallback;
}

export async function setSetting(tenantId: string, key: string, value: string, group: string = 'general') {
  return prisma.appSetting.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { value, group },
    create: { tenantId, key, value, group }
  });
}

// ─── Branding Helper ──────────────────────────
export async function getBranding(tenantId: string) {
  const settings = await getTenantSettings(tenantId);
  return {
    appName: settings['app_name'] || 'LoanTrack',
    appTagline: settings['app_tagline'] || 'Micro-Lending Management System',
    logoUrl: settings['logo_url'] || '/assets/logo.svg',
    primaryColor: settings['primary_color'] || '#F5A623',
    primaryDark: settings['primary_dark'] || '#E8930C',
    timezone: settings['timezone'] || 'Asia/Kolkata',
    currency: settings['currency'] || 'INR',
    currencySymbol: settings['currency_symbol'] || '₹',
    dateFormat: settings['date_format'] || 'dd MMM yyyy',
    midnightCutoff: settings['midnight_cutoff'] === 'true',
    allowWeekendCollection: settings['allow_weekend_collection'] === 'true',
    defaultPenaltyPerDay: parseFloat(settings['default_penalty_per_day'] || '50'),
    penaltyGracePeriod: parseInt(settings['penalty_grace_period'] || '0'),
    penaltyMaxCap: parseFloat(settings['penalty_max_cap'] || '0'),
    customerCodePrefix: settings['customer_code_prefix'] || 'CUS',
    loanCodePrefix: settings['loan_code_prefix'] || 'LN',
  };
}
