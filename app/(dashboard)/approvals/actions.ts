'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

export async function reviewRequest(formData: FormData) {
  const tenantId = await getDefaultTenantId();
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const userId = session?.user?.id;
  
  if (userRole === 'agent') {
    return { success: false, error: 'Unauthorized' };
  }

  const requestId = formData.get('requestId') as string;
  const action = formData.get('action') as string; // 'approve' or 'reject'
  const reviewNotes = formData.get('reviewNotes') as string;

  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId, tenantId }
  });

  if (!request || request.status !== 'pending') {
    return { success: false, error: 'Request not found or already processed' };
  }

  if (action === 'approve') {
    if (request.requestType === 'customer_edit' && request.entityType === 'customer') {
      const changes = JSON.parse(request.requestedChanges);
      
      // Extract specific entity changes vs related (e.g. cheques, guarantors)
      // For now, prototype level handling of basic changes.
      await prisma.customer.update({
        where: { id: request.entityId },
        data: {
          ...changes
        }
      });
    }
  }

  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedById: userId,
      reviewedAt: new Date(),
      reviewNotes
    }
  });

  revalidatePath('/approvals');
  return { success: true };
}

export async function approveCustomerCreation(customerId: string) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  if (userRole === 'agent') return { success: false, error: 'Unauthorized' };

  await prisma.customer.update({
    where: { id: customerId },
    data: { status: 'active' }
  });

  revalidatePath('/customers');
  revalidatePath('/dashboard');
  return { success: true };
}
