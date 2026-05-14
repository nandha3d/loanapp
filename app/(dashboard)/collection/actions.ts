'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getAgentRouteIds } from '@/lib/access';
import { randomUUID } from 'crypto';
import {
  allocatePaymentsAcrossInstalments,
  describeAllocationForPayment,
  reallocateLoanRepayments,
} from '@/lib/repayments';

/**
 * Atomically gets or creates the DailyCollection for (tenantId, appType, agentId, today).
 * Uses raw SQL with MySQL's CURDATE() + ON DUPLICATE KEY UPDATE to avoid:
 *   - Prisma date serialization / timezone offset bugs
 *   - Interactive-transaction rollback invalidating the catch-block fallback
 */
async function getOrCreateDailyCollection(
  tenantId: string,
  appType: string,
  agentId: string,
  branchId: string | null,
  routeId: string | null,
): Promise<{ id: string }> {
  const newId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO daily_collections
       (id, tenant_id, app_type, agent_id, branch_id, route_id,
        date, total_expected, total_collected, entries_count, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 0, 0, 0, 'open', NOW(), NOW())
     ON DUPLICATE KEY UPDATE id = id`,
    newId, tenantId, appType, agentId, branchId ?? null, routeId ?? null,
  );

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM daily_collections
     WHERE tenant_id = ? AND app_type = ? AND agent_id = ? AND date = CURDATE()
     LIMIT 1`,
    tenantId, appType, agentId,
  );

  if (!rows[0]) throw new Error('DailyCollection not found after upsert');
  return rows[0];
}


export async function submitCollectionEntry(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const instalmentId = formData.get('instalmentId') as string;
  const receivedAmount = Number(formData.get('receivedAmount'));
  const paymentMode = (formData.get('paymentMode') as string) || 'cash';
  const remarks = (formData.get('remarks') as string) || null;

  if (!instalmentId || isNaN(receivedAmount) || receivedAmount < 0) {
    return { success: false, error: 'Invalid amount' };
  }

  const instalment = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    include: { loan: { include: { customer: true } } },
  });

  if (!instalment || instalment.loan.tenantId !== tenantId) {
    return { success: false, error: 'Instalment not found' };
  }

  const currentReceived = Number(instalment.receivedAmount || 0);
  const isEdit = currentReceived > 0;

  if (isEdit && role !== 'admin' && role !== 'superadmin') {
    return { success: false, error: 'Only admins can directly edit submitted payments. Please request an edit.' };
  }

  if (role === 'agent') {
    const customerRouteId = instalment.loan.customer.routeId;
    if (!customerRouteId) {
      return { success: false, error: 'Customer has no assigned route' };
    }
    const routeIds = await getAgentRouteIds(userId);
    if (!routeIds.includes(customerRouteId)) {
      return { success: false, error: 'Unauthorized: customer is not on your assigned route' };
    }
  }

  const delta = isEdit ? receivedAmount - currentReceived : receivedAmount;
  if (delta === 0) return { success: true, message: 'No change detected' };

  // ── Get or create DailyCollection OUTSIDE the transaction ──────────────────
  // Must be outside because:
  // 1. MySQL/Prisma rolls back the interactive-transaction connection on any error,
  //    making a catch-block fallback inside the tx unreliable.
  // 2. Raw SQL with CURDATE() avoids Node.js timezone ↔ MySQL date serialization bugs.
  const dailyCollectionRow = await getOrCreateDailyCollection(
    tenantId,
    appType,
    userId,
    instalment.loan.branchId ?? null,
    instalment.loan.customer.routeId ?? null,
  );

  await prisma.$transaction(async (tx) => {

    const allocationRemark = isEdit 
      ? `Payment adjustment for instalment #${instalment.instalmentNo} (${currentReceived} → ${receivedAmount})`
      : `Direct payment for instalment #${instalment.instalmentNo} (+₹${delta})`;
      
    const mergedRemarks = [remarks, allocationRemark].filter(Boolean).join(' | ');

    const entry = await tx.collectionEntry.create({
      data: {
        collectionId: dailyCollectionRow.id,
        customerId: instalment.loan.customerId,
        loanId: instalment.loanId,
        dueAmount: Number(instalment.dueAmount),
        receivedAmount: delta,
        paymentMode,
        remarks: mergedRemarks,
        agentId: userId,
      },
    });

    // Directly update the instalment receivedAmount
    await tx.instalment.update({
      where: { id: instalment.id },
      data: { 
        receivedAmount: isEdit ? receivedAmount : { increment: delta },
        receivedAt: new Date(),
        remarks: isEdit ? `Edited by Admin: ${remarks || ''}` : instalment.remarks
      }
    });

    await reallocateLoanRepayments(tx, instalment.loanId);

    const allEntries = await tx.collectionEntry.findMany({
      where: { collectionId: dailyCollectionRow.id },
    });

    await tx.dailyCollection.update({
      where: { id: dailyCollectionRow.id },
      data: {
        totalCollected: allEntries.reduce((sum, entryItem) => sum + Number(entryItem.receivedAmount), 0),
        totalExpected: allEntries.reduce((sum, entryItem) => sum + Number(entryItem.dueAmount), 0),
        entriesCount: allEntries.length,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: isEdit ? 'update' : 'create',
        entityType: 'collection',
        entityId: entry.id,
        newValue: JSON.stringify({
          customer: instalment.loan.customer.name,
          loanCode: instalment.loan.loanCode,
          delta,
          totalReceived: receivedAmount,
          paymentMode,
          allocation: allocationRemark,
        }),
      },
    });
  });

  revalidatePath('/collection');
  revalidatePath('/dashboard');
  revalidatePath(`/loans/${instalment.loanId}`);
  return { success: true };
}

export async function requestCollectionEdit(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const instalmentId = formData.get('instalmentId') as string;
  const requestedAmount = Number(formData.get('requestedAmount'));
  const reason = (formData.get('reason') as string) || '';

  if (!instalmentId || isNaN(requestedAmount) || requestedAmount < 0) {
    return { success: false, error: 'Invalid requested amount' };
  }

  const instalment = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    select: { id: true, loanId: true }
  });

  if (!instalment) return { success: false, error: 'Instalment not found' };

  await prisma.approvalRequest.create({
    data: {
      tenantId,
      appType,
      requestType: 'edit_collection',
      entityType: 'instalment',
      entityId: instalmentId,
      requestedById: userId,
      requestedChanges: JSON.stringify({ requestedAmount }),
      reason,
      status: 'pending',
    }
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'create',
      entityType: 'approval_request',
      entityId: instalmentId,
      newValue: JSON.stringify({ type: 'edit_collection', requestedAmount, reason }),
    },
  });

  revalidatePath(`/loans/${instalment.loanId}`);
  return { success: true };
}
