import 'server-only';
import prisma from '../db';
import { sendPushToUsers } from './channels/push';

export type UserNotifyInput = {
  tenantId: string;
  /** Notify one specific app user… */
  targetUserId?: string | null;
  /** …or broadcast to a role within the tenant (optionally a branch). */
  targetRole?: string | null;
  /** Stamped on the notification row itself. */
  branchId?: string | null;
  /**
   * Branches whose users should RECEIVE a role broadcast. Defaults to
   * `[branchId]`. Kept separate from `branchId` because the branch a record
   * belongs to and the branches whose admins supervise it are not always the
   * same — see `branchReachWhere` in lib/branchScope.ts.
   */
  recipientBranchIds?: Array<string | null | undefined>;
  /**
   * When branch-scoping a role broadcast, also reach users of that role who have
   * no branch assigned. Without this an admin whose `branchId` is null silently
   * receives nothing, since every branch-scoped broadcast filters them out.
   */
  includeUnassignedBranch?: boolean;
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
 *
 * Notifications are ALWAYS per-user: a `targetRole` broadcast fans out into one
 * row PER matching user (each owns its own read state) — never a single shared
 * role row. So one user reading a notification never marks it read for others.
 *
 * Returns how many users were reached, so callers can detect a broadcast that
 * landed on nobody and fall back rather than dropping it silently.
 */
export async function notifyUser(input: UserNotifyInput): Promise<number> {
  // Resolve the concrete recipient user IDs.
  let userIds: string[] = [];
  try {
    if (input.targetUserId) {
      userIds = [input.targetUserId];
    } else if (input.targetRole) {
      const branchIds = Array.from(
        new Set(
          (input.recipientBranchIds ?? [input.branchId]).filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
          ),
        ),
      );
      let branchScope: any = {};
      if (branchIds.length > 0) {
        const clauses: any[] = [{ branchId: { in: branchIds } }];
        if (input.includeUnassignedBranch) clauses.push({ branchId: null });
        branchScope = clauses.length > 1 ? { OR: clauses } : clauses[0];
      }
      const users = await prisma.user.findMany({
        where: {
          tenantId: input.tenantId,
          role: input.targetRole,
          status: 'active',
          ...branchScope,
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }
  } catch (e) {
    console.error('[notifyUser] recipient resolution failed', e);
  }

  if (userIds.length === 0) return 0;

  // 1. One in-app notification PER user (per-user read state; no shared row).
  try {
    await prisma.systemNotification.createMany({
      data: userIds.map((uid) => ({
        tenantId: input.tenantId,
        branchId: input.branchId ?? null,
        targetUserId: uid,
        targetRole: null,
        appType: input.appType ?? 'microlending',
        type: input.type,
        icon: input.icon ?? null,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      })),
    });
  } catch (e) {
    console.error('[notifyUser] in-app create failed', e);
  }

  // 2. Push to those users' devices.
  try {
    await sendPushToUsers(userIds, {
      title: input.title,
      body: input.message,
      link: input.link ?? undefined,
      data: { type: input.type, ...(input.link ? { link: input.link } : {}) },
    });
  } catch (e) {
    console.error('[notifyUser] push dispatch failed', e);
  }

  return userIds.length;
}
