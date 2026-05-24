'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { withActionAuth } from '@/lib/serverActionAuth';
import { isModuleKey } from '@/types/modules';

export async function submitModuleRequest(formData: FormData) {
  const appType = (formData.get('appType') as string | null)?.trim() || '';
  const reason = (formData.get('reason') as string | null)?.trim() || null;

  if (!appType || !isModuleKey(appType)) {
    return { success: false, error: 'Invalid module selected' };
  }

  return withActionAuth(['superadmin'], async ({ userId, tenantId }) => {
    // Prevent duplicate pending requests for the same module
    const existing = await prisma.moduleRequest.findFirst({
      where: { tenantId, requestedById: userId, appType, status: 'pending' },
    });
    if (existing) {
      return { success: false, error: 'A pending request for this module already exists.' };
    }

    // Check if the module is already enabled in the subscription
    const sub = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { enabledModules: true },
    });
    const enabledModules: string[] = JSON.parse(sub?.enabledModules || '[]');
    if (enabledModules.includes(appType)) {
      return { success: false, error: 'This module is already enabled in your subscription.' };
    }

    await prisma.moduleRequest.create({
      data: { tenantId, requestedById: userId, appType, reason, status: 'pending' },
    });

    await prisma.systemNotification.create({
      data: {
        tenantId,
        appType: 'microlending',
        type: 'module_request',
        icon: 'extension',
        title: 'Module request submitted',
        message: `A superadmin requested to enable module: ${appType}.`,
        link: '/admin/module-requests',
      },
    }).catch(() => {});

    revalidatePath('/module-requests');
    revalidatePath('/admin/module-requests');
    return { success: true };
  });
}
