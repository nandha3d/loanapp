'use server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { writeAuditLog } from '@/lib/accounting/premium';

export async function listApprovals(filter?: { status?: string; entityType?: string; level?: number }) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;

  // Admin sees only their own submissions; superadmin/developer see all
  const where: any = {
    tenantId,
    status: filter?.status || undefined,
    entityType: filter?.entityType || undefined,
    level: filter?.level || undefined,
  };

  if (role === 'admin') {
    where.requestedById = session.user!.id!;
  }

  return prisma.accountingApproval.findMany({
    where,
    include: {
      requestedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function approve(approvalId: string, note?: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const approval = await prisma.accountingApproval.findFirst({ where: { id: approvalId, tenantId } });
  if (!approval) return { ok: false, error: 'Not found' };
  if (approval.status !== 'pending') return { ok: false, error: 'Already processed' };

  // Check if L2 needed
  const settings = await prisma.accountingSettings.findUnique({ where: { tenantId } });
  const l2Threshold = Number(settings?.twoLevelApprovalThreshold ?? 500000);
  const amount = Number(approval.amount);

  if (approval.level === 1 && amount > l2Threshold && role === 'superadmin') {
    // Route to L2
    await prisma.$transaction([
      prisma.accountingApproval.update({ where: { id: approvalId }, data: { status: 'approved', approvedById: session.user!.id!, reviewNote: note, reviewedAt: new Date() } }),
      prisma.accountingApproval.create({
        data: { tenantId, entityType: approval.entityType, entityId: approval.entityId, amount: approval.amount, level: 2, approverRole: 'developer', requestedById: approval.requestedById },
      }),
    ]);
    await writeAuditLog({ tenantId, userId: session.user?.id, action: 'approve', entityType: approval.entityType, entityId: approval.entityId, reason: `L1 approved → routed to L2. ${note ?? ''}` });
    return { ok: true, data: { routedToL2: true } };
  }

  // Final approval — post the entity
  await prisma.accountingApproval.update({
    where: { id: approvalId },
    data: { status: 'approved', approvedById: session.user!.id!, reviewNote: note, reviewedAt: new Date() },
  });

  // Post the underlying entity
  if (approval.entityType === 'journal_entry') {
    const count = await prisma.journalEntry.count({ where: { tenantId } });
    const je = await prisma.journalEntry.findFirst({ where: { id: approval.entityId, tenantId }, include: { lines: true } });
    if (je && je.status === 'pending_approval') {
      const fyKey = je.entryDate ? `${new Date(je.entryDate).getFullYear()}${String(new Date(je.entryDate).getFullYear() + 1).slice(-2)}` : '202627';
      const entryNo = `JE-${fyKey}-${String(count).padStart(4, '0')}`;
      await prisma.journalEntry.update({
        where: { id: approval.entityId },
        data: { status: 'posted', entryNo },
      });
    }
  } else if (approval.entityType === 'bill') {
    const bill = await prisma.bill.findFirst({ where: { id: approval.entityId, tenantId } });
    if (bill && bill.status === 'pending_approval') {
      await prisma.bill.update({ where: { id: approval.entityId }, data: { status: 'unpaid' } });
    }
  }

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'approve', entityType: approval.entityType, entityId: approval.entityId, reason: note });
  return { ok: true, data: { routedToL2: false } };
}

export async function reject(approvalId: string, note: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as any)?.role;
  if (!['superadmin','developer'].includes(role)) return { ok: false, error: 'Insufficient role' };

  const approval = await prisma.accountingApproval.findFirst({ where: { id: approvalId, tenantId } });
  if (!approval) return { ok: false, error: 'Not found' };

  await prisma.accountingApproval.update({
    where: { id: approvalId },
    data: { status: 'rejected', approvedById: session.user!.id!, reviewNote: note, reviewedAt: new Date() },
  });

  // Update entity status
  if (approval.entityType === 'journal_entry') {
    await prisma.journalEntry.update({ where: { id: approval.entityId }, data: { status: 'rejected' } });
  } else if (approval.entityType === 'bill') {
    await prisma.bill.update({ where: { id: approval.entityId }, data: { status: 'draft' } });
  }

  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'reject', entityType: approval.entityType, entityId: approval.entityId, reason: note });
  return { ok: true };
}

export async function cancel(approvalId: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();

  const approval = await prisma.accountingApproval.findFirst({ where: { id: approvalId, tenantId, requestedById: session.user!.id! } });
  if (!approval) return { ok: false, error: 'Not found or not yours' };
  if (approval.status !== 'pending') return { ok: false, error: 'Already processed' };

  await prisma.accountingApproval.update({ where: { id: approvalId }, data: { status: 'cancelled' } });
  await writeAuditLog({ tenantId, userId: session.user?.id, action: 'cancel', entityType: approval.entityType, entityId: approval.entityId });
  return { ok: true };
}
