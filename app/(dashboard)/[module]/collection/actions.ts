'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getAgentRouteIds } from '@/lib/access';
import { randomUUID } from 'crypto';
import { reallocateLoanRepayments } from '@/lib/repayments';
import { notify } from '@/lib/notify/events';
import { recordPaymentLedger } from '@/lib/paymentService';
import { buildCollectionIdempotencyKey, canCollectForLoanStatus } from '@/lib/collectionPolicy';
import { autoPostCollection } from '@/lib/accounting/autoPost';
import {
  isGpsTrackingEnabled,
  normalizeGpsFormData,
  recordCollectionLocationPing,
  verifyAndPersistCollectionLocation,
} from '@/lib/gps/locationVerifier';

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
  const gpsTrackingEnabled = await isGpsTrackingEnabled(tenantId);
  const gpsCapture = normalizeGpsFormData(formData, gpsTrackingEnabled);

  if (!instalmentId || isNaN(receivedAmount) || receivedAmount <= 0) {
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
  const idempotencyKey = buildCollectionIdempotencyKey({
    tenantId,
    agentId: userId,
    instalmentId,
    receivedAmount,
    paymentMode,
    collectionDate: new Date(),
  });
  let appliedDelta = delta;
  let createdEntryId: string | null = null;
  let allocationRemark = '';

  try {
    await prisma.$transaction(async (tx) => {
      const latestInstalment = await tx.instalment.findUnique({
        where: { id: instalment.id },
        select: { dueAmount: true, receivedAmount: true },
      });
      if (!latestInstalment) throw new Error('Instalment not found');

      if (isEdit) {
        // Admin correcting a single instalment's recorded amount — operates on the
        // clicked instalment only (unchanged behaviour).
        allocationRemark = `Payment adjustment for instalment #${instalment.instalmentNo} (${currentReceived} → ${receivedAmount})`;
        const mergedRemarks = [remarks, allocationRemark].filter(Boolean).join(' | ');

        const entry = await tx.collectionEntry.create({
          data: {
            tenantId, idempotencyKey, collectionId: dailyCollectionRow.id,
            customerId: instalment.loan.customerId, loanId: instalment.loanId,
            dueAmount: Number(instalment.dueAmount), receivedAmount: appliedDelta,
            paymentMode, remarks: mergedRemarks, agentId: userId,
            lat: gpsCapture.latitude, lng: gpsCapture.longitude,
            gpsAccuracyM: gpsCapture.gpsAccuracy, gpsCapturedAt: gpsCapture.gpsTimestamp,
            gpsAltitude: gpsCapture.gpsAltitude, locationStatus: gpsCapture.locationStatus,
          },
        });
        createdEntryId = entry.id;

        await recordPaymentLedger(tx, {
          tenantId, loanId: instalment.loanId, instalmentId: instalment.id,
          amount: appliedDelta, paymentMode,
        });

        await tx.instalment.update({
          where: { id: instalment.id },
          data: { receivedAmount, receivedAt: new Date(), remarks: `Edited by Admin: ${remarks || ''}` },
        });
      } else {
        // Fresh collection: spread the collected amount across the loan's unpaid
        // instalments oldest-first (clears overdue before today's due) instead of
        // capping it to the clicked instalment and discarding the surplus. This is
        // why paying the full "Total Outstanding Balance" now clears today too.
        if (!canCollectForLoanStatus(instalment.loan.status)) {
          throw new Error('Already recorded: Loan is closed for collection');
        }
        const unpaid = await tx.instalment.findMany({
          where: { loanId: instalment.loanId },
          orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
          select: { id: true, instalmentNo: true, dueAmount: true, receivedAmount: true },
        });
        const totalOutstanding = unpaid.reduce(
          (sum, i) => sum + Math.max(0, Number(i.dueAmount) - Number(i.receivedAmount)), 0,
        );
        if (totalOutstanding <= 0) {
          throw new Error('Already recorded: Instalment is already fully collected');
        }

        // Build the allocation plan. Cap the total at the loan's outstanding so a
        // mistaken over-amount can never credit more than is actually owed.
        let remaining = delta;
        const plan: { id: string; instalmentNo: number; add: number }[] = [];
        for (const inst of unpaid) {
          if (remaining <= 0) break;
          const room = Math.max(0, Number(inst.dueAmount) - Number(inst.receivedAmount));
          if (room <= 0) continue;
          const add = Math.min(remaining, room);
          plan.push({ id: inst.id, instalmentNo: inst.instalmentNo, add });
          remaining -= add;
        }
        appliedDelta = plan.reduce((sum, p) => sum + p.add, 0);

        allocationRemark = `Payment distributed: ${plan.map(p => `#${p.instalmentNo} +₹${p.add}`).join(', ')}`;
        const mergedRemarks = [remarks, allocationRemark].filter(Boolean).join(' | ');

        const entry = await tx.collectionEntry.create({
          data: {
            tenantId, idempotencyKey, collectionId: dailyCollectionRow.id,
            customerId: instalment.loan.customerId, loanId: instalment.loanId,
            dueAmount: Number(instalment.dueAmount), receivedAmount: appliedDelta,
            paymentMode, remarks: mergedRemarks, agentId: userId,
            lat: gpsCapture.latitude, lng: gpsCapture.longitude,
            gpsAccuracyM: gpsCapture.gpsAccuracy, gpsCapturedAt: gpsCapture.gpsTimestamp,
            gpsAltitude: gpsCapture.gpsAltitude, locationStatus: gpsCapture.locationStatus,
          },
        });
        createdEntryId = entry.id;

        // One Payment with an allocation per instalment it covers.
        const payment = await tx.payment.create({
          data: {
            tenantId, loanId: instalment.loanId, amount: appliedDelta,
            paymentMode, paymentDate: new Date(), status: 'completed',
          },
        });
        for (const p of plan) {
          await tx.paymentAllocation.create({
            data: { paymentId: payment.id, instalmentId: p.id, amount: p.add },
          });
          await tx.instalment.update({
            where: { id: p.id },
            data: { receivedAmount: { increment: p.add }, receivedAt: new Date() },
          });
        }
      }

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
        entityId: createdEntryId!,
        newValue: JSON.stringify({
          customer: instalment.loan.customer.name,
          loanCode: instalment.loan.loanCode,
          delta: appliedDelta,
          totalReceived: receivedAmount,
          paymentMode,
          allocation: allocationRemark,
        }),
      },
    });
    });
  } catch (error: any) {
    if (error?.code === 'P2002' || /already recorded|duplicate|unique|fully collected/i.test(String(error?.message || ''))) {
      return { success: false, error: 'Already recorded: duplicate collection submission' };
    }
    throw error;
  }

  if (gpsTrackingEnabled && createdEntryId) {
    try {
      await Promise.all([
        verifyAndPersistCollectionLocation({
          entryId: createdEntryId,
          tenantId,
          customerId: instalment.loan.customerId,
          latitude: gpsCapture.latitude,
          longitude: gpsCapture.longitude,
        }),
        recordCollectionLocationPing({
          tenantId,
          agentId: userId,
          branchId: instalment.loan.branchId ?? null,
          capture: gpsCapture,
        }),
      ]);
    } catch (error) {
      console.error('GPS verification failed:', error);
    }
  }

  // Note: AccountEntry is NO LONGER created here. 
  // Capital reflects only upon Cash Handover or UPI Verification.
  revalidatePath('/collection');
  revalidatePath('/dashboard');
  revalidatePath(`/loans/${instalment.loan.loanCode}`);

  // ── Send Notification (Fire and Forget) ──────────────────────────────────
  if (instalment.loan.customer.phone && appliedDelta > 0) {
    const customer = instalment.loan.customer;
    const balance = Number(instalment.loan.totalPayable || 0) - Number(instalment.loan.totalCollected || 0) - appliedDelta;
    notify({
      tenantId,
      event: 'payment_received',
      phone: customer.phone,
      data: {
        name: customer.name,
        amount: appliedDelta.toLocaleString('en-IN'),
        loanCode: instalment.loan.loanCode,
        date: new Date().toLocaleDateString('en-IN'),
        balance: Math.max(0, balance).toLocaleString('en-IN'),
      },
      meta: { entityType: 'loan', entityId: instalment.loanId },
    }).catch(err => console.error('Failed to send payment receipt', err));
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
    select: { id: true, loanId: true, loan: { select: { loanCode: true } } }
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

  revalidatePath(`/loans/${instalment.loan.loanCode}`);
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

  if (!['admin', 'superadmin', 'developer'].includes(role ?? '')) {
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

    autoPostCollection({
      tenantId,
      entryId: entry.id,
      loanId: entry.loanId,
      loanCode: entry.loan.loanCode,
      amount: Number(entry.receivedAmount),
      date: new Date(),
      branchId: entry.loan.branchId,
      createdById: userId,
      paymentMode: 'upi',
    }).catch(() => {});

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

  if (!['admin', 'superadmin', 'developer'].includes(role ?? '')) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!userId) return { success: false, error: 'Unauthorized' };

  let handoverTotal = 0;
  let handoverBranchId: string | null = null;

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
      handoverTotal = totalToCollect;
      handoverBranchId = branchId;

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

    if (handoverTotal > 0) {
      autoPostCollection({
        tenantId,
        entryId: `handover-${routeId}-${agentId}-${Date.now()}`,
        loanId: routeId,
        loanCode: `Route/${routeId.slice(0, 8)}`,
        amount: handoverTotal,
        date: new Date(),
        branchId: handoverBranchId,
        createdById: userId,
        paymentMode: 'cash',
      }).catch(() => {});
    }

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

  if (!['admin', 'superadmin', 'developer'].includes(role ?? '')) {
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

