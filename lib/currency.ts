import { getSetting } from '@/lib/tenant';

/**
 * Tenant-configurable currency helpers. Settings live in AppSetting under the
 * existing branding keys (`currency`, `currency_symbol`) so the Settings UI
 * already edits them — see lib/tenant.ts getBranding().
 */
export async function getCurrencyCode(tenantId: string): Promise<string> {
  return getSetting(tenantId, 'currency', 'INR');
}

export async function getCurrencySymbol(tenantId: string): Promise<string> {
  return getSetting(tenantId, 'currency_symbol', '₹');
}
