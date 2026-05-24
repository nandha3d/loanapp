import prisma from '@/lib/db';

type ApprovalNotificationTargetInput = {
  tenantId: string;
  appType: string;
  agentId: string;
  branchId?: string | null;
};

export async function findApprovalNotificationTarget({
  tenantId,
  appType,
  agentId,
  branchId,
}: ApprovalNotificationTargetInput): Promise<string | null> {
  const creatorAudit = await prisma.auditLog.findFirst({
    where: {
      tenantId,
      action: 'create',
      entityType: 'user',
      entityId: agentId,
      user: {
        role: { in: ['admin', 'superadmin', 'developer'] },
        status: 'active',
      },
    },
    select: { userId: true },
    orderBy: { createdAt: 'desc' },
  });

  if (creatorAudit?.userId) {
    return creatorAudit.userId;
  }

  if (!branchId) {
    return null;
  }

  const branchAdmin = await prisma.user.findFirst({
    where: {
      tenantId,
      branchId,
      role: 'admin',
      status: 'active',
      OR: [
        { appType },
        {
          userBranchModules: {
            some: {
              branchId,
              enabledModules: { contains: appType },
            },
          },
        },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (branchAdmin?.id) {
    return branchAdmin.id;
  }

  const branchOwner = await prisma.branch.findFirst({
    where: { id: branchId, tenantId, status: 'active' },
    select: { superadminId: true },
  });

  return branchOwner?.superadminId ?? null;
}
