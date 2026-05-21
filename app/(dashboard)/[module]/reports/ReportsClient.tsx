'use client';

import { formatCurrency, calcPercentage } from '@/lib/utils';
import Link from '@/components/layout/DashboardLink';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
  dict,
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
  dict: any;
}) {
  const d = dict.reports;
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
        <form className="filter-bar" method="GET" style={{ marginBottom: 0 }} suppressHydrationWarning>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPreset('today')}>{d.today}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreset('week')}>{d.thisWeek}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreset('month')}>{d.thisMonth}</button>
          </div>
          <input type="date" name="from" className="form-control" style={{ width: 'auto' }} defaultValue={filters.from} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{d.to}</span>
          <input type="date" name="to" className="form-control" style={{ width: 'auto' }} defaultValue={filters.to} />
          <select name="routeId" className="form-control" style={{ width: 'auto' }} defaultValue={filters.routeId}>
            <option value="">{d.allRoutes}</option>
            {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select name="agentId" className="form-control" style={{ width: 'auto' }} defaultValue={filters.agentId}>
            <option value="">{d.allAgents}</option>
            {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="submit" className="btn btn-secondary">{d.apply}</button>
        </form>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <a
            href={`/api/export/collections?from=${filters.from}&to=${filters.to}`}
            className="btn btn-secondary btn-sm"
            download
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
            {d.collectionsCSV}
          </a>
          <a
            href="/api/export/loans"
            className="btn btn-secondary btn-sm"
            download
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
            {d.loanRegisterCSV}
          </a>
          <a
            href="/api/export/defaulters"
            className="btn btn-secondary btn-sm"
            download
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
            {d.defaultersCSV}
          </a>
        </div>
      </div>

      {/* Row 1: Collection Efficiency + Defaulter Aging */}
      <div className="grid-2" style={{ marginBottom: '20px' }}>
        {/* Collection Efficiency */}
        <div className="card">
          <div className="card-header"><h3>📊 {d.collectionEfficiency}</h3></div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '16px' }}>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{formatCurrency(collectionEfficiency.expected, currencySymbol)}</div>
              <div className="stat-label">{d.expected}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--success)' }}>{formatCurrency(collectionEfficiency.collected, currencySymbol)}</div>
              <div className="stat-label">{d.collected}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: collectionEfficiency.efficiency >= 80 ? 'var(--success)' : 'var(--danger)' }}>
                {collectionEfficiency.efficiency}%
              </div>
              <div className="stat-label">{d.efficiency}</div>
            </div>
          </div>
          {/* Visual bar */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>{d.collectionProgress}</span>
              <span>{collectionEfficiency.efficiency}%</span>
            </div>
            <div className="progress" style={{ width: '100%', height: '12px' }}>
              <div className="progress-fill" style={{ width: `${Math.min(collectionEfficiency.efficiency, 100)}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'var(--text-light)', marginTop: '6px' }}>
              <span>{d.gap}: {formatCurrency(collectionEfficiency.expected - collectionEfficiency.collected, currencySymbol)}</span>
              <span>{d.target}: {formatCurrency(collectionEfficiency.expected, currencySymbol)}</span>
            </div>
          </div>
        </div>

        {/* Profit & Loss Graph */}
        <div className="card">
          <div className="card-header"><h3>💹 Profit & Loss (Flow)</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Collected', value: collectionEfficiency.collected, color: '#10B981' },
                    { name: 'Disbursed', value: disbursement.totalPrincipal, color: '#F59E0B' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell key="cell-0" fill="#10B981" />
                  <Cell key="cell-1" fill="#F59E0B" />
                </Pie>
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value || 0), currencySymbol)}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '.85rem', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }}></span>
                Disbursed: {formatCurrency(disbursement.totalPrincipal, currencySymbol)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}></span>
                Collected: {formatCurrency(collectionEfficiency.collected, currencySymbol)}
              </div>
            </div>
            {collectionEfficiency.collected - disbursement.totalPrincipal > 0 ? (
              <div style={{ marginTop: '12px', fontSize: '.9rem', color: 'var(--success)', fontWeight: 700 }}>
                Net Cash Flow: +{formatCurrency(collectionEfficiency.collected - disbursement.totalPrincipal, currencySymbol)}
              </div>
            ) : (
              <div style={{ marginTop: '12px', fontSize: '.9rem', color: 'var(--danger)', fontWeight: 700 }}>
                Net Cash Flow: {formatCurrency(collectionEfficiency.collected - disbursement.totalPrincipal, currencySymbol)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Penalty Report + Loan Disbursement */}
      <div className="grid-2" style={{ marginBottom: '20px' }}>
        {/* Penalty Report */}
        <div className="card">
          <div className="card-header"><h3>⚡ {d.penaltyReport}</h3></div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--danger)' }}>{formatCurrency(penaltyReport.accrued, currencySymbol)}</div>
              <div className="stat-label">{d.accrued}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--success)' }}>{formatCurrency(penaltyReport.settled, currencySymbol)}</div>
              <div className="stat-label">{d.settled}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: '#8B5CF6' }}>{formatCurrency(penaltyReport.waived, currencySymbol)}</div>
              <div className="stat-label">{d.waived}</div>
            </div>
          </div>
          <div style={{ marginTop: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>
              {d.netOutstanding}: <strong style={{ color: 'var(--danger)' }}>{formatCurrency(penaltyReport.accrued - penaltyReport.settled - penaltyReport.waived, currencySymbol)}</strong>
            </div>
            <div className="progress" style={{ width: '100%', height: '8px', marginTop: '8px' }}>
              <div className="progress-fill" style={{ width: `${penaltyReport.accrued > 0 ? calcPercentage(penaltyReport.settled + penaltyReport.waived, penaltyReport.accrued) : 0}%`, background: 'var(--success)' }} />
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-light)', marginTop: '4px' }}>
              {penaltyReport.accrued > 0 ? calcPercentage(penaltyReport.settled + penaltyReport.waived, penaltyReport.accrued) : 0}% {d.resolved}
            </div>
          </div>
        </div>

        {/* Loan Disbursement */}
        <div className="card">
          <div className="card-header"><h3>💰 {d.loanDisbursement}</h3></div>
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.8rem' }}>{disbursement.count}</div>
              <div className="stat-label">{d.newLoansThisPeriod}</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--primary-dark)' }}>{formatCurrency(disbursement.totalPrincipal, currencySymbol)}</div>
              <div className="stat-label">{d.totalPrincipalOut}</div>
            </div>
          </div>
          <div style={{ marginTop: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>
              {d.avgLoanSize}: <strong>{disbursement.count > 0 ? formatCurrency(Math.round(disbursement.totalPrincipal / disbursement.count), currencySymbol) : '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="card">
        <div className="card-header"><h3>👤 {d.performance}</h3></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>{d.agent}</th><th>{d.route}</th><th>{d.customers}</th><th>{d.expected}</th><th>{d.collected}</th><th>{d.hitRate}</th><th>{d.performance}</th></tr>
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
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)' }}>{d.noAgents}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
