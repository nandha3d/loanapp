'use client';

import { useState } from 'react';
import { verifyUpiPayment, bulkVerifyUpiPayments } from '../collection/actions';
import { formatCurrency } from '@/lib/utils';

// CollectCashButton removed — field cash settlement now lives in the Agent
// Wallet handover flow (wallet page), not the dashboard route table.

export function VerifyUpiButton({ entryId, amount, currencySymbol }: {
  entryId: string;
  amount: number;
  currencySymbol: string;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return (
    <span style={{ color: 'var(--success)', fontSize: '.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className="material-icons-outlined" style={{ fontSize: 16 }}>verified</span> Credited
    </span>
  );

  return (
    <button
      className="btn btn-sm"
      disabled={loading}
      onClick={async () => {
        if (!confirm(`Verify UPI payment of ${formatCurrency(amount, currencySymbol)} as credited to account?`)) return;
        setLoading(true);
        const res = await verifyUpiPayment(entryId);
        if (res.success) setDone(true);
        else alert(res.error || 'Failed to verify');
        setLoading(false);
      }}
      style={{
        background: 'linear-gradient(135deg, #8E44AD, #9B59B6)',
        color: '#fff',
        border: 'none',
        padding: '6px 14px',
        fontSize: '.78rem',
        fontWeight: 700,
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        transition: 'all .2s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span className="material-icons-outlined" style={{ fontSize: 16 }}>{loading ? 'hourglass_empty' : 'verified'}</span>
      {loading ? 'Verifying...' : 'Credited to Account'}
    </button>
  );
}

export function BulkVerifyUpiButton({ entryIds, totalAmount, currencySymbol }: {
  entryIds: string[];
  totalAmount: number;
  currencySymbol: string;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (entryIds.length === 0) return null;

  if (done) return (
    <span style={{ color: 'var(--success)', fontSize: '.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className="material-icons-outlined" style={{ fontSize: 18 }}>check_circle</span> All Verified
    </span>
  );

  return (
    <button
      className="btn btn-sm"
      disabled={loading}
      onClick={async () => {
        if (!confirm(`Verify all ${entryIds.length} UPI payments totaling ${formatCurrency(totalAmount, currencySymbol)} as credited to account?`)) return;
        setLoading(true);
        const res = await bulkVerifyUpiPayments(entryIds);
        if (res.success) setDone(true);
        else alert(res.error || 'Failed to verify');
        setLoading(false);
      }}
      style={{
        background: 'linear-gradient(135deg, #8E44AD, #9B59B6)',
        color: '#fff',
        border: 'none',
        padding: '8px 18px',
        fontSize: '.82rem',
        fontWeight: 700,
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all .2s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span className="material-icons-outlined" style={{ fontSize: 18 }}>{loading ? 'hourglass_empty' : 'verified'}</span>
      {loading ? 'Verifying All...' : `Verify All (${entryIds.length})`}
    </button>
  );
}
