'use client';

import { Fragment, useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { ChitGroupDividendLedger } from '@/lib/chits/memberDividendLedger';
import DividendBreakdown from './DividendBreakdown';

export default function MemberDividendLedgerPanel({
  ledger,
  currencySymbol,
  dict,
}: {
  ledger: ChitGroupDividendLedger;
  currencySymbol: string;
  dict?: any;
}) {
  const dc = dict?.chits || {};
  const gs = ledger.groupSummary;
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(null);

  const copySummary = () => {
    const lines = [
      `${gs.name} (${gs.groupCode ?? gs.id}) — ${gs.engineName}`,
      `Status: ${gs.isCompleted ? 'Completed' : `${gs.completedPeriodsCount}/${gs.totalPeriods} periods done`}`,
      `Chit Value: ${formatCurrency(gs.chitValue, currencySymbol)}`,
      `Total Dividends Distributed: ${formatCurrency(gs.totalDividendsDistributed, currencySymbol)}`,
      `Total Foreman Commission: ${formatCurrency(gs.totalForemanCommission, currencySymbol)}`,
      `Total Prizes Disbursed: ${formatCurrency(gs.totalPrizesDisbursed, currencySymbol)}`,
      '',
      'Member Statements:',
      ...ledger.memberStatements.map(
        (m) =>
          `Ticket ${m.ticketNo ?? '—'} | ${m.memberName} | Base ${formatCurrency(m.totalGrossBaseDue, currencySymbol)} | Dividend ${formatCurrency(m.totalDividendEarned, currencySymbol)} | Paid ${formatCurrency(m.totalPaid, currencySymbol)} | Prize ${formatCurrency(m.prizeWonAmount, currencySymbol)} | Net Outcome ${formatCurrency(m.netFinancialOutcome, currencySymbol)}`,
      ),
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
      {/* Post-chit / live summary banner */}
      <div className="card">
        <div
          className="card-header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}
        >
          <div>
            <h3 style={{ margin: 0 }}>
              {gs.isCompleted
                ? dc.completedSettlementTitle || 'Chit Completed — Final Dividend & Settlement Ledger'
                : dc.liveDividendLedgerTitle || 'Detailed Chit & Member Dividend Ledger'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
              {gs.engineName} · {gs.completedPeriodsCount}/{gs.totalPeriods} {dc.periodsCompleted || 'periods completed'} ·{' '}
              {gs.dividendPolicy} / {gs.dividendDistribution}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {gs.isCompleted && (
              <span className="badge badge-success">{dc.chitCompletedBadge || 'Chit Done'}</span>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={copySummary}>
              {dc.copySummary || 'Copy Ledger'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              {dc.printLedger || 'Print'}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
            gap: '10px',
            padding: '0 16px 16px',
          }}
        >
          <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>{dc.totalGrossDues || 'Gross Subscriptions'}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{formatCurrency(gs.totalGrossSubscriptions, currencySymbol)}</div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--success)', background: '#f0fdf4' }}>
            <div style={{ fontSize: '.74rem', color: '#166534' }}>{dc.totalDividendsShared || 'Total Dividends Shared'}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d' }}>
              {formatCurrency(gs.totalDividendsDistributed, currencySymbol)}
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>{dc.totalCommissionGst || 'Commission + Rounding'}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              {formatCurrency(gs.totalForemanCommission + gs.totalRoundingIncome, currencySymbol)}
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>{dc.totalPrizesDisbursed || 'Total Prizes'}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{formatCurrency(gs.totalPrizesDisbursed, currencySymbol)}</div>
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>{dc.totalCollectedVsDue || 'Collected / Outstanding'}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>
              {formatCurrency(gs.totalCollected, currencySymbol)} / {formatCurrency(gs.totalOutstanding, currencySymbol)}
            </div>
          </div>
          {gs.totalDeferredBonusPool > 0 && (
            <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>{dc.deferredBonusPool || 'Deferred Bonus Pool'}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{formatCurrency(gs.totalDeferredBonusPool, currencySymbol)}</div>
            </div>
          )}
          {gs.totalGoldGramsAccumulated > 0 && (
            <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>{dc.goldGramsAccumulated || 'Gold Accumulated'}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{gs.totalGoldGramsAccumulated.toFixed(4)} g</div>
            </div>
          )}
          {gs.ascaPoolSummary && (
            <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '.74rem', color: 'var(--text-secondary)' }}>{dc.ascaNetProfit || 'SHG Net Profit Pool'}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{formatCurrency(gs.ascaPoolSummary.netProfit, currencySymbol)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Per-Member Detailed Chit & Dividend Table */}
      <div className="card">
        <div className="card-header">
          <h3>📊 {dc.memberDividendStatementTitle || 'Per-Member Chit & Dividend Breakdown'}</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>{dc.member || 'Member'}</th>
                <th>Share</th>
                <th>Won</th>
                <th>{dc.prize || 'Prize'}</th>
                <th>Gross Due</th>
                <th>{dc.totalDividendEarned || 'Dividend Earned'}</th>
                <th>Deferred / Forfeited</th>
                <th>Prem. / Int.</th>
                <th>Net Payable</th>
                <th>{dc.paid || 'Paid'}</th>
                <th>Outstanding</th>
                <th>Net Outcome</th>
                <th>Savings %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ledger.memberStatements.map((m) => {
                const isOpen = expandedMemberId === m.memberId;
                return (
                  <Fragment key={m.memberId}>
                    <tr>
                      <td>{m.ticketNo ?? '—'}{m.fractionNo ? `-${m.fractionNo}` : ''}{m.isForemanTicket ? ' ★' : ''}</td>
                      <td>
                        <strong>{m.memberName}</strong>
                        <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>{m.customerCode}</div>
                      </td>
                      <td>{m.ticketShare}</td>
                      <td>{m.wonPeriods.length ? m.wonPeriods.map((p) => `P${p}`).join(', ') : '—'}</td>
                      <td>{m.prizeWonAmount > 0 ? formatCurrency(m.prizeWonAmount, currencySymbol) : '—'}</td>
                      <td>{formatCurrency(m.totalGrossBaseDue, currencySymbol)}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                        {formatCurrency(m.totalDividendEarned, currencySymbol)}
                      </td>
                      <td style={{ fontSize: '.78rem' }}>
                        {m.totalDeferredDividend > 0 ? `+${formatCurrency(m.totalDeferredDividend, currencySymbol)}` : '—'}
                        {m.totalForfeitedDividend > 0 ? (
                          <span style={{ color: 'var(--danger)', display: 'block' }}>
                            -{formatCurrency(m.totalForfeitedDividend, currencySymbol)} forfeited
                          </span>
                        ) : null}
                      </td>
                      <td style={{ fontSize: '.78rem' }}>
                        {m.totalPremiumCharged + m.totalWinnerInterest > 0
                          ? formatCurrency(m.totalPremiumCharged + m.totalWinnerInterest, currencySymbol)
                          : '—'}
                      </td>
                      <td>{formatCurrency(m.totalNetPayable, currencySymbol)}</td>
                      <td>{formatCurrency(m.totalPaid, currencySymbol)}</td>
                      <td>{formatCurrency(m.totalOutstanding, currencySymbol)}</td>
                      <td style={{ fontWeight: 700, color: m.netFinancialOutcome >= 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                        {formatCurrency(m.netFinancialOutcome, currencySymbol)}
                        {m.goldTotalGrams > 0 && (
                          <div style={{ fontSize: '.72rem', color: 'var(--primary-dark)' }}>{m.goldTotalGrams.toFixed(4)} g</div>
                        )}
                      </td>
                      <td>{m.effectiveSavingsPct}%</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setExpandedMemberId(isOpen ? null : m.memberId)}
                        >
                          {isOpen ? (dc.hidePeriods || 'Hide') : (dc.viewPeriods || 'Periods')}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={15} style={{ background: 'var(--bg-alt, #f8fafc)', padding: '12px' }}>
                          <div className="table-wrapper">
                            <table>
                              <thead>
                                <tr>
                                  <th>Period</th>
                                  <th>Due Date</th>
                                  <th>Base</th>
                                  <th>Dividend</th>
                                  <th>Deferred</th>
                                  <th>Premium</th>
                                  <th>Interest</th>
                                  <th>Penalty</th>
                                  <th>Net Due</th>
                                  <th>Paid</th>
                                  <th>Outstanding</th>
                                  {m.goldTotalGrams > 0 && <th>Gold (g)</th>}
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.periods.map((p) => (
                                  <tr key={p.periodNumber}>
                                    <td>
                                      P{p.periodNumber}
                                      {p.wonThisPeriod ? ' 🏆' : ''}
                                    </td>
                                    <td>{formatDate(p.dueDate)}</td>
                                    <td>{formatCurrency(p.baseDue, currencySymbol)}</td>
                                    <td style={{ color: p.dividendForfeited ? 'var(--danger)' : 'var(--success)' }}>
                                      {p.dividendForfeited
                                        ? 'Forfeited'
                                        : formatCurrency(p.dividendEarned, currencySymbol)}
                                    </td>
                                    <td>{p.deferredDividend > 0 ? formatCurrency(p.deferredDividend, currencySymbol) : '—'}</td>
                                    <td>{p.premiumAmount > 0 ? formatCurrency(p.premiumAmount, currencySymbol) : '—'}</td>
                                    <td>{p.interestAmount > 0 ? formatCurrency(p.interestAmount, currencySymbol) : '—'}</td>
                                    <td>{p.penaltyAmount > 0 ? formatCurrency(p.penaltyAmount, currencySymbol) : '—'}</td>
                                    <td>{formatCurrency(p.netDue, currencySymbol)}</td>
                                    <td>{formatCurrency(p.paidAmount, currencySymbol)}</td>
                                    <td>{formatCurrency(p.outstanding, currencySymbol)}</td>
                                    {m.goldTotalGrams > 0 && <td>{p.goldGramsCredited.toFixed(4)} g</td>}
                                    <td>{p.status}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Period-by-Period Calculation & Dividend Register */}
      {ledger.periodSummaries.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>🧮 {dc.periodCalculationsTitle || 'Cycle-by-Cycle Calculation & Dividend Register'}</h3>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Date</th>
                  <th>Winner(s)</th>
                  <th>Prize</th>
                  <th>Discount</th>
                  <th>Commission</th>
                  <th>Distributable</th>
                  <th>Dividend / Ticket</th>
                  <th>Net Instalment</th>
                  <th>Rounding</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ledger.periodSummaries.map((ps) => {
                  const isOpen = expandedPeriod === ps.periodNumber;
                  return (
                    <Fragment key={ps.auctionId}>
                      <tr>
                        <td>P{ps.periodNumber}</td>
                        <td>{formatDate(ps.auctionDate)}</td>
                        <td>
                          {ps.winnerNames.map((n, i) => `${n} (#${ps.winnerTicketNos[i] ?? '—'})`).join(', ') || '—'}
                        </td>
                        <td>{formatCurrency(ps.prizeAmount, currencySymbol)}</td>
                        <td>{formatCurrency(ps.bidDiscount, currencySymbol)}</td>
                        <td>{formatCurrency(ps.commission, currencySymbol)}</td>
                        <td>{formatCurrency(ps.distributableDividend, currencySymbol)}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 700 }}>
                          {formatCurrency(ps.dividendPerTicket, currencySymbol)}
                        </td>
                        <td>{formatCurrency(ps.netInstalmentPerFullTicket, currencySymbol)}</td>
                        <td>{ps.roundingIncome > 0 ? formatCurrency(ps.roundingIncome, currencySymbol) : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setExpandedPeriod(isOpen ? null : ps.periodNumber)}
                          >
                            {isOpen ? (dc.hideFormula || 'Hide') : (dc.viewFormula || 'Breakdown')}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={11} style={{ background: 'var(--bg-alt, #f8fafc)', padding: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                              <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <DividendBreakdown
                                  chitValue={ps.breakdown.chitValue}
                                  prizeAmount={ps.breakdown.prizeAmount}
                                  bidDiscount={ps.breakdown.bidDiscount}
                                  commissionPct={ps.breakdown.commissionPct}
                                  commissionBasis={ps.breakdown.commissionBasis}
                                  commission={ps.breakdown.commission}
                                  gstPct={ps.breakdown.gstPct}
                                  gstAmount={ps.breakdown.gstAmount}
                                  distributableDividend={ps.breakdown.distributableDividend}
                                  dividendEligibleMembers={ps.breakdown.dividendEligibleTickets}
                                  dividend={ps.breakdown.dividendPerTicket}
                                  roundingIncome={ps.breakdown.roundingIncome}
                                  dividendPolicy={ps.breakdown.dividendPolicy}
                                  dividendDistribution={ps.breakdown.dividendDistribution}
                                  currencySymbol={currencySymbol}
                                  engineType={ps.breakdown.engineType}
                                  foremanCompensationMode={ps.breakdown.foremanCompensationMode}
                                  reserveFloorAmount={ps.breakdown.reserveFloorAmount}
                                  forfeitedDividendTotal={ps.breakdown.forfeitedDividendTotal}
                                  multiDivisionWinners={ps.breakdown.multiDivisionWinners}
                                  basePlusPremiumDetails={ps.breakdown.basePlusPremiumDetails}
                                  goldDetails={ps.breakdown.goldDetails}
                                  commodityDetails={ps.breakdown.commodityDetails}
                                  ascaDetails={ps.breakdown.ascaDetails}
                                  dict={dict}
                                />
                              </div>
                              <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '320px', overflowY: 'auto' }}>
                                <strong style={{ fontSize: '.85rem', display: 'block', marginBottom: '8px' }}>
                                  Per-Member Impact (Period {ps.periodNumber})
                                </strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '.8rem' }}>
                                  {ps.breakdown.memberBreakdowns.map((mb) => (
                                    <div key={mb.memberId} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
                                      <span>
                                        #{mb.ticketNo ?? '—'} {mb.memberName} ({mb.ticketShare}u · {mb.roleThisPeriod})
                                      </span>
                                      <span>
                                        Div {formatCurrency(mb.dividendEarned, currencySymbol)} · Next Due{' '}
                                        {formatCurrency(mb.netPayableNextPeriod, currencySymbol)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
