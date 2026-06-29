'use server';

import { apiFetch } from '@/lib/api-client/index';
import { getApiRequestContext } from '@/lib/api-client/server';
import { revalidatePath } from 'next/cache';
import { getDefaultTenantId, setSetting } from '@/lib/tenant';
import { GOLD_SETTING_KEYS } from '@/lib/gold/settings';

type Kind = 'type' | 'spec' | 'bank';

// Save gold/silver pledge settings (rates, interest, scheme, fee, LTV, prefix)
// into AppSetting — the same source the pledge form + servicing read.
export async function saveGoldSettings(values: Record<string, string>) {
  try {
    const tenantId = await getDefaultTenantId();
    const K = GOLD_SETTING_KEYS;
    const map: Array<[string, string | undefined]> = [
      [K.goldPureRate, values.goldPureRate],
      [K.silverRate, values.silverRate],
      [K.goldInterestPercent, values.goldInterestPercent],
      [K.silverInterestPercent, values.silverInterestPercent],
      [K.interestSchemeMonths, values.interestSchemeMonths],
      [K.processingFeeDefault, values.processingFeeDefault],
      [K.processingFeePercentageBased, values.processingFeePercentageBased],
      [K.autoRateKaratBased, values.autoRateKaratBased],
      [K.defaultLtvPercent, values.defaultLtvPercent],
      [K.billPrefix, values.billPrefix],
    ];
    for (const [key, val] of map) {
      if (val !== undefined) await setSetting(tenantId, key, String(val), 'gold');
    }
    revalidatePath('/settings');
    return { success: true };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save settings' };
  }
}

// Gold master-data CRUD (ornament types / specifications / bank names) via the
// gold master API. The dropdowns on the pledge form read the same source.

export async function addGoldMaster(
  kind: Kind,
  name: string,
  opts: { metal?: string; purityKarat?: string; sortOrder?: number } = {},
) {
  if (!name.trim()) return { error: 'Name is required' };
  try {
    const ctx = await getApiRequestContext();
    const res = await apiFetch<any>('/gold/master', {
      method: 'POST',
      body: JSON.stringify({ kind, name: name.trim(), ...opts }),
      ...ctx,
    });
    if (res?.error) return { error: res.error };
    revalidatePath('/settings/gold-master');
    return { success: true };
  } catch (e: any) {
    return { error: e?.message || 'Failed to add' };
  }
}

export async function updateGoldMaster(
  kind: Kind,
  id: string,
  data: { name?: string; isActive?: boolean; metal?: string; purityKarat?: string; sortOrder?: number },
) {
  try {
    const ctx = await getApiRequestContext();
    const res = await apiFetch<any>('/gold/master', {
      method: 'PATCH',
      body: JSON.stringify({ kind, id, ...data }),
      ...ctx,
    });
    if (res?.error) return { error: res.error };
    revalidatePath('/settings/gold-master');
    return { success: true };
  } catch (e: any) {
    return { error: e?.message || 'Failed to update' };
  }
}

export async function deleteGoldMaster(kind: Kind, id: string) {
  try {
    const ctx = await getApiRequestContext();
    const res = await apiFetch<any>(`/gold/master?kind=${kind}&id=${id}`, { method: 'DELETE', ...ctx });
    if (res?.error) return { error: res.error };
    revalidatePath('/settings/gold-master');
    return { success: true };
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete' };
  }
}
