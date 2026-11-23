'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { saveChitTypeSettings } from '@/lib/chits/settings';
import type { ChitEngineConfig, ChitEngineType } from '@/lib/chits/engineTypes';

export async function saveChitTypesConfigAction(payload: {
  enabledTypes: ChitEngineType[];
  typeDefaults: Record<string, Partial<ChitEngineConfig>>;
}) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const userId = session?.user?.id;
  if (!userId || !['superadmin', 'developer'].includes(role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const tenantId = await getDefaultTenantId();
    const appType = await getUserAppType();
    if (appType !== 'chitfunds') {
      return { success: false, error: 'Chit type settings apply to the Chit Funds module' };
    }

    const saved = await saveChitTypeSettings(tenantId, payload);

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'update',
        entityType: 'settings',
        newValue: JSON.stringify({
          category: 'chit_types',
          enabledTypes: saved.enabledTypes,
        }),
      },
    });

    revalidatePath('/chitfunds/settings');
    revalidatePath('/chitfunds/chits/new');
    return { success: true, data: saved };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save chit type settings' };
  }
}
