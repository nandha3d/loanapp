'use client';
import React, { useState, useTransition } from 'react';
import { formatIndianCurrency } from '@/lib/accounting/utils';
import { approve, reject, cancel, listApprovals } from './actions';
import {
  AcStyles, AcModal, AcButton, AcBadge, AcTable,
  AcField, AcTextarea, AcSelect, AcPageHeader, AcAmt, AcEmpty, AcAlert,
} from '../ui';

interface Approval {
  id: string; entityType: string; entityId: string; amount: any;
  level: number; approverRole: string; status: string;
  requestedBy: { name: string; email: string };
  approvedBy: { name: string } | null;
  reviewNote: string | null; createdAt: Date; reviewedAt: Date | null;
}
interface Props { approvals: Approval[]; userRole: string; }

export default function ApprovalsClient({ approvals: initialApprovals, userRole }: Props) {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState('');

  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [approveModal, setApproveModal] = useState<{ id: string } | null>(null);
  const [approveNote, setApproveNote] = useState('');

  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter,   setTypeFilter]   = useState('');

  const filtered = approvals.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (typeFilter && a.entityType !== typeFilter) return false;
    return true;
  });

  const canApprove = ['superadmin', 'developer'].includes(userRole);

  const doApprove = (approvalId: string, note?: string) => {
    startTransition(async () => {
      const res = await approve(approvalId, note);
      if (!res.ok) { setErr(res.error ?? 'Error'); return; }
      setApprovals(prev => prev.map(a => a.id === approvalId ? { ...a, status: 'approved' } : a));
      if ((res.data as any)?.routedToL2) setErr('');
      setApproveModal(null); setApproveNote('');
    });
  };

  const doReject = () => {
    if (!rejectNote.trim()) { setErr('Rejection note required.'); return; }
    startTransition(async () => {
      const res = await reject(rejectModal!.id, rejectNote);
      if (!res.ok) { setErr(res.error ?? 'Error'); return; }
      setApprovals(prev => prev.map(a => a.id === rejectModal!.id ? { ...a, status: 'rejected' } : a));
      setRejectModal(null); setRejectNote('');
    });
  };

  const doCancel = (approvalId: string) => {
    startTransition(async () => {
      const res = await cancel(approvalId);
      if (!res.ok) { setErr(res.error ?? 'Error'); return; }
      setApprovals(prev => prev.map(a => a.id === approvalId ? { ...a, status: 'cancelled' } : a));
    });
  };

  const doRefresh = () => {
    startTransition(async () => {
      const fresh = await listApprovals({ status: statusFilter || undefined, entityType: typeFilter || undefined });
      setApprovals(fresh as any);
    });
  };

  const cols = [
    {
      key: 'entity', label: 'Type', render: (a: Approval) => (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{a.entityType.replace(/_/g,' ')}</div>
          <div style={{ fontSize: '0.83rem', fontFamily: 'monospace', fontWeight: 600 }}>{a.entityId.slice(0, 8)}…</div>
        </div>
      ),
    },
    {
      key: 'amount', label: 'Amount', align: 'right' as const,
      render: (a: Approval) => <AcAmt value={Number(a.amount)} />,
    },
    {
      key: 'level', label: 'Level', render: (a: Approval) => (
        <AcBadge bg={a.level === 2 ? '#ede9fe' : '#dbeafe'} color={a.level === 2 ? '#6d28d9' : '#1d4ed8'}>
          L{a.level}
        </AcBadge>
      ),
    },
    {
      key: 'by', label: 'Requested', render: (a: Approval) => (
        <div>
          <div style={{ fontSize: '0.83rem', fontWeight: 600 }}>{a.requestedBy.name}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{a.requestedBy.email}</div>
        </div>
      ),
    },
    {
      key: 'date', label: 'Date',
      render: (a: Approval) => <span style={{ fontSize: '0.8rem' }}>{new Date(a.createdAt).toLocaleDateString('en-IN')}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: (a: Approval) => <AcBadge status={a.status}>{a.status}</AcBadge>,
    },
    {
      key: 'action', label: '', render: (a: Approval) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {a.status === 'pending' && canApprove && <>
            <AcButton variant="success" size="sm" onClick={() => setApproveModal({ id: a.id })} loading={isPending}>Approve</AcButton>
            <AcButton variant="danger"  size="sm" onClick={() => { setRejectModal({ id: a.id }); setErr(''); }} loading={isPending}>Reject</AcButton>
          </>}
          {a.status === 'pending' && (
            <AcButton variant="ghost" size="sm" onClick={() => doCancel(a.id)} loading={isPending}>Cancel</AcButton>
          )}
          {a.status !== 'pending' && a.reviewNote && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {a.reviewNote.slice(0, 40)}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <AcStyles />

      <AcPageHeader
        title="Approvals"
        actions={
          <AcButton variant="ghost" icon="refresh" onClick={doRefresh} loading={isPending}>Refresh</AcButton>
        }
      />

      {err && (
        <div style={{ marginBottom: 12 }}>
          <AcAlert type="error">{err} <AcButton variant="link" size="sm" onClick={() => setErr('')}>✕</AcButton></AcAlert>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <AcSelect aria-label="Approval status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="">All statuses</option>
          {['pending','approved','rejected','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </AcSelect>
        <AcSelect aria-label="Approval type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All types</option>
          {['journal_entry','bill','budget'].map(t => <option key={t} value={t}>{t}</option>)}
        </AcSelect>
      </div>

      <div className="ac-card" style={{ padding: 0, overflow: 'hidden' }}>
        <AcTable<Approval>
          cols={cols}
          rows={filtered}
          keyFn={a => a.id}
          empty="No approvals found."
          loading={isPending}
        />
      </div>

      {/* Approve modal */}
      <AcModal
        open={!!approveModal}
        onClose={() => { setApproveModal(null); setApproveNote(''); }}
        title="Approve Entry"
        width={400}
        footer={
          <>
            <AcButton variant="ghost" onClick={() => { setApproveModal(null); setApproveNote(''); }}>Cancel</AcButton>
            <AcButton variant="success" loading={isPending} onClick={() => doApprove(approveModal!.id, approveNote || undefined)}>Approve</AcButton>
          </>
        }
      >
        <AcField label="Note (optional)">
          <AcTextarea rows={3} value={approveNote} onChange={e => setApproveNote(e.target.value)} placeholder="Optional note…" />
        </AcField>
      </AcModal>

      {/* Reject modal */}
      <AcModal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectNote(''); }}
        title="Reject Entry"
        width={400}
        footer={
          <>
            <AcButton variant="ghost" onClick={() => { setRejectModal(null); setRejectNote(''); }}>Cancel</AcButton>
            <AcButton variant="danger" loading={isPending} onClick={doReject}>Reject</AcButton>
          </>
        }
      >
        <AcField label="Reason" required>
          <AcTextarea rows={3} required value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Enter rejection reason…" />
        </AcField>
      </AcModal>
    </>
  );
}
