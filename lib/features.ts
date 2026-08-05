import { getSetting } from '@/lib/tenant';

/**
 * Per-tenant feature opt-ins.
 *
 * These are behaviour flags, not billable add-ons — billable capabilities live on
 * TenantSubscription (bureauEnabled, foreclosureEnabled, …). Anything here is off
 * for every tenant until someone flips the AppSetting row, so existing tenants are
 * never affected by a new flag landing.
 *
 * getSetting() reads through the per-tenant AppSetting cache (lib/tenant.ts), which
 * setSetting() invalidates, so these cost nothing per request.
 */

/** AppSetting key backing {@link isInterestOnlyEnabled}. */
export const INTEREST_ONLY_FLAG = 'interest_only_enabled';

/**
 * Interest-Only (Check/Gold Base) repayment model: monthly dues are interest only
 * and the principal is a bullet settled at closure. Enabled per client tenant.
 */
export async function isInterestOnlyEnabled(tenantId: string): Promise<boolean> {
  return (await getSetting(tenantId, INTEREST_ONLY_FLAG, '0')) === '1';
}
