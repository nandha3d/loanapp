'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getAgentRouteIds } from '@/lib/access';
import {
  allocatePaymentsAcrossInstalments,
  describeAllocationForPayment,
  reallocateLoanRepayments,
} from '@/lib/repayments';

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

  if (!instalmentId || !receivedAmount || receivedAmount <= 0) {
    return { success: false, error: 'Invalid amount' };
  }

  const instalment = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    include: { loan: { include: { customer: true } } },
  });

  if (!instalment || instalment.loan.tenantId !== tenantId) {
    return { success: false, error: 'Instalment not found' };
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

  const paymentAmount = receivedAmount;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.$transaction(async (tx) => {
    let dailyCollection = await tx.dailyCollection.findFirst({
      where: { agentId: userId, date: today, tenantId },
    });

    if (!dailyCollection) {
      dailyCollection = await tx.dailyCollection.create({
        data: {
          tenantId,
          branchId: instalment.loan.branchId,
          agentId: userId,
          routeId: instalment.loan.customer.routeId,
          date: today,
          totalExpected: 0,
          totalCollected: 0,
          entriesCount: 0,
          appType,
          status: 'open',
        },
      });
    }

    const [loanInstalments, existingEntries] = await Promise.all([
      tx.instalment.findMany({
        where: { loanId: instalment.loanId },
        orderBy: [{ dueDate: 'asc' }, { instalmentNo: 'asc' }],
        select: { id: true, instalmentNo: true, dueDate: true, dueAmount: true },
      }),
      tx.collectionEntry.findMany({
        where: { loanId: instalment.loanId },
        select: { receivedAmount: true },
      }),
    ]);
    const previousTotal = existingEntries.reduce((sum, entry) => sum + Number(entry.receivedAmount), 0);
    const beforeAllocation = allocatePaymentsAcrossInstalments(loanInstalments, previousTotal);
    const afterAllocation = allocatePaymentsAcrossInstalments(loanInstalments, previousTotal + paymentAmount);
    const allocationRemark = describeAllocationForPayment(beforeAllocation, afterAllocation);
    const mergedRemarks = [remarks, allocationRemark].filter(Boolean).join(' | ');

    const entry = await tx.collectionEntry.create({
      data: {
        collectionId: dailyCollection.id,
        customerId: instalment.loan.customerId,
        loanId: instalment.loanId,
        dueAmount: Number(instalment.dueAmount),
        receivedAmount: paymentAmount,
        paymentMode,
        remarks: mergedRemarks,
        agentId: userId,
      },
    });

    await reallocateLoanRepayments(tx, instalment.loanId);

    const allEntries = await tx.collectionEntry.findMany({
      where: { collectionId: dailyCollection.id },
    });

    await tx.dailyCollection.update({
      where: { id: dailyCollection.id },
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
        action: 'create',
        entityType: 'collection',
        entityId: entry.id,
        newValue: JSON.stringify({
          customer: instalment.loan.customer.name,
          loanCode: instalment.loan.loanCode,
          receivedAmount: paymentAmount,
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
