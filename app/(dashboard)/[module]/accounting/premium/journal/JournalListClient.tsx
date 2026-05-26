'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { approveEntry, rejectEntry } from './actions';
import { AcStyles, AcTable, AcButton, AcBadge, AcEmpty, AcAlert, AcAmt, AcPageHeader, AcSelect } from '../ui';

type JE = {
  id: string; entryNo?: string | null; entryDate: string;
  narration?: string | null; sourceType: string;
  totalDebit: any; totalCredit: any; status: string;
  createdBy?: { name: string } | null;
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', loan_disburse: 'Loan', loan_disbursement: 'Loan',
  collection: 'Collect', penalty_accrual: 'Penalty', bill: 'Bill',
  bill_payment: 'Bill Pay', bank_reconciliation: 'Bank Rec',
  period_close: 'Period Close', reversal: 'Reversal',
  basic_migration: 'Migration', expense: 'Expense',
};

const STATUS_MAP: Record<string, string> = {
  posted: 'posted', draft: 'draft',
  pending_approval: 'pending', reversed: 'overdue', rejected: 'overdue',
};

export default function JournalListClient({ module, data }: {
  module: string;
  data: { rows: JE[]; total: number; page: number; pages: number };
}) {
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  function approve(id: string) {
    start(async () => {
      const r = await approveEntry(id);
      if (r.error) { setMsg(r.error); setMsgType('error'); }
      else { setMsg('Approved successfully.'); setMsgType('success'); }
    });
  }

  function reject(id: string) {
    const note = window.prompt('Rejection reason:') ?? '';
    start(async () => {
      await rejectEntry(id, note);
      setMsg('Entry rejected.');
      setMsgType('success');
    });
  }

  const cols = [
    {
      key: 'entryNo', label: 'Entry #', render: (je: JE) => (
        <Link href={`/${module}/accounting/premium/journal/${je.id}`}
          style={{ color: 'var(--primary,#6366f1)', fontFamily: 'monospace', fontWeight: 600, textDecoration: 'none', fontSize: '0.83rem' }}>
          {je.entryNo ?? '(draft)'}
        </Link>
      ),
    },
    {
      key: 'date', label: 'Date', render: (je: JE) => (
        <span style={{ whiteSpace: 'nowrap', fontSize: '0.83rem' }}>
          {new Date(je.entryDate).toLocaleDateString('en-IN')}
        </span>
      ),
    },
    {
      key: 'narration', label: 'Narration', render: (je: JE) => (
        <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {je.narration ?? '—'}
        </span>
      ),
    },
    {
      key: 'source', label: 'Source', render: (je: JE) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {SOURCE_LABELS[je.sourceType] ?? je.sourceType}
        </span>
      ),
    },
    {
      key: 'dr', label: 'Dr', align: 'right' as const, render: (je: JE) => (
        <AcAmt value={Number(je.totalDebit)} />
      ),
    },
    {
      key: 'cr', label: 'Cr', align: 'right' as const, render: (je: JE) => (
        <AcAmt value={Number(je.totalCredit)} />
      ),
    },
    {
      key: 'status', label: 'Status', render: (je: JE) => (
        <AcBadge status={STATUS_MAP[je.status] ?? 'draft'}>
          {je.status.replace(/_/g, ' ')}
        </AcBadge>
      ),
    },
    {
      key: 'actions', label: '', render: (je: JE) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <AcButton as="a" variant="ghost" size="sm" href={`/${module}/accounting/premium/journal/${je.id}`}>
            View
          </AcButton>
          {je.status === 'pending_approval' && <>
            <AcButton variant="success" size="sm" onClick={() => approve(je.id)} loading={isPending}>✔</AcButton>
            <AcButton variant="danger"  size="sm" onClick={() => reject(je.id)}  loading={isPending}>✕</AcButton>
          </>}
        </div>
      ),
    },
  ];

  return (
    <>
      <AcStyles />
      {msg && (
        <div style={{ marginBottom: 12 }}>
          <AcAlert type={msgType}>
            {msg} <AcButton variant="link" size="sm" onClick={() => setMsg('')} style={{ marginLeft: 8 }}>✕</AcButton>
          </AcAlert>
        </div>
      )}

      <AcTable<JE>
        cols={cols}
        rows={data.rows}
        keyFn={je => je.id}
        empty="No journal entries for this period."
      />

      {data.pages > 1 && (
        <div style={{ marginTop: 12, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          Page {data.page} of {data.pages} · {data.total} entries
        </div>
      )}
    </>
  );
}
