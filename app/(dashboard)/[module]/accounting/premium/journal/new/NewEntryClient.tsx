'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { postEntry, saveDraftEntry } from '../actions';
import { AcStyles, AcButton, AcField, AcInput, AcSelect, AcAlert, AcAmt } from '../../ui';

type Account = { id: string; code: string; name: string; classType: string };
type Line = { accountId: string; debit: string; credit: string; description: string };
const EL: Line = { accountId: '', debit: '', credit: '', description: '' };

export default function NewEntryClient({ module, accounts }: { module: string; accounts: Account[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<Line[]>([{...EL},{...EL}]);
  const [err, setErr] = useState('');

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  const upd = (i: number, f: keyof Line, v: string) => setLines(p => p.map((l, idx) => idx === i ? {...l, [f]: v} : l));

  const payload = () => ({
    entryDate: date,
    narration: narration || undefined,
    lines: lines.filter(l => l.accountId).map((l, i) => ({
      accountId: l.accountId,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      description: l.description || undefined,
      lineNo: i,
    })),
  });

  function post() {
    setErr('');
    start(async () => {
      const r = await postEntry(payload());
      if (r.error) { setErr(r.error); return; }
      router.push(`/${module}/accounting/premium/journal/${r.entryId}`);
    });
  }

  function draft() {
    setErr('');
    start(async () => {
      const r = await saveDraftEntry(payload());
      if ((r as any).error) { setErr((r as any).error); return; }
      router.push(`/${module}/accounting/premium/journal/${r.entryId}`);
    });
  }

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <>
      <AcStyles />
      <div style={{ maxWidth: 800 }}>
        {err && <div style={{ marginBottom: 12 }}><AcAlert type="error">{err}</AcAlert></div>}

        {/* Header fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <AcField label="Entry Date" required>
            <AcInput type="date" value={date} onChange={e => setDate(e.target.value)} />
          </AcField>
          <AcField label="Narration">
            <AcInput value={narration} onChange={e => setNarration(e.target.value)} placeholder="Brief description…" />
          </AcField>
        </div>

        {/* Lines table */}
        <div className="ac-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
          <table className="ac-table">
            <thead><tr>
              <th style={{ width: 36 }}>#</th>
              <th>Account</th>
              <th>Description</th>
              <th style={{ textAlign: 'right', width: 120 }}>Debit</th>
              <th style={{ textAlign: 'right', width: 120 }}>Credit</th>
              <th style={{ width: 36 }}></th>
            </tr></thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{i+1}</td>
                  <td>
                    <AcSelect value={line.accountId} onChange={e => upd(i,'accountId',e.target.value)}>
                      <option value="">— pick account —</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                    </AcSelect>
                  </td>
                  <td>
                    <AcInput value={line.description} onChange={e => upd(i,'description',e.target.value)} placeholder="optional" />
                  </td>
                  <td>
                    <AcInput type="number" min="0" step="0.01" value={line.debit} onChange={e => upd(i,'debit',e.target.value)} placeholder="0" style={{ textAlign: 'right' }} />
                  </td>
                  <td>
                    <AcInput type="number" min="0" step="0.01" value={line.credit} onChange={e => upd(i,'credit',e.target.value)} placeholder="0" style={{ textAlign: 'right' }} />
                  </td>
                  <td>
                    {lines.length > 2 && (
                      <AcButton size="sm" variant="link" onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} style={{ color: '#ef4444' }}>✕</AcButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border,#e8eaed)', fontWeight: 700, background: 'var(--bg-subtle,#f8fafc)' }}>
                <td colSpan={3} style={{ padding: '10px 14px', textAlign: 'right', fontSize: '0.84rem' }}>Totals</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(totalDr)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(totalCr)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <AcButton variant="ghost" icon="add" onClick={() => setLines(p => [...p, {...EL}])}>Add line</AcButton>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {totalDr > 0 && (
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: balanced ? '#16a34a' : '#dc2626' }}>
                {balanced ? '✔ Balanced' : `⚠ Dr ${fmt(totalDr)} ≠ Cr ${fmt(totalCr)}`}
              </span>
            )}
            <AcButton variant="ghost" onClick={draft} loading={isPending}>Save Draft</AcButton>
            <AcButton variant="primary" onClick={post} loading={isPending} disabled={!balanced}>Post Entry</AcButton>
          </div>
        </div>
      </div>
    </>
  );
}
