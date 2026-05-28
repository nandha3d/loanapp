'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { approveEntry, rejectEntry } from './actions';
import { AcStyles, AcTable, AcButton, AcBadge, AcAlert, AcAmt, AcInput, AcSelect, AcModal, AcField, AcTextarea } from '../ui';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  function setFilter(key: 'from' | 'to' | 'status' | 'search', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    const qs = params.toString();
    router.replace(`/${module}/accounting/premium/journal${qs ? `?${qs}` : ''}`);
  }

  function approve(id: string) {
    start(async () => {
      const r = await approveEntry(id);
      if (r.error) { setMsg(r.error); setMsgType('error'); }
      else { setMsg('Approved successfully.'); setMsgType('success'); }
    });
  }

  function reject(id: string, note: string) {
    setRejectModal(null);
    setRejectNote('');
    start(async () => {
      await rejectEntry(id, note);
      setMsg('Entry rejected.');
      setMsgType('success');
    });
  }

  const cols = [
    {
      key: 'entryNo', label: 'Entry No', render: (je: JE) => (
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
      key: 'dr', label: 'Debit', align: 'right' as const, render: (je: JE) => (
        <AcAmt value={Number(je.totalDebit)} />
      ),
    },
    {
      key: 'cr', label: 'Credit', align: 'right' as const, render: (je: JE) => (
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
            <AcButton variant="success" size="sm" aria-label="Approve entry" onClick={() => approve(je.id)} loading={isPending}>✔</AcButton>
            <AcButton variant="danger"  size="sm" aria-label="Reject entry" onClick={() => setRejectModal({ id: je.id })} loading={isPending}>✕</AcButton>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          From date
          <AcInput
            type="date"
            defaultValue={searchParams.get('from') ?? ''}
            onChange={(e) => setFilter('from', e.target.value)}
            style={{ marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          To date
          <AcInput
            type="date"
            defaultValue={searchParams.get('to') ?? ''}
            onChange={(e) => setFilter('to', e.target.value)}
            style={{ marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Status
          <AcSelect
            aria-label="Status"
            defaultValue={searchParams.get('status') ?? ''}
            onChange={(e) => setFilter('status', e.target.value)}
            style={{ marginTop: 4 }}
          >
            <option value="">All statuses</option>
            {['posted', 'draft', 'pending_approval', 'reversed', 'rejected'].map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </AcSelect>
        </label>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Search
          <AcInput
            placeholder="Search narration"
            defaultValue={searchParams.get('search') ?? ''}
            onChange={(e) => setFilter('search', e.target.value)}
            style={{ marginTop: 4 }}
          />
        </label>
      </div>

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
      <AcModal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectNote(''); }}
        title="Reject Journal Entry"
        width={420}
        footer={
          <>
            <AcButton variant="ghost" onClick={() => { setRejectModal(null); setRejectNote(''); }}>Cancel</AcButton>
            <AcButton variant="danger" loading={isPending} onClick={() => reject(rejectModal!.id, rejectNote)}>
              Reject
            </AcButton>
          </>
        }
      >
        <AcField label="Reason" required>
          <AcTextarea rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Enter rejection reason" />
        </AcField>
      </AcModal>
    </>
  );
}
