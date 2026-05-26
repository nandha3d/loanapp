'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = { code: string; name: string; amount: number };
type PnLData = { incomeAccounts: Row[]; expenseAccounts: Row[]; totalIncome: number; totalExpense: number; netProfit: number; from: string; to: string };

const fmt = (v: number) => `₹${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Section({ title, rows, total, color }: { title: string; rows: Row[]; total: number; color: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color }}>{title}</h3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px' }}><span style={{ fontFamily: 'monospace', color: '#888', fontSize: '0.8rem' }}>{r.code}</span> {r.name}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={2} style={{ padding: '12px', color: '#888', textAlign: 'center' }}>No entries</td></tr>}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--surface-2,#f8fafc)', borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700 }}>Total {title}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color }}>{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function PnLClient({ module, data, from, to }: { module: string; data: PnLData; from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const isProfit = data.netProfit >= 0;

  function apply() { router.push(`?from=${f}&to=${t}`); }

  return (
    <div>
      {/* Date filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem' }}>From</label>
        <input type="date" value={f} onChange={e => setF(e.target.value)} style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: 6 }} />
        <label style={{ fontSize: '0.85rem' }}>To</label>
        <input type="date" value={t} onChange={e => setT(e.target.value)} style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: 6 }} />
        <button onClick={apply} style={{ padding: '6px 14px', background: 'var(--primary,#2563eb)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Apply</button>
      </div>

      <Section title="Revenue" rows={data.incomeAccounts} total={data.totalIncome} color="#059669" />
      <Section title="Expenses" rows={data.expenseAccounts} total={data.totalExpense} color="#dc2626" />

      {/* Net Profit/Loss */}
      <div style={{ border: `2px solid ${isProfit ? '#059669' : '#dc2626'}`, borderRadius: 8, padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isProfit ? '#f0fdf4' : '#fff1f2' }}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: isProfit ? '#059669' : '#dc2626' }}>{isProfit ? 'Net Profit' : 'Net Loss'}</span>
        <span style={{ fontWeight: 700, fontSize: '1.2rem', fontFamily: 'monospace', color: isProfit ? '#059669' : '#dc2626' }}>{fmt(data.netProfit)}</span>
      </div>
    </div>
  );
}
