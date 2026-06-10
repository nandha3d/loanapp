'use client';

/**
 * e-NACH mandate panel for the loan detail page.
 *
 * Self-contained: reads /api/v1/nach/loan/[loanId] (web session via dualAuth),
 * registers mandates through POST /api/v1/nach/mandate, opens the Razorpay
 * checkout (CDN script) for borrower authorisation, cancels via DELETE.
 * Renders nothing destructive — purely additive to the existing page.
 */

import { useCallback, useEffect, useState } from 'react';

type Mandate = {
  id: string;
  status: string;
  accountHolderName: string;
  accountNumber: string;
  bankName: string | null;
  ifscCode: string;
  maxAmount: string | number;
  authType: string;
  activatedAt: string | null;
  razorpayOrderId: string | null;
  presentations?: Array<{
    id: string;
    amount: string | number;
    status: string;
    presentedAt: string;
    failureReason: string | null;
  }>;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  active:       { bg: 'rgba(34,197,94,.12)',  fg: '#16a34a', label: 'Active' },
  pending_auth: { bg: 'rgba(245,158,11,.12)', fg: '#d97706', label: 'Pending Authorisation' },
  created:      { bg: 'rgba(245,158,11,.12)', fg: '#d97706', label: 'Created' },
  cancelled:    { bg: 'rgba(136,146,164,.15)', fg: '#6b7280', label: 'Cancelled' },
  rejected:     { bg: 'rgba(239,68,68,.12)',  fg: '#dc2626', label: 'Rejected' },
  paused:       { bg: 'rgba(136,146,164,.15)', fg: '#6b7280', label: 'Paused' },
  expired:      { bg: 'rgba(136,146,164,.15)', fg: '#6b7280', label: 'Expired' },
};

function maskAccount(acc: string): string {
  if (!acc || acc.length <= 4) return acc;
  return `••••${acc.slice(-4)}`;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { Razorpay?: any }
}

function loadRazorpayCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const src = 'https://checkout.razorpay.com/v1/checkout.js';
    if (document.querySelector(`script[src="${src}"]`)) {
      const poll = setInterval(() => {
        if (window.Razorpay) { clearInterval(poll); resolve(true); }
      }, 200);
      setTimeout(() => { clearInterval(poll); resolve(Boolean(window.Razorpay)); }, 5000);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function NachPanel({
  loanId,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  defaultMaxAmount,
  currencySymbol,
  isAdmin,
}: {
  loanId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  defaultMaxAmount?: number;
  currencySymbol: string;
  isAdmin: boolean;
}) {
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    accountHolderName: customerName ?? '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    bankName: '',
    accountType: 'savings',
    authType: 'netbanking',
    maxAmount: defaultMaxAmount ? String(Math.ceil(defaultMaxAmount)) : '',
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/nach/loan/${loanId}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setMandate(json?.data ?? null);
      }
    } catch { /* panel stays in last state */ }
    setLoaded(true);
  }, [loanId]);

  useEffect(() => { refresh(); }, [refresh]);

  const openAuthCheckout = async (orderId: string, keyId: string) => {
    const ok = await loadRazorpayCheckout();
    if (!ok || !window.Razorpay) {
      setError('Could not load Razorpay checkout. Share the authorisation link with the borrower manually.');
      return;
    }
    const rzp = new window.Razorpay({
      key: keyId,
      order_id: orderId,
      customer_id: undefined,
      recurring: '1',
      name: 'e-NACH Mandate Authorisation',
      description: 'Authorise auto-debit for loan EMIs',
      prefill: { name: customerName ?? '', contact: customerPhone ?? '', email: customerEmail ?? '' },
      handler: () => { refresh(); },
      modal: { ondismiss: () => { refresh(); } },
    });
    rzp.open();
  };

  const submitMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.accountNumber !== form.confirmAccountNumber) {
      setError('Account numbers do not match');
      return;
    }
    const maxAmount = Number(form.maxAmount);
    if (!Number.isFinite(maxAmount) || maxAmount <= 0) {
      setError('Enter a valid max debit amount');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/v1/nach/mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId,
          customerId,
          accountHolderName: form.accountHolderName.trim(),
          accountNumber: form.accountNumber.trim(),
          accountType: form.accountType,
          ifscCode: form.ifscCode.trim().toUpperCase(),
          bankName: form.bankName.trim() || undefined,
          maxAmount,
          authType: form.authType,
          customerPhone: customerPhone || undefined,
          customerEmail: customerEmail || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? 'Failed to create mandate');
      } else {
        setShowForm(false);
        await refresh();
        if (json?.data?.razorpayOrderId && json?.data?.razorpayKeyId) {
          await openAuthCheckout(json.data.razorpayOrderId, json.data.razorpayKeyId);
        }
      }
    } catch {
      setError('Network error — try again');
    } finally {
      setBusy(false);
    }
  };

  const cancelMandate = async () => {
    if (!mandate) return;
    const reason = window.prompt('Reason for cancelling this mandate?') ?? undefined;
    if (reason === undefined) return; // user dismissed
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/nach/mandate/${mandate.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error ?? 'Cancel failed');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;
  const style = mandate ? (STATUS_STYLE[mandate.status] ?? STATUS_STYLE.created) : null;
  const inputStyle: React.CSSProperties = { width: '100%' };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>🏦 e-NACH Auto-Debit</h3>
        {mandate && style && (
          <span style={{
            padding: '3px 10px', borderRadius: '6px', fontSize: '.75rem', fontWeight: 700,
            background: style.bg, color: style.fg,
          }}>{style.label}</span>
        )}
      </div>

      <div style={{ padding: '14px 18px' }}>
        {error && (
          <div style={{ padding: '8px 12px', marginBottom: '12px', borderRadius: '6px', background: 'rgba(239,68,68,.08)', color: '#dc2626', fontSize: '.8rem' }}>
            {error}
          </div>
        )}

        {!mandate && !showForm && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--text-secondary)' }}>
              No auto-debit mandate. Register e-NACH so EMIs are pulled from the borrower&apos;s bank automatically.
            </p>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                Set up Auto-Debit
              </button>
            )}
          </div>
        )}

        {mandate && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', fontSize: '.83rem' }}>
              <div><span style={{ color: 'var(--text-light)' }}>Account holder</span><br /><strong>{mandate.accountHolderName}</strong></div>
              <div><span style={{ color: 'var(--text-light)' }}>Account</span><br /><strong>{maskAccount(mandate.accountNumber)}</strong></div>
              <div><span style={{ color: 'var(--text-light)' }}>Bank / IFSC</span><br /><strong>{mandate.bankName || '—'} · {mandate.ifscCode}</strong></div>
              <div><span style={{ color: 'var(--text-light)' }}>Max debit</span><br /><strong>{currencySymbol}{Number(mandate.maxAmount).toLocaleString('en-IN')}</strong></div>
              {mandate.activatedAt && (
                <div><span style={{ color: 'var(--text-light)' }}>Active since</span><br /><strong>{new Date(mandate.activatedAt).toLocaleDateString()}</strong></div>
              )}
            </div>

            {(mandate.presentations?.length ?? 0) > 0 && (
              <div style={{ marginTop: '14px' }}>
                <h4 style={{ fontSize: '.78rem', textTransform: 'uppercase', color: 'var(--text-light)', margin: '0 0 6px' }}>Recent debits</h4>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {mandate.presentations!.slice(0, 5).map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px' }}>
                      <span>{new Date(p.presentedAt).toLocaleDateString()} · {currencySymbol}{Number(p.amount).toLocaleString('en-IN')}</span>
                      <span style={{
                        fontWeight: 700,
                        color: p.status === 'success' ? '#16a34a' : p.status === 'bounced' || p.status === 'failed' ? '#dc2626' : '#d97706',
                      }}>{p.status}{p.failureReason ? ` — ${p.failureReason}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isAdmin && ['active', 'pending_auth', 'created', 'paused'].includes(mandate.status) && (
              <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} disabled={busy} onClick={cancelMandate}>
                  Cancel Mandate
                </button>
              </div>
            )}
          </>
        )}

        {showForm && (
          <form onSubmit={submitMandate} style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <label style={{ fontSize: '.78rem' }}>Account holder name
              <input className="form-control" style={inputStyle} required value={form.accountHolderName}
                onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} />
            </label>
            <label style={{ fontSize: '.78rem' }}>Account number
              <input className="form-control" style={inputStyle} required inputMode="numeric" value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })} />
            </label>
            <label style={{ fontSize: '.78rem' }}>Confirm account number
              <input className="form-control" style={inputStyle} required inputMode="numeric" value={form.confirmAccountNumber}
                onChange={(e) => setForm({ ...form, confirmAccountNumber: e.target.value.replace(/\D/g, '') })} />
            </label>
            <label style={{ fontSize: '.78rem' }}>IFSC code
              <input className="form-control" style={{ ...inputStyle, textTransform: 'uppercase' }} required maxLength={11} value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} />
            </label>
            <label style={{ fontSize: '.78rem' }}>Bank name (optional)
              <input className="form-control" style={inputStyle} value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </label>
            <label style={{ fontSize: '.78rem' }}>Account type
              <select className="form-control" style={inputStyle} value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            </label>
            <label style={{ fontSize: '.78rem' }}>Max debit per EMI ({currencySymbol})
              <input className="form-control" style={inputStyle} required inputMode="numeric" value={form.maxAmount}
                onChange={(e) => setForm({ ...form, maxAmount: e.target.value.replace(/[^\d.]/g, '') })} />
            </label>
            <label style={{ fontSize: '.78rem' }}>Authorisation method
              <select className="form-control" style={inputStyle} value={form.authType}
                onChange={(e) => setForm({ ...form, authType: e.target.value })}>
                <option value="netbanking">Net Banking</option>
                <option value="debitcard">Debit Card</option>
                <option value="aadhaar">Aadhaar</option>
              </select>
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? 'Creating…' : 'Create Mandate & Authorise'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setError(''); }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
