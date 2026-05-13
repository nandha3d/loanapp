import prisma from './db';
import { auth } from './auth';
import { cookies } from 'next/headers';
import { cache } from 'react';

export async function getUserAppType(): Promise<string> {
  const session = await auth();
  const role = (session?.user as any)?.role;
  
  // If superadmin or developer, check cookie first
  if (role === 'superadmin' || role === 'developer') {
    const cookieStore = await cookies();
    const activeApp = cookieStore.get('active_app_type')?.value;
    const allowedAppTypes = ['microlending', 'autofinance', 'chitfunds'];
    if (activeApp && allowedAppTypes.includes(activeApp)) return activeApp;
  }

  return (session?.user as any)?.appType || 'microlending';
}

// ─── Tenant Context ───────────────────────────
// Request-scoped cache: safe for serverless/edge — no stale data across requests

export const getDefaultTenantId = cache(async (): Promise<string> => {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
  if (!tenant) throw new Error('Default tenant not found. Run: npx prisma db seed');
  return tenant.id;
});

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
