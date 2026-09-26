'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { getPremiumTenantId } from '../access';
import { getActiveBranchId } from '@/lib/branch';
import { redirect } from 'next/navigation';
import { PremiumAccountingServiceError, reviewPremiumApproval } from '@/lib/accounting/premiumMobileService';

export async function listApprovals(filter?: { status?: string; entityType?: string; level?: number }) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getPremiumTenantId();
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();
  const role = (session.user as any)?.role;

  // Admin sees only their own submissions; superadmin/developer see all.
  const where: any = {
    tenantId,
    appType,
    ...(branchId ? { branchId } : {}),
    status: filter?.status || undefined,
    entityType: filter?.entityType || undefined,
    level: filter?.level || undefined,
  };
  if (role === 'admin') where.requestedById = session.user!.id!;

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

async function review(approvalId: string, action: 'approve' | 'reject' | 'cancel', note?: string) {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getPremiumTenantId();
  const [appType, branchId] = await Promise.all([getUserAppType(), getActiveBranchId()]);
  try {
    const result = await reviewPremiumApproval({
      tenantId,
      appType,
      branchId,
      userId: session.user!.id!,
      role: (session.user as any)?.role,
    }, { approvalId, action, note });
    return action === 'approve' ? { ok: true, data: { routedToL2: result.routedToL2 ?? false } } : { ok: true };
  } catch (error) {
    if (error instanceof PremiumAccountingServiceError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function approve(approvalId: string, note?: string) {
  return review(approvalId, 'approve', note);
}

export async function reject(approvalId: string, note: string) {
  return review(approvalId, 'reject', note);
}

export async function cancel(approvalId: string) {
  return review(approvalId, 'cancel');
}
