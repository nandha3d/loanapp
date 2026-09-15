'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { formatCurrency } from '@/lib/utils';
import { requestLoanPreclose } from './actions';

export default function LoanPrecloseRequest({ loanId, amount, currencySymbol, dict, request }: {
  loanId: string; amount: number; currencySymbol: string; dict: any;
  request: { status: string; reviewNotes: string | null } | null;
}) {
  const d = dict.precloseRequest;
  const l = dict.loanDetail;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const pending = sent || request?.status === 'pending';

  return <>
    {request?.status === 'rejected' && <p role="status">{d.rejected} {request.reviewNotes}</p>}
    <button className="btn btn-warning" disabled={pending || amount <= 0} onClick={() => { setError(''); setOpen(true); }}>
      {pending ? d.pending : d.title}
    </button>
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title={d.title}>
      <form onSubmit={async event => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        setBusy(true); setError('');
        try {
          const result = await requestLoanPreclose(fd);
          if (result.success) { setSent(true); setOpen(false); router.refresh(); }
          else setError(result.error || d.invalid);
        } catch { setError(d.invalid); }
        finally { setBusy(false); }
      }}>
        <input type="hidden" name="loanId" value={loanId} />
        <input type="hidden" name="amount" value={amount} />
        <p>{d.hint}</p>
        <p><strong>{d.amount}: {formatCurrency(amount, currencySymbol)}</strong></p>
        <div className="form-group">
          <label className="form-label" htmlFor="preclose-request-mode">{l.paymentMode}</label>
          <select className="form-control" id="preclose-request-mode" name="paymentMode" disabled={busy}>
            <option value="cash">{l.cash}</option><option value="upi">{l.upi}</option>
            <option value="cheque">{l.cheque}</option><option value="bank_transfer">{l.bankTransfer}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="preclose-request-remarks">{l.remarksReference}</label>
          <input className="form-control" id="preclose-request-remarks" name="remarks" disabled={busy} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="preclose-request-reason">{dict.approvals.reason}</label>
          <textarea className="form-control" id="preclose-request-reason" name="reason" required disabled={busy} />
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>{l.cancel}</button>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? dict.approvals.processing : d.submit}</button>
        </div>
      </form>
    </Modal>
  </>;
}
