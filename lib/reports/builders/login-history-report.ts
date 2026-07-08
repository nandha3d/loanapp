import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildLoginHistoryReport(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, agentId, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  // status is reused as the result filter ('Success' | 'Failed')
  const resultFilter = status || undefined;

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      createdAt: { gte: dateFrom, lte: dateTo },
      action: { contains: 'login' },
      ...(agentId ? { userId: agentId } : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  let loginsToday = 0;
  let failedAttempts = 0;
  const distinctUsers = new Set<string>();
  const distinctIps = new Set<string>();

  const rows = logs
    .map((log) => {
      const actionLower = log.action.toLowerCase();
      const result = actionLower.includes('fail') ? 'Failed' : 'Success';

      if (log.createdAt.toISOString().slice(0, 10) === todayKey && actionLower.includes('login')) {
        loginsToday += 1;
      }
      if (result === 'Failed') failedAttempts += 1;
      distinctUsers.add(log.userId || 'unknown');
      if (log.ipAddress) distinctIps.add(log.ipAddress);

      return {
        createdAt: log.createdAt,
        userName: log.user?.name || 'Unknown',
        action: log.action,
        ipAddress: log.ipAddress || '—',
        userAgent: log.userAgent || '—',
        result,
      };
    })
    .filter((row) => !resultFilter || row.result === resultFilter);

  return {
    title: 'reports.loginHistory.title',
    columns: [
      { key: 'createdAt', label: 'reports.col.dateTime', align: 'left', type: 'date' },
      { key: 'userName', label: 'reports.col.user', align: 'left', type: 'text' },
      { key: 'action', label: 'reports.col.event', align: 'center', type: 'badge' },
      { key: 'ipAddress', label: 'reports.col.ip', align: 'left', type: 'text' },
      { key: 'userAgent', label: 'reports.col.device', align: 'left', type: 'text' },
      { key: 'result', label: 'reports.col.result', align: 'center', type: 'badge' },
    ],
    rows,
    kpis: [
      { label: 'loginsToday', value: loginsToday },
      { label: 'failedAttempts', value: failedAttempts, tone: failedAttempts > 0 ? 'bad' : 'good' },
      { label: 'distinctUsers', value: distinctUsers.size },
      { label: 'distinctIps', value: distinctIps.size },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
