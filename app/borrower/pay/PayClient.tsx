'use client';

import { useState } from 'react';

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

export default function PayClient({
  token,
  amount,
  loanCode,
  status,
  upiId,
  qrUrl,
  upiQrDataUrl,
  upiUri,
  payUrl,
  mockEnabled,
}: {
  token: string;
  amount: number;
  loanCode: string;
  status: 'active' | 'expired' | 'paid' | 'claimed';
  upiId: string | null;
  qrUrl: string | null;
  upiQrDataUrl: string | null;
  upiUri: string | null;
  payUrl: string | null;
  mockEnabled: boolean;
}) {
  const [state, setState] = useState(status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reportPaid() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/borrower/self-pay/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.status === 'paid' || data.status === 'already_paid') setState('paid');
      else if (data.status === 'claimed') setState('claimed');
      else setErr(data.error || 'Could not record your payment.');
    } catch {
      setErr('Network error.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'paid') {
    return (
      <Centered emoji="✅" title="Payment received">
        {inr(amount)} for loan {loanCode}.
      </Centered>
    );
  }
  if (state === 'claimed') {
    return (
      <Centered emoji="🕓" title="Payment reported">
        Thanks — {inr(amount)} for loan {loanCode}. Your agent will confirm it shortly.
      </Centered>
    );
  }
  if (state === 'expired') {
    return (
      <Centered emoji="⌛" title="Link expired">
        Ask your agent for a new payment link.
      </Centered>
    );
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Loan {loanCode}</p>
        <div style={{ fontSize: 36, fontWeight: 800 }}>{inr(amount)}</div>
      </div>

      {payUrl ? (
        <a
          href={payUrl}
          style={{ display: 'block', textAlign: 'center', padding: 12, borderRadius: 10, background: '#16a34a', color: '#fff', fontWeight: 700, textDecoration: 'none' }}
        >
          Pay securely →
        </a>
      ) : upiQrDataUrl ? (
        <div style={{ textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={upiQrDataUrl} alt="UPI QR" style={{ width: 240, height: 240, margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
            Scan with any UPI app{upiId ? ` · ${upiId}` : ''}
          </p>
          {upiUri && (
            <a href={upiUri} style={{ display: 'inline-block', marginTop: 10, padding: '10px 16px', borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
              Open UPI app
            </a>
          )}
        </div>
      ) : qrUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrUrl} alt="UPI QR" style={{ width: '100%', maxWidth: 240, margin: '0 auto', display: 'block', borderRadius: 8 }} />
      ) : upiId ? (
        <p style={{ textAlign: 'center', fontSize: 15 }}>Pay to UPI: <strong>{upiId}</strong></p>
      ) : (
        <p style={{ textAlign: 'center', color: '#64748b' }}>Use the payment link from your agent.</p>
      )}

      {!payUrl && (
        <button
          onClick={reportPaid}
          disabled={busy}
          style={{ width: '100%', marginTop: 18, padding: '12px', borderRadius: 10, border: 0, background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
        >
          {busy ? 'Recording…' : mockEnabled ? 'I have paid (demo confirm)' : "I've paid"}
        </button>
      )}
      {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10, textAlign: 'center' }}>{err}</p>}
      <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
        {payUrl
          ? 'Auto-confirmed once your bank notifies us.'
          : 'After paying, tap “I’ve paid”. Your agent confirms receipt.'}
      </p>
    </div>
  );
}

function Centered({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>{emoji}</div>
      <h2 style={{ margin: '8px 0' }}>{title}</h2>
      <p style={{ color: '#475569' }}>{children}</p>
    </div>
  );
}
