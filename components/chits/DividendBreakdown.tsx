import { formatCurrency } from '@/lib/utils';
import type { ChitPeriodCalculationBreakdown } from '@/lib/chits/engineCalculator';

// Shared step-by-step dividend calculation display — the single rendering of
// "here's how we got this number," used by the winner summary, group ledger,
// and borrower portal per-period breakdown. Pure props-in, server-renderable.

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
  engineType?: string | null;
  foremanCompensationMode?: string | null;
  reserveFloorAmount?: number | null;
  forfeitedDividendTotal?: number | null;
  multiDivisionWinners?: Array<{
    ticketNo?: string | null;
    memberName?: string;
    winType: string;
    prizeAmount: number;
    bidDiscount: number;
  }> | null;
  basePlusPremiumDetails?: ChitPeriodCalculationBreakdown['basePlusPremiumDetails'];
  goldDetails?: ChitPeriodCalculationBreakdown['goldDetails'];
  commodityDetails?: ChitPeriodCalculationBreakdown['commodityDetails'];
  ascaDetails?: ChitPeriodCalculationBreakdown['ascaDetails'];
  dict?: any;
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  fontSize: '.88rem',
  gap: '12px',
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

function distributionCopy(mode: string, dc?: any): string {
  if (mode === 'CASH_PAYOUT') return dc?.distCashPayout || 'Dividend paid in cash';
  if (mode === 'ACCUMULATE') return dc?.distAccumulate || 'Dividend accrued, no cash movement this period';
  if (mode === 'DEFERRED_BONUS_POOL') return dc?.distDeferredPool || 'Dividend added to deferred maturity bonus pool';
  if (mode === 'NONE') return dc?.distNone || 'No dividend distributed for this chit type';
  return dc?.distAdjustNextDue || 'Dividend credited to next period\'s due';
}

export default function DividendBreakdown(props: DividendBreakdownProps) {
  const {
    chitValue,
    prizeAmount,
    bidDiscount,
    commissionPct,
    commissionBasis,
    commission,
    gstPct,
    gstAmount,
    distributableDividend,
    dividendEligibleMembers,
    dividend,
    roundingIncome,
    dividendPolicy,
    dividendDistribution,
    currencySymbol,
    engineType,
    foremanCompensationMode,
    reserveFloorAmount,
    forfeitedDividendTotal,
    multiDivisionWinners,
    basePlusPremiumDetails,
    goldDetails,
    commodityDetails,
    ascaDetails,
    dict,
  } = props;
  const dc = dict?.chits || {};
  const commissionBaseLabel = commissionBasis === 'CHIT_VALUE' ? 'chit value' : 'bid discount';
  const eligiblePolicyText =
    dividendPolicy === 'NON_WINNERS_ONLY'
      ? '(winner excluded)'
      : dividendPolicy === 'NON_PRIZED_ONLY'
        ? '(non-prized only)'
        : dividendPolicy === 'NONE'
          ? '(no dividend)'
          : '(all members)';

  return (
    <div style={{ padding: '4px 0' }}>
      {engineType && (
        <div style={{ ...rowStyle, fontSize: '.78rem', color: 'var(--text-secondary)' }}>
          <span>{dc.engineTypeLabel || 'Chit engine'}</span>
          <code>{engineType}</code>
        </div>
      )}
      {reserveFloorAmount != null && reserveFloorAmount > 0 && (
        <div style={{ ...rowStyle, fontSize: '.82rem', color: 'var(--primary-dark)' }}>
          <span>{dc.reserveFloorLabel || 'Cycle reserve floor discount (R_t)'}</span>
          <span>{formatCurrency(reserveFloorAmount, currencySymbol)}</span>
        </div>
      )}

      <div style={rowStyle}>
        <span style={labelStyle}>{dc.chitValue || 'Chit value'}</span>
        <span style={valueStyle}>{formatCurrency(chitValue, currencySymbol)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>− {dc.prizeAmount || 'Prize amount'}</span>
        <span style={valueStyle}>{formatCurrency(prizeAmount, currencySymbol)}</span>
      </div>
      <div style={totalRowStyle}>
        <span>= {dc.bidDiscount || 'Bid discount'}</span>
        <span>{formatCurrency(bidDiscount, currencySymbol)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>
          − {dc.commissionLabel || 'Commission'} (
          {foremanCompensationMode && foremanCompensationMode !== 'PERCENTAGE_COMMISSION'
            ? foremanCompensationMode
            : `${commissionPct}% of ${commissionBaseLabel}`}
          )
        </span>
        <span style={valueStyle}>{formatCurrency(commission, currencySymbol)}</span>
      </div>
      {gstPct != null && gstPct > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>+ GST ({gstPct}% of commission)</span>
          <span style={valueStyle}>{formatCurrency(gstAmount, currencySymbol)}</span>
        </div>
      )}
      <div style={totalRowStyle}>
        <span>= {dc.distributableDividend || 'Distributable dividend'}</span>
        <span>{formatCurrency(distributableDividend, currencySymbol)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>
          ÷ {dividendEligibleMembers} eligible ticket{dividendEligibleMembers === 1 ? '' : 's'}
        </span>
        <span style={valueStyle}>{eligiblePolicyText}</span>
      </div>
      <div style={{ ...totalRowStyle, color: 'var(--success)' }}>
        <span>= {dc.dividendPerTicket || 'Dividend per ticket'}</span>
        <span>{formatCurrency(dividend, currencySymbol)}</span>
      </div>

      {roundingIncome > 0 && (
        <div style={{ ...rowStyle, fontSize: '.78rem', color: 'var(--text-secondary)' }}>
          <span>{dc.roundingIncomeLabel || 'Rounding income (booked as foreman income)'}</span>
          <span>{formatCurrency(roundingIncome, currencySymbol)}</span>
        </div>
      )}

      {forfeitedDividendTotal != null && forfeitedDividendTotal > 0 && (
        <div style={{ ...rowStyle, fontSize: '.78rem', color: 'var(--danger)' }}>
          <span>{dc.forfeitedDividendLabel || 'Forfeited late-payer dividend'}</span>
          <span>{formatCurrency(forfeitedDividendTotal, currencySymbol)}</span>
        </div>
      )}

      {multiDivisionWinners && multiDivisionWinners.length > 0 && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '.8rem' }}>
          <strong>{dc.multiDivisionWinnersLabel || 'Multi-division winners'}</strong>
          {multiDivisionWinners.map((w, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>
                #{w.ticketNo ?? idx + 1} {w.memberName ? `${w.memberName} ` : ''}({w.winType})
              </span>
              <span>
                Prize {formatCurrency(w.prizeAmount, currencySymbol)} · Disc {formatCurrency(w.bidDiscount, currencySymbol)}
              </span>
            </div>
          ))}
        </div>
      )}

      {basePlusPremiumDetails && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Non-prized / Prized due:</span>
            <span>
              {formatCurrency(basePlusPremiumDetails.nonPrizedInstalment, currencySymbol)} /{' '}
              {formatCurrency(basePlusPremiumDetails.prizedInstalment, currencySymbol)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cycle pool collected ({basePlusPremiumDetails.alreadyPrizedTicketUnits} prized):</span>
            <span>{formatCurrency(basePlusPremiumDetails.collectedPool, currencySymbol)}</span>
          </div>
        </div>
      )}

      {goldDetails && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '.8rem' }}>
          {goldDetails.goldRatePerGram > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Bullion rate / Credit per ticket:</span>
              <span>
                {formatCurrency(goldDetails.goldRatePerGram, currencySymbol)}/g · {goldDetails.gramsPerFullTicket.toFixed(4)} g
              </span>
            </div>
          )}
          {(goldDetails.bonusMonths > 0 || goldDetails.bonusPct > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Maturity merchant bonus:</span>
              <span>
                {goldDetails.bonusMonths > 0 ? `${goldDetails.bonusMonths} month(s)` : `${goldDetails.bonusPct}%`}
              </span>
            </div>
          )}
        </div>
      )}

      {commodityDetails && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '.8rem' }}>
          <div>Goods bundle: {commodityDetails.itemsSummary}</div>
        </div>
      )}

      {ascaDetails && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '.8rem' }}>
          <div>Internal loan rate: {ascaDetails.monthlyLoanInterestPct}% / month</div>
        </div>
      )}

      <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '10px', marginBottom: 0 }}>
        {distributionCopy(dividendDistribution, dc)}.
      </p>
    </div>
  );
}
