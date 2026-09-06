'use client';

import { useEffect, useState } from 'react';

type Props = { subscriptionId: string; outstanding: number };

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50,
};
const modalBox: React.CSSProperties = {
  background: '#fff', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '380px',
  display: 'flex', flexDirection: 'column', gap: '10px',
};
const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', fontSize: '0.88rem', width: '100%',
};
const labelStyle: React.CSSProperties = { fontSize: '0.78rem', color: '#64748b', fontWeight: 600 };

export default function PaymentProofButton({ subscriptionId, outstanding }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState(false);
  const [amount, setAmount] = useState(String(outstanding || ''));
  const [mode, setMode] = useState('upi');
  const [referenceNo, setReferenceNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/borrower/chits/payment-intents')
      .then((r) => (r.ok ? r.json() : { intents: [] }))
      .then((d) => {
        if (cancelled) return;
        const hasPending = (d.intents || []).some((i: any) => i.subscriptionId === subscriptionId && i.status === 'pending');
        setPending(hasPending);
        setChecked(true);
      })
      .catch(() => setChecked(true));
    return () => { cancelled = true; };
  }, [subscriptionId]);

  async function submit() {
    setError('');
    if (!file) { setError('Please attach a screenshot or PDF of your payment.'); return; }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/borrower/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      const res = await fetch('/api/borrower/chits/payment-intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          amount: amount ? Number(amount) : undefined,
          paymentMode: mode,
          referenceNo: referenceNo || undefined,
          proofUrl: uploadData.url,
          proofFileName: uploadData.filename,
          proofMimeType: file.type,
          proofSizeBytes: file.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setPending(true);
      setOpen(false);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  if (pending) {
    return (
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#854d0e', background: '#fef9c3', padding: '5px 10px', borderRadius: '999px', display: 'inline-block' }}>
        Pending review
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', border: 'none', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer' }}
      >
        I've paid — upload proof
      </button>
      {open && (
        <div style={modalOverlay} onClick={() => !busy && setOpen(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>Submit payment proof</div>
            <div>
              <div style={labelStyle}>Amount paid</div>
              <input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>Payment mode</div>
              <select style={inputStyle} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>Reference / UTR number</div>
              <input style={inputStyle} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <div style={labelStyle}>Screenshot or receipt (JPEG/PNG/PDF, max 5MB)</div>
              <input style={inputStyle} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            {error && <div style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: '#0369a1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                {busy ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
