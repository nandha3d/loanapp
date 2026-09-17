import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { formatCurrency } from '@/lib/utils';
import { getActiveBranchId } from '@/lib/branch';
import { branchScopeWhere } from '@/lib/branchScope';

export default async function AgentPerformanceReport() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  // A branch admin rates their own agents, not the whole tenant's (SCOPE-3).
  const activeBranchId = await getActiveBranchId();

  // Aggregate performance data per agent
  const agentStats = await prisma.user.findMany({
    where: { tenantId, appType, role: 'agent', status: 'active', ...branchScopeWhere(activeBranchId) },
    include: {
      collectionEntries: {
        where: { submittedAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } },
      }
    }
  });

  const performanceData = agentStats.map(agent => {
    const totalCollected = agent.collectionEntries.reduce((sum, e) => sum + Number(e.receivedAmount), 0);
    const totalDue = agent.collectionEntries.reduce((sum, e) => sum + Number(e.dueAmount), 0);
    const efficiency = totalDue > 0 ? (totalCollected / totalDue) * 100 : 0;

    return {
      id: agent.id,
      name: agent.name,
      username: agent.username,
      totalCollected,
      efficiency,
    };
  });

  return (
    <div className="card">
      <div className="card-header">
        <h3>📈 Agent Performance (Last 30 Days)</h3>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Agent Name</th>
              <th>Username</th>
              <th>Total Collected</th>
              <th>Efficiency</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {performanceData.map(stat => (
              <tr key={stat.id}>
                <td><strong>{stat.name}</strong></td>
                <td>{stat.username}</td>
                <td>{formatCurrency(stat.totalCollected)}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '8px', background: 'var(--bg-muted)', borderRadius: '4px' }}>
                      <div style={{ width: `${Math.min(stat.efficiency, 100)}%`, height: '100%', background: stat.efficiency > 80 ? 'var(--success)' : stat.efficiency > 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: '4px' }}></div>
                    </div>
                    <span style={{ fontSize: '.8rem' }}>{stat.efficiency.toFixed(1)}%</span>
                  </div>
                </td>
                <td>
                  <span className={`badge badge-${stat.efficiency > 80 ? 'success' : stat.efficiency > 50 ? 'warning' : 'danger'}`}>
                    {stat.efficiency > 80 ? 'Excellent' : stat.efficiency > 50 ? 'Average' : 'Poor'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
