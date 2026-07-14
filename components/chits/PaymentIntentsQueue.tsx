'use client';

import { useEffect, useState, useTransition } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  listChitPaymentIntentsQueue,
  approveChitPaymentIntentAction,
  rejectChitPaymentIntentAction,
} from '@/app/(dashboard)/[module]/chits/actions';

type Intent = Awaited<ReturnType<typeof listChitPaymentIntentsQueue>>[number];

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '10px',
};

export default function PaymentIntentsQueue({ chitGroupId, currencySymbol }: { chitGroupId?: string; currencySymbol?: string }) {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [status, setStatus] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmAmounts, setConfirmAmounts] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function load() {
    setLoading(true);
    listChitPaymentIntentsQueue(status === 'all' ? null : 'pending', chitGroupId || null)
      .then((data) => { setIntents(data); setError(''); })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, chitGroupId]);

  function approve(id: string, dueAmount: number, claimedAmount: number | null) {
    const amount = Number(confirmAmounts[id] ?? claimedAmount ?? dueAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid confirmed amount'); return; }
    startTransition(async () => {
      try {
        await approveChitPaymentIntentAction(id, amount);
        load();
      } catch (e: any) {
        setError(e.message || 'Approve failed');
      }
    });
  }

  function reject(id: string) {
    const reason = rejectReasons[id]?.trim();
    if (!reason) { setError('Enter a rejection reason'); return; }
    startTransition(async () => {
      try {
        await rejectChitPaymentIntentAction(id, reason);
        load();
      } catch (e: any) {
        setError(e.message || 'Reject failed');
      }
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button className={`btn btn-sm ${status === 'pending' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus('pending')}>Pending</button>
        <button className={`btn btn-sm ${status === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus('all')}>All</button>
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '10px' }}>{error}</div>}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : intents.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No {status === 'pending' ? 'pending' : ''} payment proofs.</p>
      ) : (
        intents.map((intent) => (
          <div key={intent.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{intent.memberName} · Ticket {intent.ticketNo ?? '—'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {intent.groupName}{intent.period ? ` · Period ${intent.period.periodNumber}` : ''} · {formatDate(intent.createdAt)}
                </div>
              </div>
              <span className={`badge badge-${intent.status === 'approved' ? 'success' : intent.status === 'rejected' ? 'danger' : 'warning'}`}>
                {intent.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '10px', fontSize: '0.85rem' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>Claimed: </span>{intent.amount != null ? formatCurrency(intent.amount, currencySymbol) : '—'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Mode: </span>{intent.paymentMode}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Ref: </span>{intent.referenceNo || '—'}</div>
              {intent.period && (
                <div><span style={{ color: 'var(--text-secondary)' }}>Due: </span>{formatCurrency(intent.period.dueAmount - intent.period.paidAmount, currencySymbol)}</div>
              )}
            </div>

            {intent.isDuplicateReference && (
              <div style={{ marginTop: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                ⚠ Reference number seen before — check for duplicate
              </div>
            )}

            {intent.proofUrl && (
              <div style={{ marginTop: '8px' }}>
                <a href={intent.proofUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                  View proof
                </a>
              </div>
            )}

            {intent.status === 'pending' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="Confirmed amount"
                  defaultValue={intent.amount ?? (intent.period ? intent.period.dueAmount - intent.period.paidAmount : '')}
                  onChange={(e) => setConfirmAmounts((s) => ({ ...s, [intent.id]: e.target.value }))}
                  style={{ width: '140px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                />
                <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => approve(intent.id, intent.period ? intent.period.dueAmount - intent.period.paidAmount : Number(intent.amount || 0), intent.amount)}>
                  Approve
                </button>
                <input
                  type="text"
                  placeholder="Rejection reason"
                  onChange={(e) => setRejectReasons((s) => ({ ...s, [intent.id]: e.target.value }))}
                  style={{ width: '160px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                />
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} disabled={pending} onClick={() => reject(intent.id)}>
                  Reject
                </button>
              </div>
            )}

            {intent.status === 'rejected' && intent.rejectionReason && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--danger)' }}>Reason: {intent.rejectionReason}</div>
            )}
            {intent.status === 'approved' && intent.receiptNo && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--success)' }}>Receipt: {intent.receiptNo}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
