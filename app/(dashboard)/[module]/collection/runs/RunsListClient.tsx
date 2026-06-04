'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/layout/DashboardLink';
import { startRunAction } from '../runActions';

type RunRow = {
  id: string;
  date: string;
  routeName: string;
  status: string;
  expected: string;
  collected: string;
  cash: string;
  digital: string;
  stops: string;
};

const STATUS_COLOR: Record<string, string> = {
  open: '#2563eb',
  collecting: '#d97706',
  closed: '#7c3aed',
  reconciled: '#16a34a',
};

export default function RunsListClient({
  runs,
  routes,
  basePath,
}: {
  runs: RunRow[];
  routes: { id: string; name: string }[];
  basePath: string;
}) {
  const router = useRouter();
  const [routeId, setRouteId] = useState(routes[0]?.id ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openRun() {
    if (!routeId) return;
    setError(null);
    start(async () => {
      let coords: { lat?: number; lng?: number } = {};
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }),
        );
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {
        /* GPS optional */
      }
      const r = await startRunAction(routeId, coords.lat, coords.lng);
      if (r.success && r.runId) router.push(`${basePath}/${r.runId}`);
      else setError(r.error ?? 'Failed to open run');
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: '0 0 4px' }}>Collection Runs</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px', fontSize: 14 }}>
          Open a route run — collect from every due customer on one sheet, then deposit the day&apos;s cash.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="form-control"
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            {routes.length === 0 && <option value="">No routes available</option>}
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={openRun} disabled={pending || !routeId}>
            {pending ? 'Opening…' : 'Start route run'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--danger, #dc2626)', marginTop: 10, fontSize: 13 }}>{error}</p>}
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={th}>Date</th>
              <th style={th}>Route</th>
              <th style={th}>Status</th>
              <th style={th}>Stops</th>
              <th style={th}>Expected</th>
              <th style={th}>Collected</th>
              <th style={th}>Cash</th>
              <th style={th}>Digital</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr><td style={td} colSpan={9}>No runs yet.</td></tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={td}>{r.date}</td>
                <td style={td}>{r.routeName}</td>
                <td style={td}>
                  <span style={{
                    background: (STATUS_COLOR[r.status] ?? '#6b7280') + '22',
                    color: STATUS_COLOR[r.status] ?? '#6b7280',
                    padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  }}>{r.status}</span>
                </td>
                <td style={td}>{r.stops}</td>
                <td style={td}>{r.expected}</td>
                <td style={td}>{r.collected}</td>
                <td style={td}>{r.cash}</td>
                <td style={td}>{r.digital}</td>
                <td style={td}>
                  <Link href={`/collection/runs/${r.id}`} className="btn btn-sm">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '12px 14px', fontWeight: 600 };
const td: React.CSSProperties = { padding: '12px 14px' };
