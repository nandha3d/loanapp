import 'server-only';
import prisma from '../db';
import { sendPushToUsers } from './channels/push';

export type UserNotifyInput = {
  tenantId: string;
  /** Notify one specific app user… */
  targetUserId?: string | null;
  /** …or broadcast to a role within the tenant (optionally a branch). */
  targetRole?: string | null;
  branchId?: string | null;
  appType?: string;
  type: string;
  title: string;
  message: string;
  icon?: string | null;
  link?: string | null;
};

/**
 * Creates an in-app SystemNotification AND pushes it to the target user(s)'
 * devices via FCM. Use this for staff/agent/admin notifications (approvals,
 * collections, penalties, requests…). Never throws.
 */
export async function notifyUser(input: UserNotifyInput): Promise<void> {
  // 1. In-app notification (the 🔔 bell).
  try {
    await prisma.systemNotification.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId ?? null,
        targetUserId: input.targetUserId ?? null,
        targetRole: input.targetRole ?? null,
        appType: input.appType ?? 'microlending',
        type: input.type,
        icon: input.icon ?? null,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      },
    });
  } catch (e) {
    console.error('[notifyUser] in-app create failed', e);
  }

  // 2. Push to the resolved user(s)' devices.
  try {
    let userIds: string[] = [];
    if (input.targetUserId) {
      userIds = [input.targetUserId];
    } else if (input.targetRole) {
      const users = await prisma.user.findMany({
        where: {
          tenantId: input.tenantId,
          role: input.targetRole,
          status: 'active',
          ...(input.branchId ? { branchId: input.branchId } : {}),
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }
    if (userIds.length) {
      await sendPushToUsers(userIds, {
        title: input.title,
        body: input.message,
        link: input.link ?? undefined,
        data: { type: input.type, ...(input.link ? { link: input.link } : {}) },
      });
    }
  } catch (e) {
    console.error('[notifyUser] push dispatch failed', e);
  }
}
