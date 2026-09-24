import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { getActiveBranchId } from '@/lib/branch';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { getRouteProgressForBranch } from '@/lib/gps/routeProgress';
import { getDictionary } from '@/lib/i18n';
import { getSetting } from '@/lib/tenant';
import LiveMapClient from './LiveMapClient';
import AgentMovementTable from './AgentMovementTable';

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
  const appType = await getUserAppType();
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

  const agents = await getRouteProgressForBranch({ tenantId, appType, branchId });
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div className="page-header">
        <div>
          <h1>{d.title}</h1>
          <p>{d.subtitle}</p>
        </div>
      </div>

      <LiveMapClient
        currencySymbol={currencySymbol}
        agentPaths={agents.map((a) => ({
          agentId: a.agentId,
          agentName: a.agentName,
          path: a.path,
        }))}
        agentCollections={agents.map((a) => ({
          agentId: a.agentId,
          agentName: a.agentName,
          points: a.collectionPoints,
        }))}
      />

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

      <AgentMovementTable agents={agents} dict={dict} />

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
