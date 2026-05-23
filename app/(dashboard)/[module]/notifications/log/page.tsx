import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSubscription } from '@/lib/subscription';
import Link from 'next/link';

export default async function NotificationLogPage({ params }: { params: { module: string } }) {
  const { module: moduleSlug } = await params;
  const session = await auth();
  const role = (session?.user as any)?.role;
  
  if (role === 'agent') {
    redirect(`/${moduleSlug}/collection`);
  }

  const tenantId = await getDefaultTenantId();
  const subscription = await getSubscription(tenantId);

  // If the developer has not enabled this add-on for the tenant, block view and show premium promo screen
  if (!subscription || !subscription.whatsappSmsEnabled) {
    return (
      <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '520px', textAlign: 'center', padding: '40px 24px', border: '1px solid var(--border)' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'var(--primary-light)', color: 'var(--primary-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <span className="material-icons-outlined" style={{ fontSize: '36px' }}>whatsapp</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>WhatsApp & SMS Notifications</h2>
          <p style={{ fontSize: '.9rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
            Automate customer communication with real-time payment receipts, overdue loan alerts, disbursement confirmations, and weekly collection summaries.
          </p>
          <div style={{
            background: 'var(--bg-muted)', padding: '16px', borderRadius: 'var(--radius)',
            fontSize: '.85rem', color: 'var(--text-light)', borderLeft: '4px solid var(--accent)',
            textAlign: 'left', marginBottom: '24px'
          }}>
            <strong>Premium Add-on Required</strong><br />
            This feature is currently locked. Please contact the system developer or administrator to activate the WhatsApp/SMS notification service for your tenant subscription.
          </div>
          <Link href={`/${moduleSlug}/settings`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
            Back to Settings
          </Link>
        </div>
      </div>
    );
  }

  const logs = await prisma.notificationLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Notification Log</h1>
          <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Audit trail of the last 100 automated messages sent to customers and agents.
          </p>
        </div>
        <Link href={`/${moduleSlug}/settings`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>settings</span>
          Settings
        </Link>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Channel</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`badge ${log.channel === 'whatsapp' ? 'badge-active' : 'badge-info'}`} style={{ textTransform: 'uppercase' }}>
                      {log.channel}
                    </span>
                  </td>
                  <td>{log.recipient}</td>
                  <td>
                    <span className={`badge ${log.status === 'sent' ? 'badge-success' : 'badge-overdue'}`} style={{ textTransform: 'capitalize' }}>
                      {log.status}
                    </span>
                  </td>
                  <td>
                    {log.entityType ? (
                      <span style={{ fontSize: '.85rem' }}>
                        {log.entityType.toUpperCase()} {log.entityId ? `#${log.entityId.slice(-6)}` : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '30px' }}>
                    No notifications sent yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
