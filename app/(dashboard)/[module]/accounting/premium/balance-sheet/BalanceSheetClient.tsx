'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = { code: string; name: string; amount: number };
type BSData = { groups: { asset: Row[]; liability: Row[]; equity: Row[] }; totalAssets: number; totalLiabilities: number; totalEquity: number; asOf: string };
const fmt = (v: number) => `₹${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Section({ title, rows, total, color }: { title: string; rows: Row[]; total: number; color: string }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700, color }}>{title}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem', marginBottom: 16 }}>
        <tbody>
          {rows.map(r => <tr key={r.code} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '6px 0' }}><span style={{ fontFamily: 'monospace', color: '#888', fontSize: '0.8rem' }}>{r.code}</span> {r.name}</td><td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td></tr>)}
          {rows.length === 0 && <tr><td colSpan={2} style={{ color: '#888', padding: '6px 0' }}>—</td></tr>}
        </tbody>
        <tfoot><tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}><td style={{ padding: '6px 0', color }}>Total {title}</td><td style={{ textAlign: 'right', fontFamily: 'monospace', color }}>{fmt(total)}</td></tr></tfoot>
      </table>
    </div>
  );
}

export default function BalanceSheetClient({ module, data, asOf }: { module: string; data: BSData; asOf: string }) {
  const router = useRouter();
  const [d, setD] = useState(asOf);
  const balanced = Math.abs(data.totalAssets - data.totalLiabilities - data.totalEquity) < 0.01;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem' }}>As of</label>
        <input type="date" value={d} onChange={e => setD(e.target.value)} style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: 6 }} />
        <button onClick={() => router.push(`?asOf=${d}`)} style={{ padding: '6px 14px', background: 'var(--primary,#2563eb)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Apply</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <Section title="Assets" rows={data.groups.asset} total={data.totalAssets} color="#2563eb" />
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <Section title="Liabilities" rows={data.groups.liability} total={data.totalLiabilities} color="#dc2626" />
          <Section title="Equity" rows={data.groups.equity} total={data.totalEquity} color="#7c3aed" />
          <div style={{ borderTop: '2px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem' }}>
            <span>Total Liabilities + Equity</span>
            <span style={{ fontFamily: 'monospace' }}>{fmt(data.totalLiabilities + data.totalEquity)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: balanced ? '#f0fdf4' : '#fff1f2', border: `1px solid ${balanced ? '#86efac' : '#fecaca'}`, fontSize: '0.85rem', color: balanced ? '#059669' : '#dc2626', fontWeight: 600 }}>
        {balanced ? '✔ Balance sheet agrees — Assets = Liabilities + Equity' : `⚠ Out of balance by ₹${Math.abs(data.totalAssets - data.totalLiabilities - data.totalEquity).toFixed(2)}`}
      </div>
    </div>
  );
}
