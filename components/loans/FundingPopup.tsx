'use client';

import Modal from '@/components/Modal';
import { fillTemplate, fundingWalletLink, type FundingView } from '@/lib/loanFundingPolicy';

export type { FundingView };

const fmt = (symbol: string, n: number) => `${symbol}${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Placeholder values for the loanFunding dictionary strings — formatting only. */
export function fundingVars(funding: FundingView, currencySymbol: string, agentName?: string | null) {
  return {
    agent: agentName ?? '—',
    required: fmt(currencySymbol, funding.required),
    available: fmt(currencySymbol, funding.available),
    shortfall: fmt(currencySymbol, funding.shortfall),
    committed: fmt(currencySymbol, funding.committed),
    queueShortfall: fmt(currencySymbol, funding.queueShortfall),
    pool: fmt(currencySymbol, funding.branchPool ?? 0),
    capital: fmt(currencySymbol, funding.capitalNeeded),
    amount: fmt(currencySymbol, funding.shortfall),
  };
}

/**
 * FUND-2/FUND-4 popup. Renders the server's funding figures — never derives
 * any — and offers the one action that unblocks the loan: add capital to the
 * branch pool, or release float to the agent. `canAct` is false for agents,
 * who cannot move company cash.
 */
export default function FundingPopup({
  funding,
  onClose,
  dict,
  currencySymbol,
  appType,
  canAct,
  submitted = false,
  agentName,
}: {
  funding: FundingView | null;
  onClose: () => void;
  dict: { loanFunding: Record<string, string> };
  currencySymbol: string;
  appType: string;
  canAct: boolean;
  /** The loan was queued for approval despite the shortfall (agent flow). */
  submitted?: boolean;
  agentName?: string | null;
}) {
  if (!funding) return null;
  const d = dict.loanFunding;
  const isAgent = funding.source === 'agent';
  const vars = fundingVars(funding, currencySymbol, agentName);
  const body = !isAgent ? d.capitalPopupBody : agentName ? d.approveBlocked : d.floatPopupBody;
  const rows: Array<[string, number, boolean?]> = [
    [d.labelRequired, funding.required],
    [isAgent ? d.labelFloat : d.labelPool, funding.available],
    ...(isAgent && funding.committed > 0 ? [[d.labelCommitted, funding.committed] as [string, number]] : []),
    [d.labelShort, funding.shortfall, true],
  ];

  return (
    <Modal isOpen onClose={onClose} title={isAgent ? d.floatPopupTitle : d.capitalPopupTitle}>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {submitted && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--success)', fontWeight: 600 }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>task_alt</span>
            {d.sentForApproval}
          </div>
        )}
        <p style={{ margin: 0 }}>{fillTemplate(body, vars)}</p>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {rows.map(([label, value, strong]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 12px', borderTop: '1px solid var(--border)', fontWeight: strong ? 700 : 500, color: strong ? 'var(--danger)' : 'var(--text)' }}>
              <span>{label}</span>
              <span>{fmt(currencySymbol, value)}</span>
            </div>
          ))}
        </div>
        {isAgent && funding.committed > 0 && <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--text-secondary)' }}>{fillTemplate(d.queueNote, vars)}</p>}
        {isAgent && canAct && funding.capitalNeeded > 0 && <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--warning)' }}>{fillTemplate(d.capitalFirst, vars)}</p>}
        {submitted && funding.alertsSent && <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--text-secondary)' }}>{d.adminsNotified}</p>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{d.close}</button>
          {canAct && (
            <a className="btn btn-primary" href={fundingWalletLink(appType, funding)}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{isAgent ? 'send' : 'add_card'}</span>
              {isAgent ? fillTemplate(d.releaseAmount, vars) : d.addCapital}
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}
