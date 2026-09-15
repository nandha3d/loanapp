import { formatCurrency } from '@/lib/utils';

// Shared step-by-step dividend calculation display — the single rendering of
// "here's how we got this number," used by the winner summary (doc 15), a
// group-detail auction row, and the borrower per-period result (doc 22b).
// Pure props-in, server-renderable (no 'use client' needed).

export type DividendBreakdownProps = {
  chitValue: number;
  prizeAmount: number;
  bidDiscount: number;
  commissionPct: number;
  commissionBasis: 'BID_DISCOUNT' | 'CHIT_VALUE';
  commission: number;
  gstPct?: number | null;
  gstAmount: number;
  distributableDividend: number;
  dividendEligibleMembers: number;
  dividend: number;
  roundingIncome: number;
  dividendPolicy: string;
  dividendDistribution: string;
  currencySymbol: string;
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  fontSize: '.88rem',
};
const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)' };
const valueStyle: React.CSSProperties = { fontWeight: 600, color: 'var(--text-primary)' };
const totalRowStyle: React.CSSProperties = {
  ...rowStyle,
  borderTop: '1px solid var(--border)',
  marginTop: '4px',
  paddingTop: '10px',
  fontWeight: 700,
};

function distributionCopy(mode: string): string {
  if (mode === 'CASH_PAYOUT') return 'Dividend paid in cash';
  if (mode === 'ACCUMULATE') return 'Dividend accrued, no cash movement this period';
  return 'Dividend credited to next period\'s due';
}

export default function DividendBreakdown(props: DividendBreakdownProps) {
  const {
    chitValue, prizeAmount, bidDiscount, commissionPct, commissionBasis, commission,
    gstPct, gstAmount, distributableDividend, dividendEligibleMembers, dividend,
    roundingIncome, dividendPolicy, dividendDistribution, currencySymbol,
  } = props;
  const commissionBaseLabel = commissionBasis === 'CHIT_VALUE' ? 'chit value' : 'bid discount';

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={rowStyle}>
        <span style={labelStyle}>Chit value</span>
        <span style={valueStyle}>{formatCurrency(chitValue, currencySymbol)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>− Prize amount</span>
        <span style={valueStyle}>{formatCurrency(prizeAmount, currencySymbol)}</span>
      </div>
      <div style={totalRowStyle}>
        <span>= Bid discount</span>
        <span>{formatCurrency(bidDiscount, currencySymbol)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>− Commission ({commissionPct}% of {commissionBaseLabel})</span>
        <span style={valueStyle}>{formatCurrency(commission, currencySymbol)}</span>
      </div>
      {gstPct != null && gstPct > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>+ GST ({gstPct}% of commission)</span>
          <span style={valueStyle}>{formatCurrency(gstAmount, currencySymbol)}</span>
        </div>
      )}
      <div style={totalRowStyle}>
        <span>= Distributable dividend</span>
        <span>{formatCurrency(distributableDividend, currencySymbol)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>÷ {dividendEligibleMembers} eligible ticket{dividendEligibleMembers === 1 ? '' : 's'}</span>
        <span style={valueStyle}>
          {dividendPolicy === 'NON_WINNERS_ONLY' ? '(winner excluded)' : '(all members)'}
        </span>
      </div>
      <div style={{ ...totalRowStyle, color: 'var(--success)' }}>
        <span>= Dividend per ticket</span>
        <span>{formatCurrency(dividend, currencySymbol)}</span>
      </div>
      {roundingIncome > 0 && (
        <div style={{ ...rowStyle, fontSize: '.75rem', color: 'var(--text-secondary)' }}>
          <span>Rounding income (booked as foreman income)</span>
          <span>{formatCurrency(roundingIncome, currencySymbol)}</span>
        </div>
      )}
      <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '10px', marginBottom: 0 }}>
        {distributionCopy(dividendDistribution)}.
      </p>
    </div>
  );
}
