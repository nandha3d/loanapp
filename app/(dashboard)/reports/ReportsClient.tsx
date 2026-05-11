'use client';

import { formatCurrency, calcPercentage } from '@/lib/utils';
import Link from 'next/link';

export default function ReportsClient({
  collectionEfficiency,
  agingBuckets,
  penaltyReport,
  disbursement,
  agentPerformance,
  routes,
  agents,
  currencySymbol,
  filters,
}: {
  collectionEfficiency: { expected: number; collected: number; efficiency: number };
  agingBuckets: {
    short: { count: number; penalty: number; customers: string[] };
    medium: { count: number; penalty: number; customers: string[] };
    long: { count: number; penalty: number; customers: string[] };
  };
  penaltyReport: { accrued: number; settled: number; waived: number };
  disbursement: { count: number; totalPrincipal: number };
  agentPerformance: { id: string; name: string; route: string; customers: number; expected: number; collected: number; hitRate: number }[];
  routes: any[];
  agents: any[];
  currencySymbol: string;
  filters: { from: string; to: string; routeId: string; agentId: string };
}) {
  const setPreset = (preset: string) => {
    const today = new Date();
    let from: string;
    const to = today.toISOString().split('T')[0];

    if (preset === 'today') {
      from = to;
    } else if (preset === 'week') {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      from = w.toISOString().split('T')[0];
    } else {
      const m = new Date(today);
      m.setMonth(m.getMonth() - 1);
      from = m.toISOString().split('T')[0];
    }

    window.location.href = `/reports?from=${from}&to=${to}&routeId=${filters.routeId}&agentId=${filters.agentId}`;
  };

  return (
    <>
      {/* Filter Controls */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <form className="filter-bar" method="GET" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPreset('today')}>Today</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreset('week')}>This Week</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreset('month')}>This Month</button>
          </div>
          <input type="date" name="from" className="form-control" style={{ width: 'auto' }} defaultValue={filters.from} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>to</span>
          <input type="date" name="to" className="form-control" style={{ width: 'auto' }} defaultValue={filters.to} />
          <select name="routeId" className="form-control" style={{ width: 'auto' }} defaultValue={filters.routeId}>
            <option value="">All Routes</option>
            {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select name="agentId" className="form-control" style={{ width: 'auto' }} defaultValue={filters.agentId}>
            <option value="">All Agents</option>
            {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="submit" className="btn btn-secondary">Apply</button>
        </form>
      </div>

      {/* Row 1: Collection Efficiency + Defaulter Aging */}
      <div className="grid-2" style={{ marginBottom: '20px' }}>
        {/* Collection Efficiency */}
        <div className="card">
          <div className="card-header"><h3>📊 Collection Efficiency</h3></div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '16px' }}>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{formatCurrency(collectionEfficiency.expected, currencySymbol)}</div>
              <div className="stat-label">Expected</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--success)' }}>{formatCurrency(collectionEfficiency.collected, currencySymbol)}</div>
              <div className="stat-label">Collected</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: collectionEfficiency.efficiency >= 80 ? 'var(--success)' : 'var(--danger)' }}>
                {collectionEfficiency.efficiency}%
              </div>
              <div className="stat-label">Efficiency</div>
            </div>
          </div>
          {/* Visual bar */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>Collection Progress</span>
              <span>{collectionEfficiency.efficiency}%</span>
            </div>
            <div className="progress" style={{ width: '100%', height: '12px' }}>
              <div className="progress-fill" style={{ width: `${Math.min(collectionEfficiency.efficiency, 100)}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'var(--text-light)', marginTop: '6px' }}>
              <span>Gap: {formatCurrency(collectionEfficiency.expected - collectionEfficiency.collected, currencySymbol)}</span>
              <span>Target: {formatCurrency(collectionEfficiency.expected, currencySymbol)}</span>
            </div>
          </div>
        </div>

        {/* Defaulter Aging */}
        <div className="card">
          <div className="card-header"><h3>⏳ Defaulter Aging Report</h3></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Aging Bucket</th><th>Count</th><th>Total Penalty</th><th>Customers</th></tr></thead>
              <tbody>
                <tr>
                  <td><span className="badge badge-pending">0–7 days</span></td>
                  <td><strong>{agingBuckets.short.count}</strong></td>
                  <td>{formatCurrency(agingBuckets.short.penalty, currencySymbol)}</td>
                  <td>{agingBuckets.short.customers.join(', ') || '—'}</td>
                </tr>
                <tr>
                  <td><span className="badge badge-missed">8–30 days</span></td>
                  <td><strong>{agingBuckets.medium.count}</strong></td>
                  <td>{formatCurrency(agingBuckets.medium.penalty, currencySymbol)}</td>
                  <td>{agingBuckets.medium.customers.join(', ') || '—'}</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ background: '#450a0a', color: '#fca5a5' }}>30+ days</span></td>
                  <td><strong>{agingBuckets.long.count}</strong></td>
                  <td>{formatCurrency(agingBuckets.long.penalty, currencySymbol)}</td>
                  <td>{agingBuckets.long.customers.join(', ') || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 2: Penalty Report + Loan Disbursement */}
      <div className="grid-2" style={{ marginBottom: '20px' }}>
        {/* Penalty Report */}
        <div className="card">
          <div className="card-header"><h3>⚡ Penalty Report</h3></div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--danger)' }}>{formatCurrency(penaltyReport.accrued, currencySymbol)}</div>
              <div className="stat-label">Accrued</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--success)' }}>{formatCurrency(penaltyReport.settled, currencySymbol)}</div>
              <div className="stat-label">Settled</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: '#8B5CF6' }}>{formatCurrency(penaltyReport.waived, currencySymbol)}</div>
              <div className="stat-label">Waived</div>
            </div>
          </div>
          <div style={{ marginTop: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>
              Net Outstanding: <strong style={{ color: 'var(--danger)' }}>{formatCurrency(penaltyReport.accrued - penaltyReport.settled - penaltyReport.waived, currencySymbol)}</strong>
            </div>
            <div className="progress" style={{ width: '100%', height: '8px', marginTop: '8px' }}>
              <div className="progress-fill" style={{ width: `${penaltyReport.accrued > 0 ? calcPercentage(penaltyReport.settled + penaltyReport.waived, penaltyReport.accrued) : 0}%`, background: 'var(--success)' }} />
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginTop: '4px' }}>
              {penaltyReport.accrued > 0 ? calcPercentage(penaltyReport.settled + penaltyReport.waived, penaltyReport.accrued) : 0}% resolved
            </div>
          </div>
        </div>

        {/* Loan Disbursement */}
        <div className="card">
          <div className="card-header"><h3>💰 Loan Disbursement</h3></div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.8rem' }}>{disbursement.count}</div>
              <div className="stat-label">New Loans This Period</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--primary-dark)' }}>{formatCurrency(disbursement.totalPrincipal, currencySymbol)}</div>
              <div className="stat-label">Total Principal Out</div>
            </div>
          </div>
          <div style={{ marginTop: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>
              Average Loan Size: <strong>{disbursement.count > 0 ? formatCurrency(Math.round(disbursement.totalPrincipal / disbursement.count), currencySymbol) : '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="card">
        <div className="card-header"><h3>👤 Agent Performance</h3></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Agent</th><th>Route</th><th>Customers</th><th>Expected</th><th>Collected</th><th>Hit Rate</th><th>Performance</th></tr>
            </thead>
            <tbody>
              {agentPerformance.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.name}</strong></td>
                  <td>{a.route}</td>
                  <td>{a.customers}</td>
                  <td>{formatCurrency(a.expected, currencySymbol)}</td>
                  <td>{formatCurrency(a.collected, currencySymbol)}</td>
                  <td>{a.hitRate}%</td>
                  <td>
                    <div className="progress" style={{ width: '120px' }}>
                      <div className="progress-fill" style={{ width: `${a.hitRate}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {agentPerformance.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)' }}>No agents found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
