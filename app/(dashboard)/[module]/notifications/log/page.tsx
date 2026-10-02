import { listNotificationLogs } from '@/lib/notify/logs';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { getDictionary } from '@/lib/i18n';

interface Props {
  params: Promise<{ module: string }>;
  // NOT-04: same filters as GET /api/v1/notifications/log.
  searchParams?: Promise<{ channel?: string; status?: string; from?: string; to?: string; search?: string; cursor?: string }>;
}

export default async function NotificationLogPage({ params, searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const { module } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === 'agent') {
    redirect(`/${module}/agent-dashboard`);
  }

  const tenantId = await getDefaultTenantId();
  const branchId = await getActiveBranchId();

  const dict = await getDictionary(tenantId);
  const d = dict.notifications;
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  let logs: Awaited<ReturnType<typeof listNotificationLogs>>['data'] = [];
  let nextCursor: string | null = null;
  try {
    ({ data: logs, nextCursor } = await listNotificationLogs(tenantId, {
      limit: 200,
      appType: module,
      branchId: branchId || undefined,
      channel: sp.channel || undefined,
      status: sp.status || undefined,
      from: day(sp.from),
      to: day(sp.to),
      search: sp.search?.trim() || undefined,
      cursor: sp.cursor || undefined,
    }));
  } catch {
    // Invalid range or stale cursor: show an empty page with the filters.
  }
  const nextHref = nextCursor
    ? `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), cursor: nextCursor } as Record<string, string>).toString()}`
    : null;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notification Log</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
            Last 200 outbound messages (SMS, WhatsApp, and SMTP Email)
          </p>
        </div>
      </div>
      
      <form method="get" className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 12 }}>{d.logChannel}<br />
          <select name="channel" className="form-control" defaultValue={sp.channel ?? ''}>
            <option value="">{d.logAll}</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>{d.logStatus}<br />
          <select name="status" className="form-control" defaultValue={sp.status ?? ''}>
            <option value="">{d.logAll}</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }}>{d.logFrom}<br /><input type="date" name="from" className="form-control" defaultValue={sp.from ?? ''} /></label>
        <label style={{ fontSize: 12 }}>{d.logTo}<br /><input type="date" name="to" className="form-control" defaultValue={sp.to ?? ''} /></label>
        <input type="search" name="search" className="form-control" style={{ minWidth: 220 }} placeholder={d.logSearch} defaultValue={sp.search ?? ''} />
        <button type="submit" className="btn btn-primary">{d.logApply}</button>
      </form>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Time</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Channel</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Recipient</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Event</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>{d.logProvider}</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>{d.logMessage}</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Error Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '12px 8px' }}>
                  {new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <span className={`badge ${
                    log.channel === 'whatsapp' ? 'badge-active' : log.channel === 'sms' ? 'badge-pending' : 'badge-info'
                  }`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                    {log.channel}
                  </span>
                </td>
                <td style={{ fontSize: '12px', padding: '12px 8px' }}>{log.recipient}</td>
                <td style={{ fontSize: '12px', padding: '12px 8px' }}>{log.event?.replace(/_/g, ' ') ?? '-'}</td>
                <td style={{ padding: '12px 8px' }}>
                  <span className={`badge ${log.status === 'sent' ? 'badge-active' : 'badge-overdue'}`}>
                    {log.status}
                  </span>
                </td>
                <td style={{ fontSize: '12px', padding: '12px 8px' }}>{log.provider ?? '-'}</td>
                <td style={{ fontSize: '12px', padding: '12px 8px', maxWidth: '320px', whiteSpace: 'pre-wrap' }}>{log.messageBody ?? '-'}</td>
                <td style={{ 
                  fontSize: '11px', 
                  color: 'var(--danger)', 
                  maxWidth: '300px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  padding: '12px 8px' 
                }} title={log.errorMessage || ''}>
                  {log.errorMessage || '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>
                  No notifications sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nextHref && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <a className="btn btn-secondary" href={nextHref}>{d.logNext}</a>
        </div>
      )}
    </div>
  );
}
