export type NotificationVisibilityInput = {
  tenantId: string;
  appType: string;
  userId?: string | null;
  userRole?: string | null;
  activeBranchId?: string | null;
  unreadOnly?: boolean;
};

export function buildSystemNotificationWhere(input: NotificationVisibilityInput) {
  const where: any = {
    tenantId: input.tenantId,
    appType: input.appType,
  };

  if (input.unreadOnly) {
    where.isRead = false;
  }

  const genericScope: any = { targetUserId: null };
  if (input.userRole === 'agent') {
    genericScope.targetRole = 'agent';
  } else if (input.userRole === 'admin' || input.userRole === 'superadmin' || input.userRole === 'developer') {
    genericScope.targetRole = 'admin';
  }

  const branchOr = input.activeBranchId
    ? [{ branchId: input.activeBranchId }, { branchId: null }]
    : null;
  if (branchOr) genericScope.OR = branchOr;

  // Superadmins/developers are fanned out tenant-wide at WRITE time
  // (notifyApprovers), so the branch switcher has to filter their own rows at
  // READ time or "one branch" still shows every branch. Branch staff are already
  // branch-scoped at write time (NOTIF-6) — including an agent's cross-branch
  // ping to their own admin — so their targeted rows stay unfiltered.
  const ownScope: any = { targetUserId: input.userId };
  if (branchOr && (input.userRole === 'superadmin' || input.userRole === 'developer')) {
    ownScope.OR = branchOr;
  }

  where.OR = input.userId ? [ownScope, genericScope] : [genericScope];

  return where;
}
