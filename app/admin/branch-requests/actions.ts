'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { withActionAuth } from '@/lib/serverActionAuth';
import { normalizeModuleList } from '@/types/modules';

export async function reviewBranchRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string;
  const decision = formData.get('decision') as 'approved' | 'rejected';
  const reviewNote = (formData.get('reviewNote') as string | null)?.trim() || null;

  if (!requestId || !['approved', 'rejected'].includes(decision)) {
    return { success: false, error: 'Invalid review request' };
  }

  return withActionAuth(['developer'], async ({ userId }) => {
    const req = await prisma.branchRequest.findUnique({
      where: { id: requestId },
      include: { requestedBy: { select: { id: true, name: true } } },
    });
    if (!req || req.status !== 'pending') {
      return { success: false, error: 'Request not found or already reviewed' };
    }

    const requestedModules = normalizeModuleList(req.requestedModules);

    if (decision === 'approved') {
      // Validate that requested modules are within the tenant's subscription plan
      const sub = await prisma.tenantSubscription.findUnique({
        where: { tenantId: req.tenantId },
        select: { enabledModules: true },
      });
      if (sub) {
        const planModules = normalizeModuleList(sub.enabledModules);
        const invalidModules = requestedModules.filter(m => !planModules.includes(m));
        if (invalidModules.length > 0) {
          return { success: false, error: `Modules not in tenant subscription: ${invalidModules.join(', ')}. Update the subscription first.` };
        }
      }

      if (req.branchId) {
        await prisma.branch.update({
          where: { id: req.branchId },
          data: { enabledModules: JSON.stringify(requestedModules) },
        });
      } else {
        await prisma.branch.create({
          data: {
            tenantId: req.tenantId,
            superadminId: req.requestedById,
            name: req.branchName ?? 'New Branch',
            enabledModules: JSON.stringify(requestedModules),
            status: 'active',
          },
        });
      }
    }

    await prisma.branchRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        reviewedById: userId,
        reviewNote,
        reviewedAt: new Date(),
      },
    });

    await prisma.systemNotification.create({
      data: {
        tenantId: req.tenantId,
        appType: 'microlending',
        type: 'branch_request',
        icon: decision === 'approved' ? 'check_circle' : 'cancel',
        title: `Branch request ${decision}`,
        message: `${req.branchName || 'Branch module request'} was ${decision}.`,
        link: '/branch-requests',
      },
    }).catch(() => {});

    revalidatePath('/admin/branch-requests');
    revalidatePath('/branch-requests');
    return { success: true };
  });
}
