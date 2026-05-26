'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = { code: string; name: string; classType: string; debit: number; credit: number };
type TBData = { rows: Row[]; totalDebit: number; totalCredit: number; asOf: string };
const fmt = (v: number) => v === 0 ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const CC: Record<string, string> = { asset: '#2563eb', liability: '#dc2626', equity: '#7c3aed', income: '#059669', expense: '#d97706' };

export default function TrialBalanceClient({ module, data, asOf }: { module: string; data: TBData; asOf: string }) {
  const router = useRouter();
  const [d, setD] = useState(asOf);
  const [search, setSearch] = useState('');
  const balanced = Math.abs(data.totalDebit - data.totalCredit) < 0.01;
  const filtered = search ? data.rows.filter(r => r.code.includes(search) || r.name.toLowerCase().includes(search.toLowerCase())) : data.rows;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, flex: 1, minWidth: 140 }} />
        <label style={{ fontSize: '0.85rem' }}>As of</label>
        <input type="date" value={d} onChange={e => setD(e.target.value)} style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: 6 }} />
        <button onClick={() => router.push(`?asOf=${d}`)} style={{ padding: '6px 14px', background: 'var(--primary,#2563eb)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Apply</button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
          <thead><tr style={{ background: 'var(--surface-2,#f8fafc)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>Code</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Account</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>Class</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Debit (₹)</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Credit (₹)</th>
          </tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.code} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '7px 8px', fontFamily: 'monospace', color: '#888', fontSize: '0.8rem' }}>{r.code}</td>
                <td style={{ padding: '7px 8px' }}>{r.name}</td>
                <td style={{ padding: '7px 8px' }}><span style={{ background: `${CC[r.classType]}22`, color: CC[r.classType], padding: '2px 6px', borderRadius: 4, fontSize: '0.78rem' }}>{r.classType}</span></td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.debit)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.credit)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>No data.</td></tr>}
          </tbody>
          <tfoot><tr style={{ background: 'var(--surface-2,#f8fafc)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
            <td colSpan={3} style={{ padding: '8px', textAlign: 'right' }}>Totals</td>
            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{data.totalDebit.toLocaleString('en-IN',{maximumFractionDigits:2})}</td>
            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{data.totalCredit.toLocaleString('en-IN',{maximumFractionDigits:2})}</td>
          </tr></tfoot>
        </table>
      </div>

      <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: balanced ? '#f0fdf4' : '#fff1f2', border: `1px solid ${balanced ? '#86efac' : '#fecaca'}`, fontSize: '0.85rem', color: balanced ? '#059669' : '#dc2626', fontWeight: 600 }}>
        {balanced ? '✔ Trial balance agrees — Total Dr = Total Cr' : `⚠ Difference: ₹${Math.abs(data.totalDebit - data.totalCredit).toFixed(2)}`}
      </div>
    </div>
  );
}
