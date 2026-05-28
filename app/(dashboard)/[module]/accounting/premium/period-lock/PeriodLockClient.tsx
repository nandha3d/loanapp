'use client';
import React, { useState, useTransition } from 'react';
import { formatIndianCurrency } from '@/lib/accounting/utils';
import { softLockPeriod, lockPeriod, closePeriod, unlockPeriod, reopenPeriod, listAuditLog } from './actions';
import {
  AcStyles, AcModal, AcButton, AcBadge, AcTable,
  AcField, AcTextarea, AcInput, AcPageHeader, AcSectionHead, AcAmt, AcEmpty, AcSelect, AcAlert,
} from '../ui';

interface Period {
  id: string; periodKey: string; periodFrom: Date; periodTo: Date;
  fiscalYear: string; status: string; netProfit: number;
  closingJE: { id: string; entryNo: string | null } | null;
  lockedBy: { name: string } | null; lockedAt: Date | null;
  closedBy: { name: string } | null; closedAt: Date | null;
}
interface AuditRow {
  id: string; action: string; entityType: string; entityId: string | null;
  user: { name: string; email: string } | null;
  reason: string | null; createdAt: Date;
}
interface Props {
  module: string; periods: Period[]; auditRows: AuditRow[];
  fiscalYears: string[]; currentFy: string;
  canManagePeriods?: boolean;
}

function periodLabel(pk: string) {
  const [y, m] = pk.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function PeriodLockClient({ module, periods: initialPeriods, auditRows: initialAudit, fiscalYears, currentFy, canManagePeriods = false }: Props) {
  const [periods, setPeriods] = useState(initialPeriods);
  const [auditRows, setAuditRows] = useState(initialAudit);
  const [selectedFy, setSelectedFy] = useState(currentFy);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState('');

  const [unlockModal, setUnlockModal] = useState<{ periodId: string; action: 'unlock' | 'reopen' } | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [closeModal, setCloseModal] = useState<Period | null>(null);

  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');

  const handleAction = (periodId: string, action: 'soft_lock' | 'lock' | 'close') => {
    startTransition(async () => {
      let res;
      if (action === 'soft_lock') res = await softLockPeriod(periodId);
      else if (action === 'lock') res = await lockPeriod(periodId);
      else { res = await closePeriod(periodId); setCloseModal(null); }
      if (!res.ok) setErr(res.error ?? 'Period action failed.');
      else {
        const status = action === 'soft_lock' ? 'soft_locked' : action === 'lock' ? 'locked' : 'closed';
        setPeriods(prev => prev.map(p => p.id === periodId ? { ...p, status } : p));
      }
    });
  };

  const handleUnlock = () => {
    if (!unlockModal || unlockReason.trim().length < 10) {
      setErr('Reason must be at least 10 characters.');
      return;
    }
    startTransition(async () => {
      const res = unlockModal.action === 'unlock'
        ? await unlockPeriod(unlockModal.periodId, unlockReason)
        : await reopenPeriod(unlockModal.periodId, unlockReason);
      if (!res.ok) setErr(res.error ?? 'Unable to unlock period.');
      else {
        setPeriods(prev => prev.map(p => p.id === unlockModal.periodId ? { ...p, status: 'open' } : p));
        setUnlockModal(null); setUnlockReason('');
      }
    });
  };

  const handleAuditFilter = () => {
    startTransition(async () => {
      const res = await listAuditLog({ action: auditActionFilter, entityType: auditEntityFilter });
      setAuditRows(res.rows as any);
    });
  };

  const periodCols = [
    { key: 'period', label: 'Period', render: (p: Period) => <span style={{ fontWeight: 600 }}>{p.periodKey} · {periodLabel(p.periodKey)}</span> },
    { key: 'status', label: 'Status', render: (p: Period) => <AcBadge status={p.status}>{p.status.replace(/_/g, ' ')}</AcBadge> },
    {
      key: 'net', label: 'Net Profit', align: 'right' as const,
      render: (p: Period) => p.status === 'open' && !p.netProfit ? <span style={{ color: 'var(--text-secondary)' }}>—</span> : <AcAmt value={p.netProfit} />,
    },
    {
      key: 'je', label: 'Closing JE', render: (p: Period) => p.closingJE
        ? <a href={`/${module}/accounting/premium/journal/${p.closingJE.id}`} style={{ color: 'var(--primary,#6366f1)', fontSize: '0.83rem' }}>{p.closingJE.entryNo ?? 'Closing JE'}</a>
        : <span style={{ color: 'var(--text-secondary)' }}>—</span>,
    },
    {
      key: 'actions', label: 'Actions', render: (p: Period) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!canManagePeriods ? (
            <span style={{ color: 'var(--text-secondary)' }}>-</span>
          ) : p.status === 'open' && (
            <AcButton size="sm" variant="ghost" onClick={() => handleAction(p.id, 'soft_lock')} loading={isPending}>Soft Lock</AcButton>
          )}
          {canManagePeriods && p.status === 'soft_locked' && <>
            <AcButton size="sm" variant="primary" onClick={() => handleAction(p.id, 'lock')} loading={isPending}>Lock</AcButton>
            <AcButton size="sm" variant="ghost"   onClick={() => setUnlockModal({ periodId: p.id, action: 'unlock' })} loading={isPending}>Unlock</AcButton>
          </>}
          {canManagePeriods && p.status === 'locked' && <>
            <AcButton size="sm" variant="success" onClick={() => setCloseModal(p)} loading={isPending}>Close</AcButton>
            <AcButton size="sm" variant="ghost"   onClick={() => setUnlockModal({ periodId: p.id, action: 'unlock' })} loading={isPending}>Unlock</AcButton>
          </>}
          {canManagePeriods && p.status === 'closed' && (
            <AcButton size="sm" variant="ghost" onClick={() => setUnlockModal({ periodId: p.id, action: 'reopen' })} loading={isPending}>Reopen</AcButton>
          )}
        </div>
      ),
    },
  ];

  const auditCols = [
    { key: 'date', label: 'Date', render: (r: AuditRow) => <span style={{ fontSize: '0.78rem' }}>{new Date(r.createdAt).toLocaleString('en-IN')}</span> },
    { key: 'user', label: 'User', render: (r: AuditRow) => <span style={{ fontSize: '0.83rem' }}>{r.user?.name ?? '—'}</span> },
    { key: 'action', label: 'Action', render: (r: AuditRow) => <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.action}</span> },
    { key: 'entity', label: 'Entity', render: (r: AuditRow) => <span style={{ fontSize: '0.78rem' }}>{r.entityType}{r.entityId ? ` / ${r.entityId.slice(0, 8)}…` : ''}</span> },
    { key: 'reason', label: 'Reason', render: (r: AuditRow) => <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.reason ?? '—'}</span> },
  ];

  return (
    <>
      <AcStyles />

      <AcPageHeader
        title="Period Lock & Audit"
        actions={
          <AcSelect value={selectedFy} onChange={e => { setSelectedFy(e.target.value); window.location.href = `?fy=${e.target.value}`; }} style={{ minWidth: 140 }}>
            {fiscalYears.map(fy => <option key={fy} value={fy}>FY {fy}</option>)}
          </AcSelect>
        }
      />

      {err && <div style={{ marginBottom: 12 }}><AcAlert type="error">{err} <AcButton variant="link" size="sm" onClick={() => setErr('')}>✕</AcButton></AcAlert></div>}

      {/* Periods table */}
      <div className="ac-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
        <AcTable<Period> cols={periodCols} rows={periods} keyFn={p => p.id} empty="No periods for this fiscal year." />
      </div>

      {/* Audit log */}
      <AcSectionHead
        title="Audit Log"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <AcInput placeholder="Action filter" value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} style={{ maxWidth: 180 }} />
            <AcInput placeholder="Entity type" value={auditEntityFilter} onChange={e => setAuditEntityFilter(e.target.value)} style={{ maxWidth: 180 }} />
            <AcButton variant="ghost" icon="filter_list" onClick={handleAuditFilter} loading={isPending}>Filter</AcButton>
          </div>
        }
      />
      <div className="ac-card" style={{ padding: 0, overflow: 'hidden' }}>
        <AcTable<AuditRow> cols={auditCols} rows={auditRows} keyFn={r => r.id} empty="No audit entries." />
      </div>

      {/* Unlock / Reopen modal */}
      <AcModal
        open={!!unlockModal}
        onClose={() => { setUnlockModal(null); setUnlockReason(''); }}
        title={unlockModal?.action === 'reopen' ? 'Reopen Period?' : 'Unlock Period?'}
        width={440}
        footer={
          <>
            <AcButton variant="ghost" onClick={() => { setUnlockModal(null); setUnlockReason(''); }}>Cancel</AcButton>
            <AcButton variant="primary" loading={isPending} onClick={handleUnlock}>
              {unlockModal?.action === 'reopen' ? 'Reopen' : 'Unlock'}
            </AcButton>
          </>
        }
      >
        <p style={{ margin: '0 0 14px', fontSize: '0.87rem', color: 'var(--text-secondary)' }}>
          {unlockModal?.action === 'reopen'
            ? 'Reopening reverses the closing JE and allows new entries. May invalidate filed GST returns.'
            : 'Unlocking allows new journal entries in this period.'}
        </p>
        <AcField label="Reason" required hint="Minimum 10 characters">
          <AcTextarea rows={3} value={unlockReason} onChange={e => setUnlockReason(e.target.value)} placeholder="Enter reason for unlocking…" />
        </AcField>
      </AcModal>

      {/* Close period confirm */}
      <AcModal
        open={!!closeModal}
        onClose={() => setCloseModal(null)}
        title={`Close ${closeModal ? periodLabel(closeModal.periodKey) : ''}?`}
        width={420}
        footer={
          <>
            <AcButton variant="ghost" onClick={() => setCloseModal(null)}>Cancel</AcButton>
            <AcButton variant="primary" loading={isPending} onClick={() => handleAction(closeModal!.id, 'close')}>Close Period</AcButton>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: '0.87rem' }}>
          Net Profit <strong><AcAmt value={closeModal?.netProfit ?? 0} /></strong> will be transferred to Current Year Earnings.
          A closing journal entry will be created automatically.
        </p>
      </AcModal>
    </>
  );
}
