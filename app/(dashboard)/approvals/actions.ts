'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

// Fields an agent is allowed to request changes to on a customer record
const CUSTOMER_EDIT_ALLOW_LIST = new Set([
  'name', 'phone', 'address', 'aadharNumber', 'kycStatus', 'photo',
]);

export async function reviewRequest(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userId = session?.user?.id;

  if (!userId || userRole === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const requestId = formData.get('requestId') as string;
  const action = formData.get('action') as string; // 'approve' or 'reject'
  const reviewNotes = formData.get('reviewNotes') as string;

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId, tenantId, appType },
  });

  if (!request || request.status !== 'pending') {
    return { success: false, error: 'Request not found or already processed' };
  }

  if (action === 'approve') {
    if (request.requestType === 'customer_edit' && request.entityType === 'customer') {
      // Verify the target customer belongs to this tenant+appType
      const customer = await prisma.customer.findFirst({
        where: { id: request.entityId, tenantId, appType },
        select: { id: true },
      });
      if (!customer) {
        return { success: false, error: 'Target customer not found in this tenant/app' };
      }

      // Apply only allow-listed fields
      const rawChanges = JSON.parse(request.requestedChanges);
      const safeChanges: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rawChanges)) {
        if (CUSTOMER_EDIT_ALLOW_LIST.has(key)) {
          safeChanges[key] = value;
        }
      }

      if (Object.keys(safeChanges).length > 0) {
        await prisma.customer.update({
          where: { id: request.entityId },
          data: safeChanges,
        });
      }
    }
  }

  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedById: userId,
      reviewedAt: new Date(),
      reviewNotes,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: action === 'approve' ? 'approve' : 'reject',
      entityType: request.entityType,
      entityId: request.entityId,
      newValue: JSON.stringify({ requestId, action, reviewNotes }),
    },
  });

  revalidatePath('/approvals');
  return { success: true };
}

export async function approveCustomerCreation(customerId: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') return { success: false, error: 'Unauthorized' };

  // Verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
    select: { id: true },
  });
  if (!customer) return { success: false, error: 'Customer not found' };

  await prisma.customer.update({
    where: { id: customerId },
    data: { status: 'active' },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenantId!,
      userId,
      action: 'approve',
      entityType: 'customer',
      entityId: customerId,
      newValue: JSON.stringify({ action: 'approve_creation', status: 'active' }),
    },
  });

  revalidatePath('/customers');
  revalidatePath('/dashboard');
  return { success: true };
}
