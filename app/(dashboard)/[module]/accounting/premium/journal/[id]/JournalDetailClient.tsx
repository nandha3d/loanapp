'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { reverseEntry, postDraftEntry, deleteDraftEntry } from '../actions';
import { AcStyles, AcButton, AcBadge, AcCard, AcAlert, AcAmt, AcTable } from '../../ui';

type Line = { id: string; lineNo: number; debit: any; credit: any; description?: string | null; account: { code: string; name: string } };
type JE = {
  id: string; entryNo?: string | null; entryDate: string;
  narration?: string | null; sourceType: string; status: string;
  totalDebit: any; totalCredit: any; lines: Line[];
  createdBy?: { name: string } | null;
  approvedBy?: { name: string } | null;
  reversedBy?: { id: string; entryNo?: string | null } | null;
};

const STATUS_MAP: Record<string, string> = { posted: 'posted', draft: 'draft', pending_approval: 'pending', reversed: 'overdue', rejected: 'overdue' };

const fmtAmt = (v: any) => { const n = Number(v); return n === 0 ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 2 }); };

export default function JournalDetailClient({ module, entry, role }: { module: string; entry: JE; role: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success'|'error'>('success');
  const canReverse = entry.status === 'posted' && ['superadmin', 'developer'].includes(role);
  const canPostDraft = entry.status === 'draft' && ['admin', 'superadmin', 'developer'].includes(role);
  const canDeleteDraft = entry.status === 'draft' && ['admin', 'superadmin', 'developer'].includes(role);

  function handleReverse() {
    const reason = window.prompt('Reason for reversal:') ?? '';
    if (!reason) return;
    start(async () => {
      const r = await reverseEntry(entry.id, reason);
      if (r.error) { setMsg(r.error); setMsgType('error'); }
      else { setMsg(`Reversal created: ${r.reversalId}`); setMsgType('success'); window.location.reload(); }
    });
  }

  function handlePostDraft() {
    if (!window.confirm('Post this draft entry? This will update account balances.')) return;
    start(async () => {
      const r = await postDraftEntry(entry.id);
      if (r.error) {
        const errorMessages: Record<string, string> = {
          not_found: 'Draft entry not found.',
          not_balanced: 'Entry is not balanced — total debits must equal total credits.',
          empty_entry: 'Entry has no amounts.',
          min_lines: 'Entry must have at least 2 lines.',
          period_locked: 'The accounting period is locked.',
        };
        setMsg(errorMessages[r.error] || r.error);
        setMsgType('error');
      } else if ((r as any).status === 'pending_approval') {
        setMsg('Entry sent for approval (amount exceeds your posting cap).');
        setMsgType('success');
        window.location.reload();
      } else {
        setMsg(`Entry posted: ${(r as any).entryNo}`);
        setMsgType('success');
        window.location.reload();
      }
    });
  }

  function handleDeleteDraft() {
    if (!window.confirm('Delete this draft entry? This action cannot be undone.')) return;
    start(async () => {
      const r = await deleteDraftEntry(entry.id);
      if (r.error) { setMsg(r.error); setMsgType('error'); }
      else { router.push(`/${module}/accounting/premium/journal`); }
    });
  }

  const lineCols = [
    { key: 'no',  label: '#',           render: (_: Line, i: number) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{_ .lineNo + 1}</span> },
    {
      key: 'acct', label: 'Account', render: (l: Line) => (
        <span><span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.78rem', marginRight: 6 }}>{l.account.code}</span>{l.account.name}</span>
      ),
    },
    { key: 'desc', label: 'Description', render: (l: Line) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.83rem' }}>{l.description ?? ''}</span> },
    {
      key: 'dr', label: 'Debit', align: 'right' as const,
      render: (l: Line) => <span style={{ fontFamily: 'monospace' }}>{fmtAmt(l.debit)}</span>,
    },
    {
      key: 'cr', label: 'Credit', align: 'right' as const,
      render: (l: Line) => <span style={{ fontFamily: 'monospace' }}>{fmtAmt(l.credit)}</span>,
    },
  ];

  const meta = [
    ['Status', <AcBadge key="s" status={STATUS_MAP[entry.status] ?? 'draft'}>{entry.status.replace(/_/g,' ')}</AcBadge>],
    ['Source', entry.sourceType.replace(/_/g,' ')],
    ['Created by', entry.createdBy?.name ?? '—'],
    ...(entry.approvedBy ? [['Approved by', entry.approvedBy.name]] : []),
  ] as const;

  return (
    <>
      <AcStyles />

      {msg && <div style={{ marginBottom: 12 }}><AcAlert type={msgType}>{msg}</AcAlert></div>}

      {/* Meta strip */}
      <AcCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          {meta.map(([label, val]) => (
            <div key={String(label)}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{val}</div>
            </div>
          ))}
          {entry.reversedBy && (
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>Reversed by</div>
              <Link href={`/${module}/accounting/premium/journal/${entry.reversedBy.id}`} style={{ color: '#ef4444', fontWeight: 600, textDecoration: 'none', fontSize: '0.88rem' }}>
                {entry.reversedBy.entryNo ?? entry.reversedBy.id}
              </Link>
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {canPostDraft && (
              <AcButton variant="primary" icon="check_circle" onClick={handlePostDraft} loading={isPending}>Post Entry</AcButton>
            )}
            {canDeleteDraft && (
              <AcButton variant="danger" icon="delete" onClick={handleDeleteDraft} loading={isPending}>Delete Draft</AcButton>
            )}
            {canReverse && (
              <AcButton variant="danger" icon="undo" onClick={handleReverse} loading={isPending}>Reverse</AcButton>
            )}
          </div>
        </div>
      </AcCard>

      {/* Lines table */}
      <div className="ac-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
        <AcTable<Line>
          cols={lineCols}
          rows={entry.lines}
          keyFn={l => l.id}
        />
        {/* Totals footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, padding: '10px 14px', borderTop: '2px solid var(--border,#e8eaed)', background: 'var(--bg-subtle,#f8fafc)', fontWeight: 700, fontSize: '0.87rem' }}>
          <span>Total Dr: <span style={{ fontFamily: 'monospace' }}>{fmtAmt(entry.totalDebit)}</span></span>
          <span>Total Cr: <span style={{ fontFamily: 'monospace' }}>{fmtAmt(entry.totalCredit)}</span></span>
        </div>
      </div>

      <AcButton as="a" variant="link" icon="arrow_back" href={`/${module}/accounting/premium/journal`}>
        Back to Journal Entries
      </AcButton>
    </>
  );
}

