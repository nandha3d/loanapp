import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ChitPeriodReportData } from './periodReport';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    padding: 30,
    paddingBottom: 46,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  topMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#7D287E',
  },
  brandSub: {
    fontSize: 7.5,
    color: '#4B5563',
    marginTop: 1,
  },
  rightMeta: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#4B5563',
  },
  titleBox: {
    borderWidth: 1.5,
    borderColor: '#111827',
    borderStyle: 'solid',
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#F9F1FA',
    alignItems: 'center',
  },
  titleBoxText: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    textAlign: 'center',
  },
  titleBoxSub: {
    fontSize: 7.5,
    color: '#5A195B',
    marginTop: 2,
    textAlign: 'center',
  },
  tableOuter: {
    borderWidth: 1,
    borderColor: '#111827',
    borderStyle: 'solid',
    marginBottom: 10,
  },
  tableHeadRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  thText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#111827',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.75,
    borderBottomColor: '#CBD5E1',
    borderBottomStyle: 'solid',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  trAlt: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 0.75,
    borderBottomColor: '#CBD5E1',
    borderBottomStyle: 'solid',
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  trGreen: {
    flexDirection: 'row',
    backgroundColor: '#DCFCE7',
    borderTopWidth: 1,
    borderTopColor: '#111827',
    borderTopStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    borderBottomStyle: 'solid',
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tdSubNote: {
    fontSize: 7,
    color: '#4B5563',
    marginTop: 1,
  },
  sectionBanner: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F7',
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    borderBottomStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  sectionBannerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#1E293B',
  },
  redLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: '#DC2626',
  },
  greenAmount: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: '#B91C1C',
    textAlign: 'right',
  },
  yellowCell: {
    backgroundColor: '#FEF08A',
  },
  summaryStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: '#CBD5E1',
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 7,
    backgroundColor: '#F9FAFB',
  },
  summaryCardTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#5A195B',
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    paddingBottom: 2,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  kvLbl: {
    fontSize: 7.5,
    color: '#4B5563',
  },
  kvVal: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  subHead: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#5A195B',
    backgroundColor: '#F9F1FA',
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#7D287E',
    borderLeftStyle: 'solid',
  },
  miniHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  miniTh: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  miniTr: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    paddingVertical: 3.5,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  miniTd: {
    fontSize: 7.2,
    color: '#1F2937',
  },
  minutesBox: {
    borderWidth: 0.75,
    borderColor: '#D1D5DB',
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 7,
    backgroundColor: '#F9FAFB',
    fontSize: 7.5,
    color: '#374151',
    lineHeight: 1.35,
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 30,
    right: 30,
    borderTopWidth: 0.5,
    borderTopColor: '#CBD5E1',
    borderTopStyle: 'solid',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#6B7280',
  },
});

// Columns matching the framed boxed sheet aesthetic (sum to 100%)
const C = { sl: '11%', desc: '63%', amt: '26%' };

export function ChitPeriodReportPDF({ data }: { data: ChitPeriodReportData }) {
  // Helvetica lacks '₹' glyph (renders as ¹); always use ASCII-safe 'Rs.' when currencySymbol is '₹'
  const sym = !data.currencySymbol || data.currencySymbol === '₹' ? 'Rs.' : data.currencySymbol;
  const fmt = (n: number | null | undefined, decimals = 0) =>
    `${sym} ${Number(n ?? 0).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const s = data.statement;
  const winnerTitle = data.auction.winnerName
    ? `${data.auction.winnerName}${data.auction.winnerTicketNo ? ` (Ticket #${data.auction.winnerTicketNo})` : ''}`
    : 'Winner Pending';

  const padRows = Math.max(0, 4 - data.payouts.rows.length);

  return (
    <Document>
      {/* PAGE 1: Framed Settlement Sheet + Money Flow + Payout & Denomination Reconciliation + Security */}
      <Page size="A4" style={styles.page}>
        <View style={styles.topMeta}>
          <View>
            <Text style={styles.brandTitle}>{data.tenantName}</Text>
            <Text style={styles.brandSub}>
              {data.branchName} · {data.group.engineLabel} · {data.group.chitType.toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.rightMeta}>
              Group: {data.group.groupCode || data.group.id.slice(-8)} · {data.group.frequency}
            </Text>
            <Text style={styles.rightMeta}>
              Status: {data.auction.status.toUpperCase()} · Payout: {data.auction.payoutStatus.toUpperCase()}
            </Text>
            <Text style={styles.rightMeta}>Generated: {fmtDate(data.generatedAt)}</Text>
          </View>
        </View>

        {/* Top Framed Title Box */}
        <View style={styles.titleBox}>
          <Text style={styles.titleBoxText}>
            {data.group.name} ({fmt(s.chitValue)}) — Period {data.auction.periodNumber} of {data.group.totalMembers} — {fmtDate(data.auction.auctionDate)}
          </Text>
          <Text style={styles.titleBoxSub}>
            {data.templateSectionTitle} · {data.group.totalMembers} Members · Base Due {fmt(s.baseInstallment)} · Comm {data.group.commissionPct}% ({data.group.commissionBasis})
          </Text>
        </View>

        {/* Framed Core Period Statement & Settlement Table */}
        <View style={styles.tableOuter}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.thText, { width: C.sl, textAlign: 'center' }]}>Sl.No</Text>
            <Text style={[styles.thText, { width: C.desc }]}>Description — {winnerTitle}</Text>
            <Text style={[styles.thText, { width: C.amt, textAlign: 'right' }]}>Amount ({sym})</Text>
          </View>

          <View style={styles.trAlt}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>1</Text>
            <View style={{ width: C.desc }}>
              <Text>Total Chit Value (Gross Pool = {data.group.totalMembers} x {fmt(s.baseInstallment)})</Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmt(s.chitValue)}</Text>
          </View>

          <View style={styles.tr}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>2</Text>
            <View style={{ width: C.desc }}>
              <Text>{s.row2Title}</Text>
              <Text style={styles.tdSubNote}>{s.row2Note}</Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right' }}>{fmt(s.bidDiscount)}</Text>
          </View>

          <View style={styles.trAlt}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>3</Text>
            <View style={{ width: C.desc }}>
              <Text>{s.row3Title}</Text>
              <Text style={styles.tdSubNote}>
                Foreman Fee/Ticket: {fmt(s.foremanFeePerTicket)}{s.gstAmount > 0 ? ` · GST: ${fmt(s.gstAmount)}` : ''}{s.roundingIncome > 0 ? ` · Rounding Income: ${fmt(s.roundingIncome)}` : ''}
              </Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmt(s.commission)}</Text>
          </View>

          <View style={styles.tr}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>4</Text>
            <View style={{ width: C.desc }}>
              <Text>{s.row4Title}</Text>
              <Text style={styles.tdSubNote}>{s.row4Note}</Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
              {s.dividendPerTicket > 0 ? fmt(s.dividendPerTicket) : s.deferredDividendTotal > 0 ? fmt(s.deferredDividendTotal) : fmt(0)}
            </Text>
          </View>

          <View style={styles.trAlt}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>5</Text>
            <View style={{ width: C.desc }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{s.row5Title}</Text>
              <Text style={styles.tdSubNote}>
                {Math.abs(s.prizedMemberInstallment - s.netMemberInstallment) > 0.01
                  ? `Non-Prized: ${fmt(s.netMemberInstallment)} · Prized Member: ${fmt(s.prizedMemberInstallment)} · `
                  : `Base ${fmt(s.baseInstallment)} - Net Dividend ${fmt(s.dividendPerTicket)} · `}
                {s.verificationFormulaLine}
              </Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>
              {Math.abs(s.prizedMemberInstallment - s.netMemberInstallment) > 0.01
                ? `${fmt(s.netMemberInstallment)} / ${fmt(s.prizedMemberInstallment)}`
                : fmt(s.netMemberInstallment)}
            </Text>
          </View>

          <View style={styles.tr}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>6</Text>
            <View style={{ width: C.desc }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                Winner&apos;s Current Period Installment ({s.winnerPeriodInstallmentUnpaid === 0 && s.winnerPeriodInstallmentPaid > 0 ? 'Already Paid' : 'Deducted from Prize'})
              </Text>
              <Text style={styles.tdSubNote}>
                Due: {fmt(s.winnerPeriodInstallmentDue)} · Paid: {fmt(s.winnerPeriodInstallmentPaid)} · Unpaid Deduction: {fmt(s.winnerPeriodInstallmentUnpaid)}
              </Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmt(s.winnerPeriodInstallmentUnpaid)}</Text>
          </View>

          {/* Green Highlighted Bar: Net Payable to Winner */}
          <View style={styles.trGreen}>
            <Text style={{ width: C.sl, textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>NET</Text>
            <View style={{ width: C.desc }}>
              <Text style={styles.redLabel}>Net Payable in Winner&apos;s Hand</Text>
              <Text style={styles.tdSubNote}>
                Prize Payout {fmt(s.prizePayoutTotal)} - Winner Unpaid Installment {fmt(s.winnerPeriodInstallmentUnpaid)}
              </Text>
            </View>
            <Text style={styles.greenAmount}>{fmt(s.netPayableAfterWinnerInstallment)}</Text>
          </View>

          {/* Payout & Settlement Transfers Sub-table */}
          <View style={styles.sectionBanner}>
            <Text style={styles.sectionBannerText}>Payout &amp; Mode Settlement Breakdown</Text>
          </View>

          {data.payouts.rows.map((row, idx) => (
            <View key={row.slNo} style={idx % 2 === 1 ? styles.trAlt : styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center' }}>{row.slNo}</Text>
              <View style={{ width: C.desc }}>
                <Text>{row.description}</Text>
                <Text style={styles.tdSubNote}>{row.modeOrRef}</Text>
              </View>
              <Text style={{ width: C.amt, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmt(row.amount)}</Text>
            </View>
          ))}
          {data.payouts.rows.length === 0 && (
            <View style={styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center' }}>1</Text>
              <Text style={{ width: C.desc, color: '#6B7280' }}>No prize payout receipt posted yet (Payout Status: {data.auction.payoutStatus})</Text>
              <Text style={{ width: C.amt, textAlign: 'right' }}>{fmt(0)}</Text>
            </View>
          )}
          {Array.from({ length: padRows }).map((_, idx) => (
            <View key={`pad-${idx}`} style={styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center', color: '#9CA3AF' }}>
                {Math.max(1, data.payouts.rows.length) + idx + 1}
              </Text>
              <Text style={{ width: C.desc }}> </Text>
              <Text style={{ width: C.amt }}> </Text>
            </View>
          ))}

          {/* Total Disbursed */}
          <View style={[styles.tr, { backgroundColor: '#F3F4F6' }]}>
            <Text style={{ width: C.sl }}> </Text>
            <Text style={[styles.redLabel, { width: C.desc, textAlign: 'right', paddingRight: 10 }]}>Total Disbursed to Winner</Text>
            <Text style={{ width: C.amt, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 9.5 }}>
              {fmt(data.payouts.totalDisbursedToWinner)}
            </Text>
          </View>

          {/* Target vs Disbursed vs Balance */}
          <View style={[styles.tr, { paddingVertical: 0, paddingHorizontal: 0 }]}>
            <Text style={{ width: C.sl, padding: 5, textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>BAL</Text>
            <View style={{ width: '31.5%', padding: 5, borderLeftWidth: 0.75, borderLeftColor: '#CBD5E1', borderLeftStyle: 'solid' }}>
              <Text style={{ fontSize: 7, color: '#6B7280' }}>Target Gross Payout</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmt(s.prizePayoutTotal)}</Text>
            </View>
            <View style={{ width: '31.5%', padding: 5, borderLeftWidth: 0.75, borderLeftColor: '#CBD5E1', borderLeftStyle: 'solid' }}>
              <Text style={{ fontSize: 7, color: '#6B7280' }}>Paid Disbursed</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmt(data.payouts.totalDisbursedToWinner)}</Text>
            </View>
            <View style={[styles.yellowCell, { width: C.amt, padding: 5, borderLeftWidth: 0.75, borderLeftColor: '#111827', borderLeftStyle: 'solid' }]}>
              <Text style={{ fontSize: 7, color: '#111827', textAlign: 'right' }}>Balance Pending</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>{fmt(data.payouts.remainingPayoutBalance)}</Text>
            </View>
          </View>

          {/* Cash Denomination Rows */}
          {data.denominations.map((den) => (
            <View key={den.denomination} style={[styles.tr, { paddingVertical: 3.5 }]}>
              <Text style={{ width: C.sl, textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>
                {den.denomination}
              </Text>
              <Text style={{ width: C.desc, fontSize: 8, color: '#4B5563' }}>
                Cash Note Count: {den.count > 0 ? `${den.count} notes x ${sym} ${den.denomination}` : '0 notes (Digital / Nil)'}
              </Text>
              <Text style={{ width: C.amt, textAlign: 'right' }}>{den.amount}</Text>
            </View>
          ))}

          <View style={[styles.tr, { borderBottomWidth: 0, paddingVertical: 0, paddingHorizontal: 0 }]}>
            <Text style={{ width: '74%', padding: 5, textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>
              Total Cash Denomination Payout
            </Text>
            <View style={[styles.yellowCell, { width: C.amt, padding: 5, borderLeftWidth: 0.75, borderLeftColor: '#111827', borderLeftStyle: 'solid' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', textAlign: 'right', fontSize: 9.5 }}>
                {fmt(data.denominationCashTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* Template-Specific Mechanics & Engine Equation Card */}
        {(data.basePlusPremium || data.gold || data.commodity || data.asca || data.formulaLines.length > 0) && (
          <View style={[styles.summaryCard, { flex: 0, marginBottom: 8 }]}>
            <Text style={styles.summaryCardTitle}>
              {data.group.engineLabel} — Period Formula &amp; Template Parameters
            </Text>
            {data.basePlusPremium && (
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>
                  Differential Dues (Non-Prized {fmt(data.basePlusPremium.nonPrizedInstalment)} / Prized {fmt(data.basePlusPremium.prizedInstalment)} · {data.basePlusPremium.alreadyPrizedTicketUnits} prized)
                </Text>
                <Text style={styles.kvVal}>
                  Pool {fmt(data.basePlusPremium.collectedPool)} · Surplus {fmt(data.basePlusPremium.poolSurplus)}
                </Text>
              </View>
            )}
            {data.gold && (
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>
                  Bullion Rate: {fmt(data.gold.goldRatePerGram)}/g{data.gold.gramsPerFullTicket > 0 ? ` · Weight Credit: ${data.gold.gramsPerFullTicket} g/ticket` : ''}
                </Text>
                <Text style={styles.kvVal}>
                  Bonus: {data.gold.bonusMonths > 0 ? `${data.gold.bonusMonths} mo` : `${data.gold.bonusPct}%`}
                </Text>
              </View>
            )}
            {data.commodity && (
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>Commodity Basket: {data.commodity.itemsSummary}</Text>
                <Text style={styles.kvVal}>
                  Merchant Bonus: {data.commodity.merchantBonusPct}%{data.commodity.merchantBonusAmount > 0 ? ` + ${fmt(data.commodity.merchantBonusAmount)}` : ''}
                </Text>
              </View>
            )}
            {data.asca && (
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>SHG Internal Loan Interest: {data.asca.monthlyLoanInterestPct}% / month</Text>
                <Text style={styles.kvVal}>Admin Expense / Cycle: {fmt(data.asca.adminExpensePerCycle)}</Text>
              </View>
            )}
            {data.formulaLines.length > 0 && (
              <Text style={{ fontSize: 7, color: '#374151', marginTop: 2 }}>
                {data.formulaLines.join('  |  ')}
              </Text>
            )}
          </View>
        )}

        {/* Money Flow & Security Summary Strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Pool Money Flow &amp; Collections</Text>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>{s.otherMembersCount} Other Members Expected:</Text>
              <Text style={styles.kvVal}>{fmt(s.otherMembersExpectedCollection)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>Less Foreman Commission{s.gstAmount > 0 ? ' + GST' : ''}:</Text>
              <Text style={styles.kvVal}>-{fmt(s.commission + s.gstAmount)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>Net Pool Funds for Payout:</Text>
              <Text style={styles.kvVal}>{fmt(s.netFundsAvailableForWinner)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>Actual Collected ({data.collections.paidCount} paid, {data.collections.unpaidCount} unpaid):</Text>
              <Text style={styles.kvVal}>{fmt(data.collections.totalCollected)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>Pending Collection Balance:</Text>
              <Text style={styles.kvVal}>{fmt(data.collections.totalOutstanding)}</Text>
            </View>
            {data.collections.byMode.map((mb) => (
              <View key={mb.mode} style={styles.kvRow}>
                <Text style={styles.kvLbl}>· {mb.label} ({mb.count} txns):</Text>
                <Text style={styles.kvVal}>{fmt(mb.amount)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Security Gate &amp; Attendance</Text>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>Attendance (Present / Proxy / Absent):</Text>
              <Text style={styles.kvVal}>{data.auction.presentCount} / {data.auction.proxyCount} / {data.auction.absentCount}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>Collateral Type:</Text>
              <Text style={styles.kvVal}>{data.security?.typeLabel ?? 'Pending Assignment'}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>Security Status:</Text>
              <Text style={styles.kvVal}>{(data.security?.status ?? 'pending').toUpperCase()}</Text>
            </View>
            {data.security?.value != null && (
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>Collateral Value:</Text>
                <Text style={styles.kvVal}>{fmt(data.security.value)}</Text>
              </View>
            )}
            {data.security?.guarantorLabel && (
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>Guarantor / Witness:</Text>
                <Text style={styles.kvVal}>{data.security.guarantorLabel}</Text>
              </View>
            )}
            {data.security?.details && (
              <Text style={{ fontSize: 7, color: '#374151', marginTop: 2 }}>Notes: {data.security.details}</Text>
            )}
            {data.security && data.security.documents.length > 0 && (
              <Text style={{ fontSize: 7, color: '#065F46', marginTop: 2 }}>
                Docs: {data.security.documents.map((d) => `${d.label} (${d.status})`).join(', ')}
              </Text>
            )}
            {data.payouts.dividendReceiptNo && (
              <Text style={{ fontSize: 7, color: '#5A195B', marginTop: 2 }}>
                Dividend Receipt: {data.payouts.dividendReceiptNo}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{data.tenantName} · Period {data.auction.periodNumber} Settlement Report · {data.group.name}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* PAGE 2: Multi-Division Winners (if any), Bid Log, Member Ledger & Minutes */}
      <Page size="A4" style={styles.page}>
        {data.multiDivisionWinners.length > 1 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.subHead}>
              Period {data.auction.periodNumber} Multi-Division Winners ({data.multiDivisionWinners.length})
            </Text>
            <View style={styles.miniHeader}>
              <Text style={[styles.miniTh, { width: '12%' }]}>Ticket</Text>
              <Text style={[styles.miniTh, { width: '36%' }]}>Winner Name</Text>
              <Text style={[styles.miniTh, { width: '16%' }]}>Win Type</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>Prize</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>Discount</Text>
            </View>
            {data.multiDivisionWinners.map((mw, idx) => (
              <View key={idx} style={[styles.miniTr, { backgroundColor: idx % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }]}>
                <Text style={[styles.miniTd, { width: '12%' }]}>#{mw.ticketNo ?? idx + 1}</Text>
                <Text style={[styles.miniTd, { width: '36%' }]}>{mw.memberName}</Text>
                <Text style={[styles.miniTd, { width: '16%', textTransform: 'uppercase' }]}>{mw.winType}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmt(mw.prizeAmount)}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right' }]}>{fmt(mw.bidDiscount)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.subHead}>
          Period {data.auction.periodNumber} Bidding Log ({data.bids.length} bid{data.bids.length === 1 ? '' : 's'})
        </Text>
        {data.bids.length === 0 ? (
          <Text style={{ fontSize: 8, color: '#6B7280', marginBottom: 8 }}>
            No auction bids recorded for this period ({data.group.auctionType} / {data.group.engineLabel}).
          </Text>
        ) : (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.miniHeader}>
              <Text style={[styles.miniTh, { width: '10%' }]}>Ticket</Text>
              <Text style={[styles.miniTh, { width: '30%' }]}>Member</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>Prize</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>Discount</Text>
              <Text style={[styles.miniTh, { width: '12%', textAlign: 'center' }]}>Source</Text>
              <Text style={[styles.miniTh, { width: '12%', textAlign: 'center' }]}>Status</Text>
            </View>
            {data.bids.slice(0, 15).map((b, i) => (
              <View key={i} style={[styles.miniTr, { backgroundColor: b.status === 'winning' ? '#DCFCE7' : i % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }]}>
                <Text style={[styles.miniTd, { width: '10%' }]}>#{b.ticketNo}</Text>
                <Text style={[styles.miniTd, { width: '30%' }]}>{b.memberName}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmt(b.prizeAmount)}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right' }]}>{fmt(b.bidDiscount)}</Text>
                <Text style={[styles.miniTd, { width: '12%', textAlign: 'center' }]}>{b.source}</Text>
                <Text style={[styles.miniTd, { width: '12%', textAlign: 'center' }]}>{b.status}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.subHead}>
          Per-Member Period {data.auction.periodNumber} Collection &amp; Dividend Ledger ({data.memberRows.length} members)
        </Text>
        <View style={styles.miniHeader}>
          <Text style={[styles.miniTh, { width: '7%' }]}>Tkt</Text>
          <Text style={[styles.miniTh, { width: '20%' }]}>Member</Text>
          <Text style={[styles.miniTh, { width: '10%' }]}>Role</Text>
          <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>Base</Text>
          <Text style={[styles.miniTh, { width: '11%', textAlign: 'right' }]}>
            {data.gold?.gramsPerFullTicket ? 'Grams (g)' : data.statement.deferredDividendTotal > 0 ? 'Div / Def' : 'Dividend'}
          </Text>
          <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>Net Due</Text>
          <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>Paid</Text>
          <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>Bal.</Text>
          <Text style={[styles.miniTh, { width: '12%', textAlign: 'right' }]}>Mode / Status</Text>
        </View>
        {data.memberRows.map((m, idx) => (
          <View key={idx} style={[styles.miniTr, { backgroundColor: idx % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }]} wrap={false}>
            <Text style={[styles.miniTd, { width: '7%' }]}>#{m.ticketNo}</Text>
            <Text style={[styles.miniTd, { width: '20%' }]}>{m.memberName}</Text>
            <Text style={[styles.miniTd, { width: '10%' }]}>{m.role}</Text>
            <Text style={[styles.miniTd, { width: '10%', textAlign: 'right' }]}>{fmt(m.baseDue)}</Text>
            <Text style={[styles.miniTd, { width: '11%', textAlign: 'right', color: '#047857' }]}>
              {data.gold?.gramsPerFullTicket
                ? `${m.goldGramsCredited.toFixed(4)} g`
                : m.deferredDividend > 0
                  ? `${fmt(m.dividendEarned)} / ${fmt(m.deferredDividend)}`
                  : fmt(m.dividendEarned)}
            </Text>
            <Text style={[styles.miniTd, { width: '10%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmt(m.netDue)}</Text>
            <Text style={[styles.miniTd, { width: '10%', textAlign: 'right' }]}>{fmt(m.paidAmount)}</Text>
            <Text style={[styles.miniTd, { width: '10%', textAlign: 'right', color: m.outstanding > 0 ? '#B91C1C' : '#047857' }]}>{fmt(m.outstanding)}</Text>
            <Text style={[styles.miniTd, { width: '12%', textAlign: 'right' }]}>
              {m.paymentMode !== '—' ? `${m.paymentMode} (${m.status})` : m.status}
            </Text>
          </View>
        ))}

        <Text style={styles.subHead}>Official Period Minutes &amp; Verification Notes</Text>
        <View style={styles.minutesBox}>
          <Text>{data.auction.minutesText}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>{data.tenantName} · Period {data.auction.periodNumber} Settlement Report · {data.group.name}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
