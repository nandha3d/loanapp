'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = { label: string; amount: number };
type CFData = { operating: Row[]; investing: Row[]; financing: Row[]; netOperating: number; netInvesting: number; netFinancing: number; netChange: number; openingCash: number; closingCash: number; from: string; to: string };
const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sign = (v: number) => v >= 0 ? `+${fmt(v)}` : fmt(v);

function Section({ title, rows, net }: { title: string; rows: Row[]; net: number }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
          <tbody>
            {rows.map((r, i) => <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '7px 12px' }}>{r.label}</td><td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', color: r.amount >= 0 ? '#059669' : '#dc2626' }}>{sign(r.amount)}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={2} style={{ padding: '10px 12px', color: '#888' }}>—</td></tr>}
          </tbody>
          <tfoot><tr style={{ background: 'var(--surface-2,#f8fafc)', borderTop: '2px solid var(--border)', fontWeight: 700 }}><td style={{ padding: '7px 12px' }}>Net {title}</td><td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', color: net >= 0 ? '#059669' : '#dc2626' }}>{sign(net)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

export default function CashFlowClient({ module, data, from, to }: { module: string; data: CFData; from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem' }}>From</label>
        <input type="date" value={f} onChange={e => setF(e.target.value)} style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: 6 }} />
        <label style={{ fontSize: '0.85rem' }}>To</label>
        <input type="date" value={t} onChange={e => setT(e.target.value)} style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: 6 }} />
        <button onClick={() => router.push(`?from=${f}&to=${t}`)} style={{ padding: '6px 14px', background: 'var(--primary,#2563eb)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Apply</button>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#888', fontSize: '0.85rem' }}>Opening Cash & Bank</span><span style={{ fontFamily: 'monospace' }}>{fmt(data.openingCash)}</span></div>
      </div>

      <Section title="Operating Activities" rows={data.operating} net={data.netOperating} />
      <Section title="Investing Activities" rows={data.investing} net={data.netInvesting} />
      <Section title="Financing Activities" rows={data.financing} net={data.netFinancing} />

      <div style={{ border: '2px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 600 }}><span>Net Change in Cash</span><span style={{ fontFamily: 'monospace', color: data.netChange >= 0 ? '#059669' : '#dc2626' }}>{sign(data.netChange)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem' }}><span>Closing Cash & Bank</span><span style={{ fontFamily: 'monospace' }}>{fmt(data.closingCash)}</span></div>
      </div>
    </div>
  );
}
