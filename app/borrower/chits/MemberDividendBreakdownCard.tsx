'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import DividendBreakdown from '@/components/chits/DividendBreakdown';
import type { MemberPortalDividendStatement } from '@/lib/chits/memberDividendLedger';

export default function MemberDividendBreakdownCard({
  statement,
  currencySymbol = '₹',
  dict,
}: {
  statement: MemberPortalDividendStatement;
  currencySymbol?: string;
  dict?: any;
}) {
  const dc = dict?.chits || {};
  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(null);
  const ms = statement.myStatement;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '14px',
        border: statement.isCompleted ? '2px solid #16a34a' : '1px solid #e2e8f0',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>{statement.groupName}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {statement.groupCode ? `${statement.groupCode} · ` : ''}Ticket #{ms.ticketNo ?? '—'}
            {ms.ticketShare !== 1 ? ` (${ms.ticketShare} share)` : ''} · {statement.engineName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
            {statement.dividendPolicy} · {statement.dividendDistribution} · {statement.payoutAssetType}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '999px',
              background: statement.isCompleted ? '#dcfce7' : '#e0f2fe',
              color: statement.isCompleted ? '#166534' : '#075985',
            }}
          >
            {statement.isCompleted
              ? dc.completedSettlementTitle || 'Chit Completed — Final Dividend Statement'
              : `${statement.completedPeriodsCount} / ${statement.totalPeriods} cycles completed`}
          </span>
        </div>
      </div>

      {/* Member Lifetime Financial & Dividend Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '8px' }}>
        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{dc.totalGrossDues || 'Gross Base Dues'}</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(ms.totalGrossBaseDue, currencySymbol)}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '10px', border: '1px solid #86efac' }}>
          <div style={{ fontSize: '0.72rem', color: '#166534' }}>{dc.totalDividendEarned || 'Total Dividend Earned'}</div>
          <div style={{ fontWeight: 800, color: '#15803d', fontSize: '1.05rem' }}>
            {formatCurrency(ms.totalDividendEarned, currencySymbol)}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#166534' }}>Savings {ms.effectiveSavingsPct}%</div>
        </div>
        {ms.totalDeferredDividend > 0 && (
          <div style={{ background: '#fefce8', padding: '10px', borderRadius: '10px', border: '1px solid #fde047' }}>
            <div style={{ fontSize: '0.72rem', color: '#854d0e' }}>{dc.deferredBonusPool || 'Deferred Bonus'}</div>
            <div style={{ fontWeight: 700, color: '#854d0e' }}>{formatCurrency(ms.totalDeferredDividend, currencySymbol)}</div>
          </div>
        )}
        {ms.totalForfeitedDividend > 0 && (
          <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '10px', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '0.72rem', color: '#991b1b' }}>{dc.forfeitedDividendLabel || 'Forfeited (Late)'}</div>
            <div style={{ fontWeight: 700, color: '#991b1b' }}>{formatCurrency(ms.totalForfeitedDividend, currencySymbol)}</div>
          </div>
        )}
        {(ms.totalPremiumCharged > 0 || ms.totalWinnerInterest > 0) && (
          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Premium + Interest</div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>
              {formatCurrency(ms.totalPremiumCharged + ms.totalWinnerInterest, currencySymbol)}
            </div>
          </div>
        )}
        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{dc.paid || 'Total Paid'} / Due</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>
            {formatCurrency(ms.totalPaid, currencySymbol)} / {formatCurrency(ms.totalOutstanding, currencySymbol)}
          </div>
        </div>
        {ms.prizeWonAmount > 0 && (
          <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.72rem', color: '#1e40af' }}>Prize Won (P{ms.wonPeriods.join(', P')})</div>
            <div style={{ fontWeight: 700, color: '#1d4ed8' }}>{formatCurrency(ms.prizeWonAmount, currencySymbol)}</div>
          </div>
        )}
        {ms.goldTotalGrams > 0 && (
          <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.72rem', color: '#92400e' }}>Gold Accumulated</div>
            <div style={{ fontWeight: 700, color: '#b45309' }}>
              {ms.goldTotalGrams.toFixed(4)} g ({formatCurrency(ms.goldWeightedAvgRate, currencySymbol)}/g avg)
            </div>
          </div>
        )}
        {ms.maturityRedemptionValue > 0 && (
          <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '10px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.72rem', color: '#92400e' }}>Maturity Redemption</div>
            <div style={{ fontWeight: 700, color: '#b45309' }}>{formatCurrency(ms.maturityRedemptionValue, currencySymbol)}</div>
          </div>
        )}
        {ms.ascaProfitShare > 0 && (
          <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.72rem', color: '#166534' }}>SHG Profit Share</div>
            <div style={{ fontWeight: 700, color: '#15803d' }}>{formatCurrency(ms.ascaProfitShare, currencySymbol)}</div>
          </div>
        )}
        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
          <div style={{ fontSize: '0.72rem', color: '#475569' }}>{dc.netFinancialOutcome || 'Net Benefit / Outcome'}</div>
          <div style={{ fontWeight: 800, color: ms.netFinancialOutcome >= 0 ? '#15803d' : '#0f172a' }}>
            {formatCurrency(ms.netFinancialOutcome, currencySymbol)}
          </div>
        </div>
      </div>

      {/* Period-by-Period Calculation & Member Dividend Breakdown */}
      {statement.completedPeriods.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155', marginBottom: '8px' }}>
            {dc.periodCalculationsTitle || 'Completed Cycles — Calculation & Your Dividend Details'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {statement.completedPeriods.map((cp) => {
              const isOpen = expandedPeriod === cp.periodNumber;
              return (
                <div
                  key={cp.auctionId}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                        Cycle {cp.periodNumber} · {formatDate(cp.auctionDate)}
                        {cp.iWon ? ' 🏆 (You Won)' : cp.winnerTicketNo ? ` · Winner Ticket #${cp.winnerTicketNo}` : ''}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                        Prize {formatCurrency(cp.prizeAmount, currencySymbol)} · Discount {formatCurrency(cp.bidDiscount, currencySymbol)} ·{' '}
                        Dividend/Ticket {formatCurrency(cp.dividendPerTicket, currencySymbol)} ·{' '}
                        <strong style={{ color: cp.forfeitedOnLate ? '#b91c1c' : '#15803d' }}>
                          {cp.forfeitedOnLate
                            ? 'Dividend forfeited (late payment)'
                            : cp.excludedFromDividend
                              ? 'Excluded (winner policy)'
                              : `Your Dividend: ${formatCurrency(cp.myDividend, currencySymbol)}`}
                        </strong>
                        {cp.myNextDue != null ? ` · Next Due: ${formatCurrency(cp.myNextDue, currencySymbol)}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExpandedPeriod(isOpen ? null : cp.periodNumber)}
                    >
                      {isOpen ? (dc.hideFormula || 'Hide Math') : (dc.viewFormula || 'See Calculation')}
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: '10px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <DividendBreakdown
                        chitValue={cp.chitValue}
                        prizeAmount={cp.prizeAmount}
                        bidDiscount={cp.bidDiscount}
                        commissionPct={cp.commissionPct}
                        commissionBasis={cp.commissionBasis}
                        commission={cp.commission}
                        gstPct={cp.gstPct}
                        gstAmount={cp.gstAmount}
                        distributableDividend={cp.distributableDividend}
                        dividendEligibleMembers={cp.dividendEligibleMembers}
                        dividend={cp.dividendPerTicket}
                        roundingIncome={cp.roundingIncome}
                        dividendPolicy={statement.dividendPolicy}
                        dividendDistribution={statement.dividendDistribution}
                        currencySymbol={currencySymbol}
                        engineType={statement.chitEngineType}
                        foremanCompensationMode={cp.foremanCompensationMode}
                        reserveFloorAmount={cp.reserveFloorAmount}
                        multiDivisionWinners={cp.multiDivisionWinners}
                        dict={dict}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
