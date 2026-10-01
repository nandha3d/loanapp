'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { formatCurrency } from '@/lib/utils';
import { getForeclosureQuote, requestLoanPreclose } from './actions';
import PenaltyResolutionModal, { type PenaltyResolution } from './PenaltyResolutionModal';

export default function LoanPrecloseRequest({ loanId, currencySymbol, dict, request }: {
  loanId: string; currencySymbol: string; dict: any;
  request: { status: string; reviewNotes: string | null } | null;
}) {
  const d = dict.precloseRequest;
  const l = dict.loanDetail;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  // DEC-01: amount and penalty come from the server quote, not local maths.
  const [quote, setQuote] = useState<any>(null);
  const [penaltyPopup, setPenaltyPopup] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const pending = sent || request?.status === 'pending';
  const amount = Number(quote?.totalSettlementAmount ?? 0);

  const openRequest = async () => {
    setError(''); setOpen(true); setQuote(null);
    const res = await getForeclosureQuote(loanId, 0);
    if (res.success) setQuote(res.data); else setError(res.error || d.invalid);
  };

  const submit = async (resolution: PenaltyResolution | null) => {
    if (!formRef.current) return;
    setPenaltyPopup(false);
    const fd = new FormData(formRef.current);
    if (resolution) fd.set('penaltyResolution', JSON.stringify(resolution));
    setBusy(true); setError('');
    try {
      const result = await requestLoanPreclose(fd);
      if (result.success) { setSent(true); setOpen(false); router.refresh(); }
      else setError(result.error || d.invalid);
    } catch { setError(d.invalid); }
    finally { setBusy(false); }
  };

  return <>
    {request?.status === 'rejected' && <p role="status">{d.rejected} {request.reviewNotes}</p>}
    <button className="btn btn-warning" disabled={pending} onClick={openRequest}>
      {pending ? d.pending : d.title}
    </button>
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title={d.title}>
      <form ref={formRef} onSubmit={event => {
        event.preventDefault();
        if (Number(quote?.penaltyDue ?? 0) > 0) { setPenaltyPopup(true); return; }
        submit(null);
      }}>
        <input type="hidden" name="loanId" value={loanId} />
        <input type="hidden" name="amount" value={amount} />
        <p>{d.hint}</p>
        <p><strong>{d.amount}: {formatCurrency(amount, currencySymbol)}</strong></p>
        {Number(quote?.penaltyDue ?? 0) > 0 && <p>{d.penaltyDue}: {formatCurrency(quote.penaltyDue, currencySymbol)}</p>}
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
          <button className="btn btn-primary" type="submit" disabled={busy || !quote || amount <= 0}>{busy ? dict.approvals.processing : d.submit}</button>
        </div>
      </form>
    </Modal>
    <PenaltyResolutionModal
      isOpen={penaltyPopup}
      penaltyDue={Number(quote?.penaltyDue ?? 0)}
      missedDays={Number(quote?.penaltyMissedDays ?? 0)}
      currencySymbol={currencySymbol}
      dict={dict}
      onCancel={() => setPenaltyPopup(false)}
      onConfirm={submit}
    />
  </>;
}
