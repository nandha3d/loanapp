import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { startOfBusinessDate } from '@/lib/businessTime';

export type NotificationLogFilters = {
  channel?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  cursor?: string;
  limit: number;
};

export async function listNotificationLogs(tenantId: string, filters: NotificationLogFilters) {
  const from = filters.from ? startOfBusinessDate(filters.from) : undefined;
  const to = filters.to
    ? new Date(startOfBusinessDate(filters.to).getTime() + 24 * 60 * 60 * 1000)
    : undefined;
  if (from && to && from >= to) throw new Error('Invalid date range');

  const where: Prisma.NotificationLogWhereInput = {
    tenantId,
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(filters.search ? { OR: [
      { recipient: { contains: filters.search } },
      { event: { contains: filters.search } },
      { provider: { contains: filters.search } },
    ] } : {}),
  };
  if (filters.cursor) {
    const anchor = await prisma.notificationLog.findFirst({
      where: { id: filters.cursor, tenantId }, select: { id: true },
    });
    if (!anchor) throw new Error('Invalid cursor');
  }
  const rows = await prisma.notificationLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: filters.limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    select: {
      id: true, channel: true, recipient: true, status: true,
      errorMessage: true, entityType: true, entityId: true, event: true,
      messageBody: true, provider: true, providerMsgId: true, createdAt: true,
    },
  });
  const hasMore = rows.length > filters.limit;
  const data = hasMore ? rows.slice(0, filters.limit) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}
