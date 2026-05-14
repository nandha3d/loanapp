'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { decryptAadharNumber, encryptAadharNumber, isMaskedAadharNumber } from '@/lib/pii';
import { submitCollectionEntry } from '@/app/(dashboard)/collection/actions';

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
          safeChanges[key] = key === 'aadharNumber'
            ? encryptAadharNumber(String(value || ''))
            : value;
        }
      }

      await prisma.customer.update({
        where: { id: request.entityId },
        data: safeChanges,
      });
    } else if (request.requestType === 'edit_collection') {
      const { requestedAmount } = JSON.parse(request.requestedChanges);
      const fd = new FormData();
      fd.set('instalmentId', request.entityId);
      fd.set('receivedAmount', String(requestedAmount));
      await submitCollectionEntry(fd);
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

// Fields an agent is allowed to request edits for
const EDIT_REQUEST_FIELDS = ['name', 'phone', 'address', 'aadharNumber', 'kycStatus'];

/**
 * Submitted by an agent from the customer profile page.
 * Creates a pending ApprovalRequest for admin/superadmin to review.
 */
export async function submitEditRequest(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;

  if (!userId) return { success: false, error: 'Not authenticated' };

  const customerId = formData.get('customerId') as string;
  const reason = formData.get('reason') as string;

  if (!customerId || !reason?.trim()) {
    return { success: false, error: 'Customer and reason are required' };
  }

  // Verify customer belongs to this tenant
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, appType },
    select: { id: true, name: true, phone: true, address: true, aadharNumber: true, kycStatus: true },
  });
  if (!customer) return { success: false, error: 'Customer not found' };

  // Collect only the allowed changed fields from the form
  const requestedChanges: Record<string, string> = {};
  for (const field of EDIT_REQUEST_FIELDS) {
    const val = formData.get(field) as string | null;
    if (field === 'aadharNumber' && isMaskedAadharNumber(val)) continue;
    const existingValue = field === 'aadharNumber'
      ? decryptAadharNumber(customer.aadharNumber)
      : (customer as any)[field];
    if (val !== null && val !== existingValue) {
      requestedChanges[field] = field === 'aadharNumber'
        ? encryptAadharNumber(val) || ''
        : val;
    }
  }

  if (Object.keys(requestedChanges).length === 0) {
    return { success: false, error: 'No changes detected. Please modify at least one field.' };
  }

  // Block duplicate pending requests for the same customer
  const existing = await prisma.approvalRequest.findFirst({
    where: { tenantId, appType, entityId: customerId, requestType: 'customer_edit', status: 'pending' },
  });
  if (existing) {
    return { success: false, error: 'An edit request is already pending for this customer.' };
  }

  await prisma.approvalRequest.create({
    data: {
      tenantId,
      appType,
      requestType: 'customer_edit',
      entityType: 'customer',
      entityId: customerId,
      requestedById: userId,
      requestedChanges: JSON.stringify(requestedChanges),
      reason,
      status: 'pending',
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'create',
      entityType: 'approval_request',
      entityId: customerId,
      newValue: JSON.stringify({ requestType: 'customer_edit', changes: requestedChanges }),
    },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/approvals');
  return { success: true };
}
