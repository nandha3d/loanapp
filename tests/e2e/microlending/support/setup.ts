import { db } from './db';
import { api, loginApi } from './api';
import { loadState } from './state';

/**
 * Give statutory accounting a chart of accounts before anything posts.
 *
 * With the add-on on and no CoA, every origination fails with "Posting account
 * 1310 is not configured" (ACC-1) — the right refusal, and the thing an
 * operator fixes by seeding the defaults. Without the add-on this is a no-op,
 * because a tenant on base accounting keeps cash-book-only behaviour (ACC-4).
 */
export async function ensureAccountingConfigured(): Promise<void> {
  const s = loadState();
  const sub = await db().tenantSubscription.findUnique({ where: { tenantId: s.tenantA.id } });
  if (!sub?.premiumAccountingEnabled) return;

  if ((await db().account.count({ where: { tenantId: s.tenantA.id } })) > 0) return;

  const owner = await loginApi(s.tenantA.owner.username, s.password);
  await api.post('/api/v1/accounting/coa', { action: 'reseed' }, { token: owner.token });
}
