import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';

interface Props {
  params: Promise<{ module: string }>;
}

export default async function NotificationLogPage({ params }: Props) {
  const { module } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === 'agent') {
    redirect(`/${module}/agent-dashboard`);
  }

  const tenantId = await getDefaultTenantId();

  const logs = await prisma.notificationLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

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
      
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Time</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Channel</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Recipient</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Event</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '12px 8px' }}>Error Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '12px 8px' }}>
                  {new Date(log.createdAt).toLocaleString('en-IN')}
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
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>
                  No notifications sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
