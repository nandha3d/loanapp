'use server';

import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getAgentRouteIds } from '@/lib/access';

export async function submitCollectionEntry(formData: FormData) {
  const session = await auth();
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const userId = session?.user?.id;
  const role = (session?.user as any)?.role;

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const instalmentId = formData.get('instalmentId') as string;
  const receivedAmount = Number(formData.get('receivedAmount'));
  const paymentMode = formData.get('paymentMode') as string || 'cash';
  const remarks = formData.get('remarks') as string || null;

  if (!instalmentId || !receivedAmount || receivedAmount <= 0) {
    return { success: false, error: 'Invalid amount' };
  }

  // Fetch instalment with loan
  const instalment = await prisma.instalment.findUnique({
    where: { id: instalmentId },
    include: { loan: { include: { customer: true } } },
  });

  if (!instalment || instalment.loan.tenantId !== tenantId) {
    return { success: false, error: 'Instalment not found' };
  }

  // Agents must only collect for their assigned/shared routes
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

  if (instalment.status === 'paid') {
    return { success: false, error: 'Already paid' };
  }

  const dueAmount = Number(instalment.dueAmount);
  const newStatus = receivedAmount >= dueAmount ? 'paid' : 'partial';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find or create today's DailyCollection for this agent (scoped by tenant + appType)
  let dailyCollection = await prisma.dailyCollection.findFirst({
    where: { agentId: userId, date: today, tenantId, appType },
  });

  if (!dailyCollection) {
    dailyCollection = await prisma.dailyCollection.create({
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

  // Create collection entry
  const entry = await prisma.collectionEntry.create({
    data: {
      collectionId: dailyCollection.id,
      customerId: instalment.loan.customerId,
      loanId: instalment.loanId,
      dueAmount,
      receivedAmount,
      paymentMode,
      remarks,
      agentId: userId,
    },
  });

  // Update instalment
  await prisma.instalment.update({
    where: { id: instalmentId },
    data: {
      receivedAmount,
      paymentMode,
      remarks,
      status: newStatus,
      receivedAt: new Date(),
      agentId: userId,
      collectionEntryId: entry.id,
    },
  });

  // Recalculate loan totals
  const allInstalments = await prisma.instalment.findMany({
    where: { loanId: instalment.loanId },
  });

  const paidCount = allInstalments.filter(
    (i) => i.id === instalmentId ? newStatus === 'paid' : i.status === 'paid'
  ).length;

  const totalCollected = allInstalments.reduce((sum, i) => {
    if (i.id === instalmentId) return sum + receivedAmount;
    return sum + Number(i.receivedAmount);
  }, 0);

  const allPaid = paidCount === allInstalments.length;

  await prisma.loan.update({
    where: { id: instalment.loanId },
    data: {
      paidCount,
      totalCollected,
      ...(allPaid ? { status: 'closed', closedAt: new Date() } : {}),
    },
  });

  // Update daily collection totals
  const allEntries = await prisma.collectionEntry.findMany({
    where: { collectionId: dailyCollection.id },
  });

  await prisma.dailyCollection.update({
    where: { id: dailyCollection.id },
    data: {
      totalCollected: allEntries.reduce((s, e) => s + Number(e.receivedAmount), 0),
      totalExpected: allEntries.reduce((s, e) => s + Number(e.dueAmount), 0),
      entriesCount: allEntries.length,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'create',
      entityType: 'collection',
      entityId: entry.id,
      newValue: JSON.stringify({
        customer: instalment.loan.customer.name,
        loanCode: instalment.loan.loanCode,
        receivedAmount,
        paymentMode,
      }),
    },
  });

  revalidatePath('/collection');
  revalidatePath('/dashboard');
  return { success: true };
}
