import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { getDefaultTenantId } from '@/lib/tenant';
import { getRouteProgressForBranch } from '@/lib/gps/routeProgress';
import { getDictionary } from '@/lib/i18n';

function statusColor(status: string) {
  if (status === 'verified') return 'var(--success)';
  if (status === 'mismatch') return 'var(--danger)';
  if (status === 'location_denied' || status === 'gps_timeout') return 'var(--warning)';
  return 'var(--text-light)';
}

export default async function RouteTrackerPage() {
  const session = await auth();
  const user = session?.user as any;
  const tenantId = await getDefaultTenantId();
  const branchId = await getActiveBranchId();
  const dict = await getDictionary(tenantId);
  const d = dict.routeTracker;

  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { gpsTrackingEnabled: true },
  });

  if (!subscription?.gpsTrackingEnabled) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>{d.title}</h3>
        </div>
        <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>
          {d.notEnabled}
        </div>
      </div>
    );
  }

  if (!['admin', 'superadmin', 'developer'].includes(user?.role)) {
    return (
      <div className="card">
        <div style={{ padding: '20px', color: 'var(--danger)' }}>{d.unauthorized}</div>
      </div>
    );
  }

  const agents = await getRouteProgressForBranch({ tenantId, branchId });

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div className="page-header">
        <div>
          <h1>{d.title}</h1>
          <p>{d.subtitle}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59,130,246,.12)', color: 'var(--info)' }}>
            <span className="material-icons-outlined">groups</span>
          </div>
          <div>
            <p>{d.agents}</p>
            <h3>{agents.length}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(34,197,94,.12)', color: 'var(--success)' }}>
            <span className="material-icons-outlined">payments</span>
          </div>
          <div>
            <p>{d.collectionsToday}</p>
            <h3>{agents.reduce((sum, agent) => sum + agent.collectionsDoneToday, 0)}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,.12)', color: 'var(--danger)' }}>
            <span className="material-icons-outlined">warning</span>
          </div>
          <div>
            <p>{d.gpsAlerts}</p>
            <h3>{agents.reduce((sum, agent) => sum + agent.alerts.length, 0)}</h3>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{d.agentMovement}</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{d.agent}</th>
                <th>{d.lastSeen}</th>
                <th>{d.collections}</th>
                <th>{d.routePoints}</th>
                <th>{d.alerts}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.agentId}>
                  <td><strong>{agent.agentName}</strong></td>
                  <td>
                    {agent.minutesSinceLastPing === null
                      ? d.noGpsToday
                      : `${agent.minutesSinceLastPing} ${d.minAgo}`}
                  </td>
                  <td>{agent.collectionsDoneToday}</td>
                  <td>{agent.path.length}</td>
                  <td>
                    {agent.alerts.length ? agent.alerts.join(', ') : '-'}
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)' }}>
                    {d.noActiveAgents}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{d.collectionGpsPoints}</h3>
        </div>
        <div style={{ display: 'grid', gap: '8px', padding: '14px' }}>
          {agents.flatMap((agent) =>
            agent.collectionPoints.map((point) => (
              <div
                key={point.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '10px',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <strong>{point.customerName}</strong>
                  <div style={{ fontSize: '.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {agent.agentName} - {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                  </div>
                </div>
                <div style={{ color: statusColor(point.locationStatus), fontWeight: 700 }}>
                  {point.locationStatus.replaceAll('_', ' ')}
                </div>
              </div>
            )),
          )}
          {agents.every((agent) => agent.collectionPoints.length === 0) && (
            <div style={{ padding: '18px', color: 'var(--text-light)', textAlign: 'center' }}>
              {d.noGpsStamped}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
