import prisma from '../../db';
import { ReportBuilderParams, ReportPayload } from '../types';

export async function buildAuditActivity(params: ReportBuilderParams): Promise<ReportPayload> {
  const { tenantId, from, to, branchId, agentId, status } = params;

  const dateFrom = new Date(from);
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = new Date(to);
  dateTo.setHours(23, 59, 59, 999);

  // If status is passed, let's treat it as the 'action' filter in query params
  const actionFilter = status || undefined;

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(agentId ? { userId: agentId } : {}),
      ...(actionFilter ? { action: actionFilter } : {}),
    },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  let editCount = 0;
  let deleteCount = 0;
  const distinctUsers = new Set<string>();

  const rows = logs.map((log) => {
    distinctUsers.add(log.userId || 'system');
    
    if (log.action.toLowerCase().includes('edit') || log.action.toLowerCase().includes('update')) {
      editCount++;
    } else if (log.action.toLowerCase().includes('delete') || log.action.toLowerCase().includes('remove')) {
      deleteCount++;
    }

    const beforeStr = log.oldValue ? String(log.oldValue).slice(0, 50) : '';
    const afterStr = log.newValue ? String(log.newValue).slice(0, 50) : '';
    const change = beforeStr || afterStr ? `${beforeStr} → ${afterStr}` : '—';

    return {
      createdAt: log.createdAt,
      userName: log.user?.name || 'System',
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId || '—',
      change,
      ipAddress: log.ipAddress || '—',
    };
  });

  return {
    title: 'reports.auditActivity.title',
    columns: [
      { key: 'createdAt', label: 'reports.col.time', align: 'left', type: 'date' },
      { key: 'userName', label: 'reports.col.user', align: 'left', type: 'text' },
      { key: 'action', label: 'reports.col.action', align: 'left', type: 'badge' },
      { key: 'entityType', label: 'reports.col.entity', align: 'left', type: 'text' },
      { key: 'entityId', label: 'reports.col.entityRef', align: 'left', type: 'text' },
      { key: 'change', label: 'reports.col.change', align: 'left', type: 'text' },
      { key: 'ipAddress', label: 'reports.col.ip', align: 'left', type: 'text' },
    ],
    rows,
    kpis: [
      { label: 'totalEvents', value: logs.length },
      { label: 'editsCount', value: editCount },
      { label: 'deletesCount', value: deleteCount },
      { label: 'distinctUsers', value: distinctUsers.size },
    ],
    meta: {
      currencySymbol: '₹',
    },
  };
}
