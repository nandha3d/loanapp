import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildNotificationReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, paymentMode, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  // paymentMode is reused as the channel filter (sms/whatsapp/email/inapp);
  // status is reused as the delivery-status filter (pending/sent/delivered/failed).
  const channelFilter = paymentMode || undefined;
  const statusFilter = status || undefined;

  const logs = await prisma.notificationLog.findMany({
    where: {
      tenantId,
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(channelFilter ? { channel: channelFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  let sentCount = 0;
  let deliveredCount = 0;
  let failedCount = 0;

  const rows = logs.map((log) => {
    if (log.status === 'sent') sentCount += 1;
    else if (log.status === 'delivered') deliveredCount += 1;
    else if (log.status === 'failed') failedCount += 1;

    return {
      createdAt: log.createdAt,
      channel: log.channel,
      recipient: log.recipient,
      event: log.event || '—',
      status: log.status,
      provider: log.provider || '—',
    };
  });

  const total = logs.length;
  const deliveryRatePct =
    total > 0 ? Math.round(((sentCount + deliveredCount) / total) * 100) : 0;

  return {
    title: 'reports.notification.title',
    columns: [
      { key: 'createdAt', label: 'reports.col.dateTime', align: 'left', type: 'date' },
      { key: 'channel', label: 'reports.col.channel', align: 'center', type: 'badge' },
      { key: 'recipient', label: 'reports.col.recipient', align: 'left', type: 'text' },
      { key: 'event', label: 'reports.col.event', align: 'left', type: 'text' },
      { key: 'status', label: 'reports.col.status', align: 'center', type: 'badge' },
      { key: 'provider', label: 'reports.col.provider', align: 'left', type: 'text' },
    ],
    rows,
    kpis: [
      { label: 'sent', value: sentCount },
      { label: 'delivered', value: deliveredCount },
      { label: 'failed', value: failedCount, tone: failedCount > 0 ? 'bad' : 'good' },
      { label: 'deliveryRate', value: `${deliveryRatePct}%` },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
