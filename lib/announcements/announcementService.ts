import prisma from '@/lib/db';
import { notifyUser } from '@/lib/notify/userNotify';

export type TargetScope = 'all' | 'role' | 'subscription' | 'geo' | 'selected' | 'single' | 'tenant' | 'branch';
export type AnnouncementType = 'info' | 'update' | 'warning' | 'critical' | 'celebration';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  type?: AnnouncementType;
  priority?: PriorityLevel;
  targetScope: TargetScope;
  targetRole?: string | null;
  targetSubscription?: string | null;
  targetGeo?: string | null;
  targetTenantId?: string | null;
  targetBranchId?: string | null;
  targetUserIds?: string[];
  isScrollingBar?: boolean;
  isPopup?: boolean;
  popupStyle?: 'box_75' | 'full_page' | 'standard' | string;
  contentType?: 'standard' | 'template' | 'custom_html' | 'embed_url' | string;
  templateId?: string | null;
  customHtml?: string | null;
  embedUrl?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  expiresAt?: string | null;
  status?: 'published' | 'draft';
}

/**
 * Resolves list of users matching target criteria.
 */
export async function resolveTargetUsers(input: {
  targetScope: TargetScope;
  targetRole?: string | null;
  targetSubscription?: string | null;
  targetGeo?: string | null;
  targetTenantId?: string | null;
  targetBranchId?: string | null;
  targetUserIds?: string[];
}): Promise<Array<{ id: string; name: string; username: string; role: string; tenantId: string; phone: string }>> {
  const { targetScope, targetRole, targetSubscription, targetGeo, targetTenantId, targetBranchId, targetUserIds } = input;

  // 1. Selected specific users or Single user
  if ((targetScope === 'selected' || targetScope === 'single') && targetUserIds && targetUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: targetUserIds },
        status: 'active',
      },
      select: { id: true, name: true, username: true, role: true, tenantId: true, phone: true },
    });
    return users;
  }

  // 2. Filter by Subscription Tier
  if (targetScope === 'subscription' && targetSubscription) {
    // Find tenants matching subscription plan
    const subClauses: any = { status: 'active' };
    if (targetSubscription === 'yearly' || targetSubscription === 'monthly') {
      subClauses.billingCycle = targetSubscription;
    } else {
      subClauses.plan = targetSubscription;
    }

    const subscriptions = await prisma.tenantSubscription.findMany({
      where: subClauses,
      select: { tenantId: true },
    });
    const tenantIds = subscriptions.map((s) => s.tenantId);
    if (tenantIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: {
        tenantId: { in: tenantIds },
        status: 'active',
        ...(targetRole ? { role: targetRole } : {}),
      },
      select: { id: true, name: true, username: true, role: true, tenantId: true, phone: true },
    });
    return users;
  }

  // 3. Filter by Geography / Location
  if (targetScope === 'geo' && targetGeo) {
    const geoQuery = targetGeo.trim();
    // Search branches whose address contains the geo text
    const branches = await prisma.branch.findMany({
      where: {
        OR: [
          { address: { contains: geoQuery } },
          { name: { contains: geoQuery } },
        ],
        status: 'active',
      },
      select: { id: true, tenantId: true },
    });

    const branchIds = branches.map((b) => b.id);
    if (branchIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: {
        branchId: { in: branchIds },
        status: 'active',
        ...(targetRole ? { role: targetRole } : {}),
      },
      select: { id: true, name: true, username: true, role: true, tenantId: true, phone: true },
    });
    return users;
  }

  // 4. Filter by Branch
  if (targetScope === 'branch' && targetBranchId) {
    const users = await prisma.user.findMany({
      where: {
        branchId: targetBranchId,
        status: 'active',
        ...(targetRole ? { role: targetRole } : {}),
      },
      select: { id: true, name: true, username: true, role: true, tenantId: true, phone: true },
    });
    return users;
  }

  // 5. Filter by Tenant
  if (targetScope === 'tenant' && targetTenantId) {
    const users = await prisma.user.findMany({
      where: {
        tenantId: targetTenantId,
        status: 'active',
        ...(targetRole ? { role: targetRole } : {}),
      },
      select: { id: true, name: true, username: true, role: true, tenantId: true, phone: true },
    });
    return users;
  }

  // 6. Filter by Role across all tenants
  if (targetScope === 'role' && targetRole) {
    const users = await prisma.user.findMany({
      where: {
        role: targetRole,
        status: 'active',
      },
      select: { id: true, name: true, username: true, role: true, tenantId: true, phone: true },
    });
    return users;
  }

  // 7. Default: ALL users across all tenants
  const allUsers = await prisma.user.findMany({
    where: {
      status: 'active',
      ...(targetRole ? { role: targetRole } : {}),
    },
    select: { id: true, name: true, username: true, role: true, tenantId: true, phone: true },
  });
  return allUsers;
}

/**
 * Creates and publishes an announcement.
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput,
  author: { id: string; name: string },
) {
  const isDraft = input.status === 'draft';
  const targetUsers = await resolveTargetUsers({
    targetScope: input.targetScope,
    targetRole: input.targetRole,
    targetSubscription: input.targetSubscription,
    targetGeo: input.targetGeo,
    targetTenantId: input.targetTenantId,
    targetBranchId: input.targetBranchId,
    targetUserIds: input.targetUserIds,
  });

  const parsedExpiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const announcement = await prisma.announcement.create({
    data: {
      title: input.title,
      message: input.message,
      type: input.type || 'info',
      priority: input.priority || 'normal',
      targetScope: input.targetScope,
      targetRole: input.targetRole || null,
      targetSubscription: input.targetSubscription || null,
      targetGeo: input.targetGeo || null,
      targetTenantId: input.targetTenantId || null,
      targetBranchId: input.targetBranchId || null,
      displayType: input.isScrollingBar && input.isPopup ? 'all' : input.isScrollingBar ? 'scrolling_bar' : input.isPopup ? 'popup' : 'notification',
      isScrollingBar: input.isScrollingBar ?? true,
      isPopup: input.isPopup ?? true,
      popupStyle: input.popupStyle || 'box_75',
      contentType: input.contentType || 'standard',
      templateId: input.templateId || null,
      customHtml: input.customHtml || null,
      embedUrl: input.embedUrl || null,
      actionLabel: input.actionLabel || null,
      actionUrl: input.actionUrl || null,
      status: input.status || 'published',
      expiresAt: parsedExpiresAt,
      authorId: author.id,
      authorName: author.name,
      totalTargeted: targetUsers.length,
      totalRead: 0,
      totalDismissed: 0,
    },
  });

  // If published, fan out recipients and in-app system notifications
  if (!isDraft && targetUsers.length > 0) {
    // 1. Bulk insert AnnouncementRecipient rows
    const recipientData = targetUsers.map((u) => ({
      announcementId: announcement.id,
      userId: u.id,
      tenantId: u.tenantId,
      isRead: false,
      isDismissed: false,
    }));

    await prisma.announcementRecipient.createMany({
      data: recipientData,
      skipDuplicates: true,
    });

    // 2. Also fan out into SystemNotification for in-app notification bell & mobile push
    const now = new Date();
    await prisma.systemNotification.createMany({
      data: targetUsers.map((u) => ({
        tenantId: u.tenantId,
        targetUserId: u.id,
        type: `announcement_${input.type || 'info'}`,
        icon: input.type === 'critical' ? 'error' : input.type === 'warning' ? 'warning' : input.type === 'celebration' ? 'celebration' : 'campaign',
        title: input.title,
        message: input.message.length > 250 ? `${input.message.slice(0, 247)}...` : input.message,
        link: input.actionUrl || null,
        expiresAt: parsedExpiresAt,
        createdAt: now,
      })),
    });
  }

  return announcement;
}

/**
 * Returns active announcements applicable for a specific user.
 */
export async function getActiveUserAnnouncements(userId: string) {
  const now = new Date();

  // Find undismissed recipient entries
  const recipientEntries = await prisma.announcementRecipient.findMany({
    where: {
      userId,
      isDismissed: false,
      announcement: {
        status: 'published',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    },
    include: {
      announcement: true,
    },
    orderBy: {
      announcement: { createdAt: 'desc' },
    },
    take: 10,
  });

  const scrollingBarList: any[] = [];
  const popupList: any[] = [];

  for (const entry of recipientEntries) {
    const a = entry.announcement;
    const item = {
      id: a.id,
      recipientId: entry.id,
      title: a.title,
      message: a.message,
      type: a.type,
      priority: a.priority,
      isScrollingBar: a.isScrollingBar,
      isPopup: a.isPopup,
      popupStyle: a.popupStyle || 'box_75',
      contentType: a.contentType || 'standard',
      templateId: a.templateId,
      customHtml: a.customHtml,
      embedUrl: a.embedUrl,
      actionLabel: a.actionLabel,
      actionUrl: a.actionUrl,
      isRead: entry.isRead,
      createdAt: a.createdAt,
    };

    if (a.isScrollingBar) {
      scrollingBarList.push(item);
    }
    // Show in popup if not read yet, or popup enabled and priority is high/urgent/normal
    if (a.isPopup && !entry.isRead) {
      popupList.push(item);
    }
  }

  return {
    scrollingAnnouncements: scrollingBarList,
    popupAnnouncements: popupList,
  };
}

/**
 * Marks an announcement as dismissed for a specific user.
 */
export async function dismissAnnouncement(announcementId: string, userId: string) {
  const res = await prisma.announcementRecipient.updateMany({
    where: {
      announcementId,
      userId,
    },
    data: {
      isDismissed: true,
      dismissedAt: new Date(),
      isRead: true,
      readAt: new Date(),
    },
  });

  if (res.count > 0) {
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        totalDismissed: { increment: 1 },
        totalRead: { increment: 1 },
      },
    });
  }

  return { success: true };
}

/**
 * Marks an announcement as read.
 */
export async function markAnnouncementRead(announcementId: string, userId: string) {
  const res = await prisma.announcementRecipient.updateMany({
    where: {
      announcementId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  if (res.count > 0) {
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        totalRead: { increment: 1 },
      },
    });
  }

  return { success: true };
}
