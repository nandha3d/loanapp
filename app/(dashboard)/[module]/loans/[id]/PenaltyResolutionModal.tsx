'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { formatCurrency } from '@/lib/utils';

export type PenaltyResolution = { action: 'paid' | 'discount' | 'waived'; amount: number; paymentMode: string | null };
export type PenaltyOutcome = { due: number; paid: number; discount: number; waived: number; action: string };

/** DEC-01: the preclose penalty popup — paid / discount / waived. Rules are re-checked on the server. */
export default function PenaltyResolutionModal({ isOpen, penaltyDue, missedDays, currencySymbol, dict, onCancel, onConfirm }: {
  isOpen: boolean; penaltyDue: number; missedDays: number; currencySymbol: string; dict: any;
  onCancel: () => void; onConfirm: (resolution: PenaltyResolution) => void;
}) {
  const d = dict.precloseRequest;
  const l = dict.loanDetail;
  const [action, setAction] = useState<PenaltyResolution['action']>('paid');
  const [collected, setCollected] = useState(0);
  const [mode, setMode] = useState('cash');
  const amount = action === 'paid' ? penaltyDue : action === 'discount' ? collected : 0;
  const valid = action !== 'discount' || (collected > 0 && collected < penaltyDue);

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={d.penaltyTitle}>
      <p><strong>{d.penaltyDue}: {formatCurrency(penaltyDue, currencySymbol)}</strong> ({missedDays} {d.penaltyDays})</p>
      {(['paid', 'discount', 'waived'] as const).map((opt) => (
        <label key={opt} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
          <input type="radio" name="penalty-resolution" checked={action === opt} onChange={() => setAction(opt)} />
          {opt === 'paid' ? d.optPaid : opt === 'discount' ? d.optDiscount : d.optWaived}
        </label>
      ))}
      {action === 'discount' && (
        <div className="form-group">
          <label className="form-label">{d.collected} ({currencySymbol})</label>
          <input type="number" className="form-control" min={0} max={penaltyDue} value={collected || ''}
            onChange={(e) => setCollected(Number(e.target.value) || 0)} />
        </div>
      )}
      {amount > 0 && (
        <div className="form-group">
          <label className="form-label">{l.paymentMode}</label>
          <select className="form-control" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="cash">{l.cash}</option>
            <option value="upi">{l.upi}</option>
            <option value="bank_transfer">{l.bankTransfer}</option>
            <option value="cheque">{l.cheque}</option>
          </select>
        </div>
      )}
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>{l.cancel}</button>
        <button type="button" className="btn btn-primary" disabled={!valid}
          onClick={() => onConfirm({ action, amount, paymentMode: amount > 0 ? mode : null })}>
          {d.continue}
        </button>
      </div>
    </Modal>
  );
}

/** The sentence both clients show after a preclose (and the letter / timeline line). */
export function penaltyOutcomeText(o: PenaltyOutcome, dict: any, fmt: (n: number) => string): string {
  const d = dict.precloseRequest;
  const fill = (t: string) => t.replace('{due}', fmt(o.due)).replace('{paid}', fmt(o.paid)).replace('{discount}', fmt(o.discount));
  if (o.action === 'waived') return fill(d.outcomeWaived);
  if (o.action === 'discount') return fill(d.outcomeDiscount);
  return fill(d.outcomePaid);
}
