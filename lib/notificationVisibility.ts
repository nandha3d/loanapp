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

  if (input.activeBranchId) {
    genericScope.OR = [
      { branchId: input.activeBranchId },
      { branchId: null },
    ];
  }

  where.OR = input.userId
    ? [
        { targetUserId: input.userId },
        genericScope,
      ]
    : [genericScope];

  return where;
}
