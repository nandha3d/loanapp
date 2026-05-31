'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';

type Approval = {
  id: string;
  amount: number;
  paymentMode: string;
  photoPath: string | null;
  loanCode: string;
  createdAt: string;
};

export default function PaymentProofPanel() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // QR generation
  const [amount, setAmount] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrInfo, setQrInfo] = useState<{ amount: number; instalmentNo: number; loanCode: string; expiresAt: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/approvals', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadApprovals();
    const t = setInterval(loadApprovals, 15000); // poll for new requests
    return () => clearInterval(t);
  }, [loadApprovals]);

  const respond = async (id: string, decision: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (decision === 'reject') {
      reason = window.prompt('Reason for rejecting this payment?') || undefined;
      if (reason === undefined) return; // cancelled
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/portal/approvals/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed');
      } else {
        await loadApprovals();
      }
    } finally {
      setBusyId(null);
    }
  };

  const generateQr = async () => {
    setErr(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid amount');
      return;
    }
    setQrLoading(true);
    try {
      const res = await fetch('/api/portal/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Failed to generate QR');
        return;
      }
      const url = await QRCode.toDataURL(data.payload, { width: 240, margin: 1 });
      setQrDataUrl(url);
      setQrInfo({ amount: data.amount, instalmentNo: data.instalmentNo, loanCode: data.loanCode, expiresAt: data.expiresAt });
    } catch (e: any) {
      setErr(e?.message || 'Failed to generate QR');
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720, margin: '0 auto 16px', padding: '0 16px' }}>
      {/* Pending approvals */}
      {approvals.length > 0 && (
        <div className="card" style={{ padding: 16, borderRadius: 14, background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: '#b45309' }}>⚠️ Approve your payment{approvals.length > 1 ? 's' : ''}</h3>
          {approvals.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
              {a.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.photoPath} alt="proof" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>₹{a.amount.toLocaleString('en-IN')}</div>
                <div style={{ fontSize: '.75rem', color: '#64748b' }}>{a.loanCode} · {a.paymentMode}</div>
              </div>
              <button disabled={busyId === a.id} onClick={() => respond(a.id, 'reject')} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #dc2626', color: '#dc2626', background: '#fff', cursor: 'pointer' }}>Reject</button>
              <button disabled={busyId === a.id} onClick={() => respond(a.id, 'approve')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', color: '#fff', background: '#16a34a', cursor: 'pointer', fontWeight: 600 }}>{busyId === a.id ? '…' : 'Approve'}</button>
            </div>
          ))}
        </div>
      )}

      {/* Pay via QR */}
      <div className="card" style={{ padding: 16, borderRadius: 14, background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>📲 Pay via QR</h3>
        <p style={{ fontSize: '.78rem', color: '#64748b', margin: '0 0 10px' }}>Enter the amount, generate a QR, and show it to the agent to scan. It auto-confirms.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₹)" style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }} />
          <button onClick={generateQr} disabled={qrLoading} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>{qrLoading ? '…' : 'Generate QR'}</button>
        </div>
        {err && <div style={{ color: '#dc2626', fontSize: '.8rem', marginTop: 8 }}>{err}</div>}
        {qrDataUrl && qrInfo && (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="payment QR" style={{ width: 200, height: 200 }} />
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>₹{qrInfo.amount.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '.75rem', color: '#64748b' }}>{qrInfo.loanCode} · Instalment #{qrInfo.instalmentNo}</div>
            <div style={{ fontSize: '.72rem', color: '#94a3b8', marginTop: 4 }}>Valid until {new Date(qrInfo.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Single use.</div>
          </div>
        )}
      </div>
    </div>
  );
}
