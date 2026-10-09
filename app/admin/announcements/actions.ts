'use server';

import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  createAnnouncement,
  resolveTargetUsers,
  CreateAnnouncementInput,
} from '@/lib/announcements/announcementService';

async function assertDeveloper() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer' && role !== 'superadmin') {
    throw new Error('Unauthorized: Developer access required');
  }
  return session!.user as { id: string; name?: string | null };
}

export async function getAnnouncementsList(options?: {
  status?: string;
  type?: string;
  search?: string;
}) {
  await assertDeveloper();

  const where: any = {};
  if (options?.status && options.status !== 'all') {
    where.status = options.status;
  }
  if (options?.type && options.type !== 'all') {
    where.type = options.type;
  }
  if (options?.search) {
    where.OR = [
      { title: { contains: options.search } },
      { message: { contains: options.search } },
    ];
  }

  const items = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { recipients: true },
      },
    },
    take: 50,
  });

  return JSON.parse(JSON.stringify(items));
}

export async function getTargetUsersList(scope: any, filters: any) {
  await assertDeveloper();
  const users = await resolveTargetUsers({
    targetScope: scope,
    targetRole: filters?.targetRole,
    targetSubscription: filters?.targetSubscription,
    targetGeo: filters?.targetGeo,
    targetTenantId: filters?.targetTenantId,
    targetBranchId: filters?.targetBranchId,
    targetUserIds: filters?.targetUserIds,
  });
  return JSON.parse(JSON.stringify(users));
}

export async function createAnnouncementAction(input: CreateAnnouncementInput) {
  const user = await assertDeveloper();
  const res = await createAnnouncement(input, {
    id: user.id,
    name: user.name || 'Developer',
  });
  revalidatePath('/admin/announcements');
  return { success: true, id: res.id };
}

export async function archiveAnnouncementAction(id: string) {
  await assertDeveloper();
  await prisma.announcement.update({
    where: { id },
    data: { status: 'archived' },
  });
  revalidatePath('/admin/announcements');
  return { success: true };
}

export async function deleteAnnouncementAction(id: string) {
  await assertDeveloper();
  await prisma.announcement.delete({
    where: { id },
  });
  revalidatePath('/admin/announcements');
  return { success: true };
}

export async function resendAnnouncementAction(id: string) {
  await assertDeveloper();
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      recipients: {
        where: { isRead: false },
        select: { userId: true, tenantId: true },
      },
    },
  });

  if (!announcement) throw new Error('Announcement not found');

  const unreadRecipients = announcement.recipients;
  if (unreadRecipients.length > 0) {
    const now = new Date();
    await prisma.systemNotification.createMany({
      data: unreadRecipients.map((r) => ({
        tenantId: r.tenantId || 'default',
        targetUserId: r.userId,
        type: `announcement_${announcement.type}`,
        icon: 'campaign',
        title: `[Reminder] ${announcement.title}`,
        message: announcement.message.length > 250 ? `${announcement.message.slice(0, 247)}...` : announcement.message,
        link: announcement.actionUrl || null,
        expiresAt: announcement.expiresAt,
        createdAt: now,
      })),
    });
  }

  return { success: true, count: unreadRecipients.length };
}

export async function getAnnouncementRecipientsList(announcementId: string) {
  await assertDeveloper();
  const recipients = await prisma.announcementRecipient.findMany({
    where: { announcementId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          phone: true,
          branch: { select: { name: true } },
          tenant: { select: { name: true } },
        },
      },
    },
    orderBy: [{ isRead: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return JSON.parse(JSON.stringify(recipients));
}

export async function getAllDirectoryUsers() {
  await assertDeveloper();
  const users = await prisma.user.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      phone: true,
      tenantId: true,
      branchId: true,
      tenant: { select: { name: true, slug: true } },
      branch: { select: { name: true, code: true, address: true } },
    },
    orderBy: { name: 'asc' },
  });

  const branches = await prisma.branch.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, code: true, address: true },
  });

  const tenants = await prisma.tenant.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, slug: true },
  });

  return {
    users: JSON.parse(JSON.stringify(users)),
    branches: JSON.parse(JSON.stringify(branches)),
    tenants: JSON.parse(JSON.stringify(tenants)),
  };
}
