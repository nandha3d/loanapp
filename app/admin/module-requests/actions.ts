'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { withActionAuth } from '@/lib/serverActionAuth';
import { normalizeModuleList } from '@/types/modules';

export async function reviewModuleRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string;
  const decision = formData.get('decision') as 'approved' | 'rejected';
  const reviewNote = (formData.get('reviewNote') as string | null)?.trim() || null;

  if (!requestId || !['approved', 'rejected'].includes(decision)) {
    return { success: false, error: 'Invalid review request' };
  }

  return withActionAuth(['developer'], async ({ userId }) => {
    const req = await prisma.moduleRequest.findUnique({
      where: { id: requestId },
      include: { requestedBy: { select: { id: true, name: true } } },
    });
    if (!req || req.status !== 'pending') {
      return { success: false, error: 'Request not found or already reviewed' };
    }

    if (decision === 'approved') {
      // Add the module to the tenant's subscription enabledModules
      const sub = await prisma.tenantSubscription.findUnique({
        where: { tenantId: req.tenantId },
        select: { enabledModules: true },
      });
      const current = normalizeModuleList(sub?.enabledModules);
      if (!current.includes(req.appType as any)) {
        const updated = [...current, req.appType];
        await prisma.tenantSubscription.upsert({
          where: { tenantId: req.tenantId },
          update: { enabledModules: JSON.stringify(updated) },
          create: {
            tenantId: req.tenantId,
            enabledModules: JSON.stringify(updated),
            plan: 'trial',
            status: 'active',
            maxActiveLoans: 50,
            maxAgents: 3,
          },
        });
      }
    }

    await prisma.moduleRequest.update({
      where: { id: requestId },
      data: { status: decision, reviewedById: userId, reviewNote, reviewedAt: new Date() },
    });

    await prisma.systemNotification.create({
      data: {
        tenantId: req.tenantId,
        appType: 'microlending',
        type: 'module_request',
        icon: decision === 'approved' ? 'check_circle' : 'cancel',
        title: `Module request ${decision}`,
        message: `Your request for module "${req.appType}" was ${decision}.`,
        link: '/module-requests',
      },
    }).catch(() => {});

    revalidatePath('/admin/module-requests');
    return { success: true };
  });
}
