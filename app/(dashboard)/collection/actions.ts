'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getAgentRouteIds } from '@/lib/access';
import { randomUUID } from 'crypto';
import { reallocateLoanRepayments } from '@/lib/repayments';
import { sendPaymentReceipt } from '@/lib/sms';
import { recordPaymentLedger } from '@/lib/paymentService';

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
  await prisma.$executeRaw`
    INSERT INTO daily_collections
       (id, tenant_id, app_type, agent_id, branch_id, route_id,
        date, total_expected, total_collected, entries_count, status, created_at, updated_at)
     VALUES (${newId}, ${tenantId}, ${appType}, ${agentId}, ${branchId ?? null}, ${routeId ?? null}, CURDATE(), 0, 0, 0, 'open', NOW(), NOW())
     ON DUPLICATE KEY UPDATE id = id
  `;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM daily_collections
     WHERE tenant_id = ${tenantId} AND app_type = ${appType} AND agent_id = ${agentId} AND date = CURDATE()
     LIMIT 1
  `;

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
  // An edit is either changing a non-zero to something else, or if the user explicitly opens an already-processed instalment
  const isEdit = currentReceived > 0 || (instalment.status === 'missed' && receivedAmount > 0);

  if (isEdit && role !== 'admin' && role !== 'superadmin' && receivedAmount !== currentReceived) {
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
  // If delta is 0, only proceed if there's a new remark (e.g., 'door lock')
  if (delta === 0 && !remarks) {
    return { success: true, message: 'No change detected' };
  }

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
        tenantId,
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

    // Create Payment + PaymentAllocation via shared service
    await recordPaymentLedger(tx, {
      tenantId,
      loanId: instalment.loanId,
      instalmentId: instalment.id,
      amount: delta,
      paymentMode,
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
  // Note: AccountEntry is NO LONGER created here. 
  // Capital reflects only upon Cash Handover or UPI Verification.
  revalidatePath('/collection');
  revalidatePath('/dashboard');
  revalidatePath(`/loans/${instalment.loanId}`);

  // ── Send Notification (Fire and Forget) ──────────────────────────────────
  if (instalment.loan.customer.phone && delta > 0) {
    sendPaymentReceipt(
      instalment.loan.customer.phone,
      delta,
      instalment.loan.loanCode,
      tenantId
    ).catch(err => console.error('Failed to send payment receipt SMS', err));
  }

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

export async function requestCashHandover() {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Not authenticated' };

  const rows = await prisma.$queryRaw<{ id: string, status: string, total_collected: number }[]>`
    SELECT id, status, total_collected FROM daily_collections
     WHERE tenant_id = ${tenantId} AND app_type = ${appType} AND agent_id = ${userId} AND date = CURDATE()
     LIMIT 1
  `;

  const dailyCollection = rows[0];

  if (!dailyCollection || Number(dailyCollection.total_collected) <= 0) {
    return { success: false, error: 'No collections to handover today' };
  }

  if (dailyCollection.status !== 'open') {
    return { success: false, error: 'Handover already requested or settled' };
  }

  // Update DailyCollection status
  await prisma.dailyCollection.update({
    where: { id: dailyCollection.id },
    data: { status: 'pending_handover' }
  });

  // Create ApprovalRequest
  await prisma.approvalRequest.create({
    data: {
      tenantId,
      appType,
      requestType: 'cash_handover',
      entityType: 'daily_collection',
      entityId: dailyCollection.id,
      requestedById: userId,
      requestedChanges: JSON.stringify({ amount: Number(dailyCollection.total_collected) }),
      reason: 'End of day cash handover',
      status: 'pending'
    }
  });

  revalidatePath('/collection');
  revalidatePath('/approvals');
  return { success: true };
}

export async function verifyUpiPayment(entryId: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;

  if (role !== 'admin' && role !== 'superadmin') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const entry = await prisma.collectionEntry.findFirst({
      where: { id: entryId, tenantId },
      include: { loan: true, customer: true }
    });

    if (!entry) return { success: false, error: 'Entry not found' };
    if (entry.verificationStatus === 'verified') return { success: true, message: 'Already verified' };

    await prisma.$transaction(async (tx) => {
      await tx.collectionEntry.update({
        where: { id: entry.id },
        data: { verificationStatus: 'verified' }
      });

      await tx.accountEntry.create({
        data: {
          tenantId,
          entryDate: new Date(),
          type: 'collection',
          category: 'upi',
          amount: entry.receivedAmount,
          description: `Verified UPI collection for loan ${entry.loan.loanCode}`,
          referenceId: entry.id,
          referenceType: 'payment',
          createdBy: userId,
          branchId: entry.loan.branchId,
        }
      });
    });

    revalidatePath('/dashboard');
    revalidatePath('/collection');
    return { success: true };
  } catch (error) {
    console.error('Error verifying UPI payment:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to verify UPI payment' };
  }
}

export async function collectAgentCash(routeId: string, agentId: string) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;

  if (role !== 'admin' && role !== 'superadmin') {
    return { success: false, error: 'Unauthorized' };
  }

  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.$transaction(async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const entries = await tx.collectionEntry.findMany({
        where: {
          tenantId,
          agentId,
          paymentMode: 'cash',
          verificationStatus: 'pending',
          customer: { routeId }
        },
        include: { loan: true }
      });

      const totalToCollect = entries.reduce((sum, e) => sum + Number(e.receivedAmount), 0);
      if (totalToCollect <= 0) throw new Error('No pending cash to collect for this route/agent combo');

      const branchId = entries[0]?.loan?.branchId || null;

      await tx.collectionEntry.updateMany({
        where: {
          id: { in: entries.map(e => e.id) }
        },
        data: { verificationStatus: 'verified' }
      });

      const handover = await tx.cashHandover.create({
        data: {
          tenantId,
          agentId,
          adminId: userId,
          routeId,
          amount: totalToCollect,
          status: 'collected',
          collectedAt: new Date(),
          confirmedAt: new Date()
        }
      });

      await tx.accountEntry.create({
        data: {
          tenantId,
          entryDate: new Date(),
          type: 'collection',
          category: 'cash',
          amount: totalToCollect,
          description: `Cash handover collected`,
          referenceId: handover.id,
          referenceType: 'payment',
          createdBy: userId,
          branchId,
        }
      });
    });

    revalidatePath('/dashboard');
    revalidatePath('/collection');
    return { success: true };
  } catch (error) {
    console.error('Error collecting agent cash:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to collect agent cash' };
  }
}

export async function bulkVerifyUpiPayments(entryIds: string[]) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;

  if (role !== 'admin' && role !== 'superadmin') {
    return { success: false, error: 'Unauthorized' };
  }

  if (!entryIds.length) return { success: false, error: 'No entries selected' };

  try {
    const entries = await prisma.collectionEntry.findMany({
      where: {
        id: { in: entryIds },
        tenantId,
        paymentMode: 'upi',
        verificationStatus: 'pending',
      },
      include: { loan: true },
    });

    if (entries.length === 0) return { success: false, error: 'No pending UPI entries found' };

    await prisma.$transaction(async (tx) => {
      // Mark all as verified
      await tx.collectionEntry.updateMany({
        where: { id: { in: entries.map(e => e.id) } },
        data: { verificationStatus: 'verified' },
      });

      // Create individual account entries for each
      for (const entry of entries) {
        await tx.accountEntry.create({
          data: {
            tenantId,
            entryDate: new Date(),
            type: 'collection',
            category: 'upi',
            amount: entry.receivedAmount,
            description: `Verified UPI collection for loan ${entry.loan.loanCode}`,
            referenceId: entry.id,
            referenceType: 'payment',
            createdBy: userId,
          },
        });
      }
    });

    revalidatePath('/dashboard');
    revalidatePath('/collection');
    return { success: true, count: entries.length };
  } catch (error) {
    console.error('Error bulk verifying UPI payments:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to verify UPI payments' };
  }
}

