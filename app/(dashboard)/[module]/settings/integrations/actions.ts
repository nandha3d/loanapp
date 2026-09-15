'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';
import { saveIntegrationSettings } from '@/lib/integrations/settings';

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'developer']);

export async function saveIntegrationsAction(input: Record<string, any>) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.id || !ADMIN_ROLES.has(role)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const tenantId = await getDefaultTenantId();
    const appType = await getUserAppType();
    const data = await saveIntegrationSettings(tenantId, input);
    revalidatePath(modulePath(appType, '/settings/integrations'));
    revalidatePath(modulePath(appType, '/settings'));
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to save integrations' };
  }
}
