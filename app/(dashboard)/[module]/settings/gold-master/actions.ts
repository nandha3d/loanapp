'use server';

import { apiFetch } from '@/lib/api-client/index';
import { getApiRequestContext } from '@/lib/api-client/server';
import { revalidatePath } from 'next/cache';

type Kind = 'type' | 'spec' | 'bank';

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
