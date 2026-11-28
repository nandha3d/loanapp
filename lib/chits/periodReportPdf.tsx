import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ChitPeriodReportData } from './periodReport';
import { getPeriodReportCopy } from './periodReportI18n';
import { ensurePdfFonts, getPdfFontFamily, resolvePdfLang } from '../reports/pdfFonts';

function humanizeCommissionBasis(raw: string): string {
  const up = String(raw || '').toUpperCase();
  if (up === 'BID_DISCOUNT') return 'Bid Discount';
  if (up === 'CHIT_VALUE') return 'Chit Value';
  return raw;
}

function humanizeChitType(raw: string): string {
  const low = String(raw || '').toLowerCase();
  if (low === 'unregistered') return 'Unregistered';
  if (low === 'registered') return 'Registered';
  return raw;
}

function humanizeFrequency(raw: string): string {
  const low = String(raw || '').toLowerCase();
  return low ? low.charAt(0).toUpperCase() + low.slice(1) : '';
}

function humanizeMemberRole(raw: string): string {
  const low = String(raw || '').toLowerCase();
  if (low === 'winner') return 'Winner';
  if (low === 'previously_prized') return 'Prized';
  if (low === 'non_prized' || low === 'member') return 'Subscriber';
  return raw;
}

function humanizeStatus(raw: string): string {
  const low = String(raw || '').toLowerCase();
  if (low === 'paid') return 'Paid';
  if (low === 'partial') return 'Partial';
  if (low === 'upcoming') return 'Upcoming';
  if (low === 'missed') return 'Missed';
  if (low === 'pending') return 'Pending';
  if (low === 'verified') return 'Verified';
  if (low === 'approved') return 'Approved';
  if (low === 'ready') return 'Ready';
  if (low === 'winning') return 'Winning';
  if (low === 'valid') return 'Valid';
  if (low === 'retracted') return 'Retracted';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
}

function humanizeBidSource(raw: string): string {
  const low = String(raw || '').toLowerCase();
  if (low === 'tap') return 'Table Tap';
  if (low === 'chat') return 'Chat';
  if (low === 'auto') return 'Auto';
  if (low === 'manual') return 'Manual';
  return raw;
}

function humanizeMemberModeStatus(paymentMode: string, status: string): string {
  const cleanStatus = humanizeStatus(status);
  if (!paymentMode || paymentMode === '—' || paymentMode.toLowerCase() === 'recorded') {
    return cleanStatus;
  }
  return `${paymentMode} · ${cleanStatus}`;
}

function createPeriodStyles(fontFamily: any, hasUnicode: boolean, compact: boolean, ultraCompact: boolean) {
  const bold = hasUnicode ? { fontFamily, fontWeight: 'bold' as const } : { fontFamily: 'Helvetica-Bold' as const };
  const rowPad = ultraCompact ? 1.8 : compact ? 2.4 : 3.4;
  const miniPad = ultraCompact ? 1.8 : compact ? 2.2 : 3.0;
  const baseFont = ultraCompact ? 7.0 : compact ? 7.4 : 8.0;
  const miniFont = ultraCompact ? 6.4 : compact ? 6.8 : 7.1;

  return {
    bold,
    styles: StyleSheet.create({
      page: {
        fontFamily,
        fontSize: baseFont,
        paddingTop: compact ? 16 : 22,
        paddingHorizontal: compact ? 20 : 24,
        paddingBottom: compact ? 28 : 34,
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        lineHeight: 1.25,
      },
      topMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: compact ? 5 : 7,
      },
      brandTitle: {
        fontSize: compact ? 12 : 13,
        ...bold,
        color: '#7D287E',
      },
      brandSub: {
        fontSize: 7.2,
        color: '#475569',
        marginTop: 1,
      },
      rightMeta: {
        textAlign: 'right',
        fontSize: 7.0,
        color: '#475569',
        lineHeight: 1.3,
      },
      titleBox: {
        borderWidth: 1,
        borderColor: '#C084FC',
        borderStyle: 'solid',
        borderRadius: 4,
        paddingVertical: compact ? 4.5 : 6,
        paddingHorizontal: 10,
        marginBottom: compact ? 6 : 8,
        backgroundColor: '#FAF5FF',
        alignItems: 'center',
      },
      titleBoxText: {
        fontSize: compact ? 9.8 : 10.6,
        ...bold,
        color: '#0F172A',
        textAlign: 'center',
      },
      titleBoxSub: {
        fontSize: 7.0,
        color: '#5A195B',
        marginTop: 1.5,
        textAlign: 'center',
      },
      tableOuter: {
        borderWidth: 0.9,
        borderColor: '#334155',
        borderStyle: 'solid',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: compact ? 6 : 8,
      },
      tableHeadRow: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        paddingVertical: compact ? 3.5 : 4.5,
        paddingHorizontal: 6,
        alignItems: 'center',
      },
      thText: {
        ...bold,
        fontSize: compact ? 7.6 : 8.2,
        color: '#FFFFFF',
      },
      tr: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        paddingVertical: rowPad,
        paddingHorizontal: 6,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
      },
      trAlt: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 0.5,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        paddingVertical: rowPad,
        paddingHorizontal: 6,
        alignItems: 'center',
      },
      trGreen: {
        flexDirection: 'row',
        backgroundColor: '#ECFDF5',
        borderTopWidth: 0.9,
        borderTopColor: '#059669',
        borderTopStyle: 'solid',
        borderBottomWidth: 0.9,
        borderBottomColor: '#059669',
        borderBottomStyle: 'solid',
        paddingVertical: compact ? 4 : 5,
        paddingHorizontal: 6,
        alignItems: 'center',
      },
      tdSubNote: {
        fontSize: compact ? 6.2 : 6.7,
        color: '#64748B',
        marginTop: 0.8,
      },
      sectionBanner: {
        flexDirection: 'row',
        backgroundColor: '#EFF6FF',
        borderBottomWidth: 0.6,
        borderBottomColor: '#BFDBFE',
        borderBottomStyle: 'solid',
        paddingVertical: compact ? 2.8 : 3.5,
        paddingHorizontal: 6,
      },
      sectionBannerText: {
        ...bold,
        fontSize: compact ? 7.2 : 7.6,
        color: '#1E3A8A',
      },
      netLabel: {
        ...bold,
        fontSize: compact ? 8.2 : 8.8,
        color: '#065F46',
      },
      netAmount: {
        ...bold,
        fontSize: compact ? 9.2 : 10,
        color: '#065F46',
        textAlign: 'right',
      },
      yellowCell: {
        backgroundColor: '#FEF9C3',
      },
      settledCell: {
        backgroundColor: '#DCFCE7',
      },
      summaryStrip: {
        flexDirection: 'row',
        gap: 7,
        marginBottom: compact ? 6 : 8,
      },
      summaryCard: {
        flex: 1,
        borderWidth: 0.75,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      },
      summaryCardHeader: {
        backgroundColor: '#F1F5F9',
        borderBottomWidth: 0.6,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        paddingVertical: 3,
        paddingHorizontal: 6,
      },
      summaryCardTitle: {
        ...bold,
        fontSize: 7.3,
        color: '#0F172A',
      },
      summaryCardBody: {
        paddingVertical: compact ? 4 : 5,
        paddingHorizontal: 6,
      },
      kvRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 1.6,
      },
      kvLbl: {
        fontSize: 6.8,
        color: '#475569',
      },
      kvVal: {
        fontSize: 6.9,
        ...bold,
        color: '#0F172A',
      },
      sectionBox: {
        borderWidth: 0.8,
        borderColor: '#334155',
        borderStyle: 'solid',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: compact ? 6 : 8,
      },
      sectionTitleBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderBottomWidth: 0.6,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        paddingVertical: compact ? 2.6 : 3.2,
        paddingHorizontal: 6,
      },
      sectionTitleText: {
        fontSize: compact ? 7.4 : 8.0,
        ...bold,
        color: '#0F172A',
      },
      sectionTitleMeta: {
        fontSize: 6.6,
        color: '#475569',
      },
      miniHeader: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        paddingVertical: compact ? 2.8 : 3.4,
        paddingHorizontal: 5,
        alignItems: 'center',
      },
      miniTh: {
        fontSize: compact ? 6.4 : 6.8,
        ...bold,
        color: '#FFFFFF',
      },
      miniTr: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E2E8F0',
        borderBottomStyle: 'solid',
        paddingVertical: miniPad,
        paddingHorizontal: 5,
        alignItems: 'center',
      },
      miniTd: {
        fontSize: miniFont,
        color: '#1E293B',
      },
      minutesText: {
        fontSize: compact ? 6.6 : 7.0,
        color: '#334155',
        lineHeight: 1.32,
      },
      footer: {
        position: 'absolute',
        bottom: 12,
        left: compact ? 20 : 24,
        right: compact ? 20 : 24,
        borderTopWidth: 0.5,
        borderTopColor: '#CBD5E1',
        borderTopStyle: 'solid',
        paddingTop: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 6.6,
        color: '#64748B',
      },
    }),
  };
}

const C = { sl: '9%', desc: '67%', amt: '24%' };

export function ChitPeriodReportPDF({ data, lang }: { data: ChitPeriodReportData; lang?: string }) {
  const hasUnicode = ensurePdfFonts();
  const resolvedLang = resolvePdfLang(lang ?? data.lang);
  const t = getPeriodReportCopy(resolvedLang);

  const compact = data.memberRows.length >= 8 || data.bids.length > 3 || data.multiDivisionWinners.length > 1;
  const ultraCompact = data.memberRows.length >= 16;
  const { styles, bold } = createPeriodStyles(getPdfFontFamily(resolvedLang), hasUnicode, compact, ultraCompact);

  const sym = !data.currencySymbol || data.currencySymbol === '₹' ? (hasUnicode ? '₹' : 'Rs.') : data.currencySymbol;
  const fmt = (n: number | null | undefined, decimals = 0) =>
    `${sym} ${Number(n ?? 0).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const s = data.statement;
  const winnerTitle = data.auction.winnerName
    ? `${data.auction.winnerName}${data.auction.winnerTicketNo ? ` (#${data.auction.winnerTicketNo})` : ''}`
    : t.winnerPending;

  const activeDenoms = data.denominations.filter((d) => d.count > 0);
  const denomInlineText = activeDenoms.length > 0
    ? activeDenoms.map((d) => `${sym}${d.denomination} × ${d.count} (${fmt(d.amount)})`).join('  ·  ')
    : t.digitalNil;

  const visibleBids = data.bids.slice(0, compact ? 5 : 8);
  const hiddenBidCount = Math.max(0, data.bids.length - visibleBids.length);
  const pendingBalance = Number(data.payouts.remainingPayoutBalance ?? 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Brand & Report Metadata Header */}
        <View style={styles.topMeta}>
          <View>
            <Text style={styles.brandTitle}>{data.tenantName}</Text>
            <Text style={styles.brandSub}>
              {data.branchName} · {data.group.engineLabel} · {humanizeChitType(data.group.chitType)}
            </Text>
          </View>
          <View>
            <Text style={styles.rightMeta}>
              {t.groupWord}: {data.group.groupCode || data.group.id.slice(-8)} · {humanizeFrequency(data.group.frequency)}
            </Text>
            <Text style={styles.rightMeta}>
              {t.statusWord}: {humanizeStatus(data.auction.status)} · {t.payoutWord}: {humanizeStatus(data.auction.payoutStatus)} · {t.generatedWord}: {fmtDate(data.generatedAt)}
            </Text>
          </View>
        </View>

        {/* Framed Executive Period Banner */}
        <View style={styles.titleBox}>
          <Text style={styles.titleBoxText}>
            {data.group.name} ({fmt(s.chitValue)}) — {t.periodWord} {data.auction.periodNumber} {t.ofWord}{' '}
            {data.group.totalMembers} — {fmtDate(data.auction.auctionDate)}
          </Text>
          <Text style={styles.titleBoxSub}>
            {data.templateSectionTitle} · {data.group.totalMembers} {t.membersWord} · {t.baseDueWord}{' '}
            {fmt(s.baseInstallment)} · {t.commWord} {data.group.commissionPct}% ({humanizeCommissionBasis(data.group.commissionBasis)})
          </Text>
        </View>

        {/* Core Settlement, Payout & Cash Reconciliation Table */}
        <View style={styles.tableOuter} wrap={false}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.thText, { width: C.sl, textAlign: 'center' }]}>{t.slNo}</Text>
            <Text style={[styles.thText, { width: C.desc }]}>
              {t.description} — {winnerTitle}
            </Text>
            <Text style={[styles.thText, { width: C.amt, textAlign: 'right' }]}>
              {t.amountCol} ({sym})
            </Text>
          </View>

          <View style={styles.trAlt}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>1</Text>
            <Text style={{ width: C.desc }}>
              {t.totalChitValue} ({t.grossPool} = {data.group.totalMembers} × {fmt(s.baseInstallment)})
            </Text>
            <Text style={{ width: C.amt, textAlign: 'right', ...bold }}>{fmt(s.chitValue)}</Text>
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
                {t.foremanFeePerTicket}: {fmt(s.foremanFeePerTicket)}
                {s.gstAmount > 0 ? ` · ${t.gstLabel}: ${fmt(s.gstAmount)}` : ''}
                {s.roundingIncome > 0 ? ` · ${t.roundingLabel}: ${fmt(s.roundingIncome)}` : ''}
              </Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', ...bold }}>{fmt(s.commission)}</Text>
          </View>

          <View style={styles.tr}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>4</Text>
            <View style={{ width: C.desc }}>
              <Text>{s.row4Title}</Text>
              <Text style={styles.tdSubNote}>{s.row4Note}</Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', ...bold }}>
              {s.dividendPerTicket > 0
                ? fmt(s.dividendPerTicket)
                : s.deferredDividendTotal > 0
                  ? fmt(s.deferredDividendTotal)
                  : fmt(0)}
            </Text>
          </View>

          <View style={styles.trAlt}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>5</Text>
            <View style={{ width: C.desc }}>
              <Text style={{ ...bold }}>{s.row5Title}</Text>
              <Text style={styles.tdSubNote}>
                {Math.abs(s.prizedMemberInstallment - s.netMemberInstallment) > 0.01
                  ? `${t.nonPrizedLabel}: ${fmt(s.netMemberInstallment)} · ${t.prizedLabel}: ${fmt(s.prizedMemberInstallment)} · `
                  : `${t.baseDueWord} ${fmt(s.baseInstallment)} - ${t.dividendCol} ${fmt(s.dividendPerTicket)} · `}
                {s.verificationFormulaLine}
              </Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', ...bold }}>
              {Math.abs(s.prizedMemberInstallment - s.netMemberInstallment) > 0.01
                ? `${fmt(s.netMemberInstallment)} / ${fmt(s.prizedMemberInstallment)}`
                : fmt(s.netMemberInstallment)}
            </Text>
          </View>

          <View style={styles.tr}>
            <Text style={{ width: C.sl, textAlign: 'center' }}>6</Text>
            <View style={{ width: C.desc }}>
              <Text style={{ ...bold }}>
                {t.winnerCurrentInst} (
                {s.winnerPeriodInstallmentUnpaid === 0 && s.winnerPeriodInstallmentPaid > 0
                  ? t.alreadyPaid
                  : t.deductedFromPrize}
                )
              </Text>
              <Text style={styles.tdSubNote}>
                {t.duePaidUnpaid(
                  fmt(s.winnerPeriodInstallmentDue),
                  fmt(s.winnerPeriodInstallmentPaid),
                  fmt(s.winnerPeriodInstallmentUnpaid),
                )}
              </Text>
            </View>
            <Text style={{ width: C.amt, textAlign: 'right', ...bold }}>
              {fmt(s.winnerPeriodInstallmentUnpaid)}
            </Text>
          </View>

          {/* Highlighted Net Payable Row (Column-aligned under Amount) */}
          <View style={styles.trGreen}>
            <Text style={{ width: C.sl, textAlign: 'center', ...bold, color: '#065F46' }}>NET</Text>
            <View style={{ width: C.desc }}>
              <Text style={styles.netLabel}>{t.netPayableWinnerHand}</Text>
              <Text style={[styles.tdSubNote, { color: '#047857' }]}>
                {t.prizePayoutMinusWinnerInst} ({fmt(s.prizePayoutTotal)} - {fmt(s.winnerPeriodInstallmentUnpaid)})
              </Text>
            </View>
            <Text style={[styles.netAmount, { width: C.amt }]}>{fmt(s.netPayableAfterWinnerInstallment)}</Text>
          </View>

          {/* Payout & Mode Settlement Breakdown */}
          <View style={styles.sectionBanner}>
            <Text style={styles.sectionBannerText}>{t.payoutModeBanner}</Text>
          </View>

          {data.payouts.rows.map((row, idx) => (
            <View key={row.slNo} style={idx % 2 === 1 ? styles.trAlt : styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center' }}>{row.slNo}</Text>
              <View style={{ width: C.desc }}>
                <Text>{row.description}</Text>
                <Text style={styles.tdSubNote}>{row.modeOrRef}</Text>
              </View>
              <Text style={{ width: C.amt, textAlign: 'right', ...bold }}>{fmt(row.amount)}</Text>
            </View>
          ))}
          {data.payouts.rows.length === 0 && (
            <View style={styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center' }}>1</Text>
              <Text style={{ width: C.desc, color: '#64748B' }}>
                {t.noPayoutPosted} ({t.payoutWord}: {humanizeStatus(data.auction.payoutStatus)})
              </Text>
              <Text style={{ width: C.amt, textAlign: 'right' }}>{fmt(0)}</Text>
            </View>
          )}

          {(data.payouts.arrearsDeductedAmount > 0 || data.payouts.penaltyDeductedAmount > 0) && (
            <View style={[styles.tr, { backgroundColor: '#FFFBEB' }]}>
              <Text style={{ width: C.sl, textAlign: 'center', ...bold, color: '#B45309' }}>FIFO</Text>
              <View style={{ width: C.desc }}>
                <Text style={{ ...bold }}>{t.arrearsOffsetTitle}</Text>
                <Text style={styles.tdSubNote}>
                  {t.arrearsOffsetNote(
                    fmt(data.payouts.arrearsDeductedAmount),
                    fmt(data.payouts.penaltyDeductedAmount),
                  )}
                </Text>
              </View>
              <Text style={{ width: C.amt, textAlign: 'right', ...bold, color: '#B45309' }}>
                - {fmt(data.payouts.arrearsDeductedAmount + data.payouts.penaltyDeductedAmount)}
              </Text>
            </View>
          )}

          {/* Target vs Disbursed vs Balance */}
          <View style={[styles.tr, { paddingVertical: 0, paddingHorizontal: 0, backgroundColor: '#F8FAFC' }]}>
            <Text style={{ width: C.sl, padding: 4, textAlign: 'center', ...bold }}>BAL</Text>
            <View
              style={{
                width: '33.5%',
                paddingVertical: 3.5,
                paddingHorizontal: 6,
                borderLeftWidth: 0.6,
                borderLeftColor: '#CBD5E1',
                borderLeftStyle: 'solid',
              }}
            >
              <Text style={{ fontSize: 6.4, color: '#64748B' }}>
                {data.payouts.arrearsDeductedAmount > 0 || data.payouts.penaltyDeductedAmount > 0
                  ? t.netTargetAfterArrears
                  : t.targetGrossPayout}
              </Text>
              <Text style={{ ...bold }}>{fmt(data.payouts.netPayableAmount ?? s.prizePayoutTotal)}</Text>
            </View>
            <View
              style={{
                width: '33.5%',
                paddingVertical: 3.5,
                paddingHorizontal: 6,
                borderLeftWidth: 0.6,
                borderLeftColor: '#CBD5E1',
                borderLeftStyle: 'solid',
              }}
            >
              <Text style={{ fontSize: 6.4, color: '#64748B' }}>{t.paidDisbursed}</Text>
              <Text style={{ ...bold }}>{fmt(data.payouts.totalDisbursedToWinner)}</Text>
            </View>
            <View
              style={[
                pendingBalance > 0 ? styles.yellowCell : styles.settledCell,
                {
                  width: C.amt,
                  paddingVertical: 3.5,
                  paddingHorizontal: 6,
                  borderLeftWidth: 0.75,
                  borderLeftColor: '#334155',
                  borderLeftStyle: 'solid',
                },
              ]}
            >
              <Text style={{ fontSize: 6.4, color: '#0F172A', textAlign: 'right' }}>{t.balancePending}</Text>
              <Text style={{ ...bold, textAlign: 'right', color: pendingBalance > 0 ? '#92400E' : '#065F46' }}>
                {fmt(pendingBalance)}
              </Text>
            </View>
          </View>

          {/* Compact Cash Note Denomination Summary Row */}
          <View style={[styles.tr, { borderBottomWidth: 0, paddingVertical: 0, paddingHorizontal: 0 }]}>
            <Text style={{ width: C.sl, padding: 4, textAlign: 'center', ...bold, color: '#475569' }}>CASH</Text>
            <View
              style={{
                width: C.desc,
                paddingVertical: 3.5,
                paddingHorizontal: 6,
                borderLeftWidth: 0.6,
                borderLeftColor: '#CBD5E1',
                borderLeftStyle: 'solid',
              }}
            >
              <Text style={{ fontSize: 6.6, color: '#475569' }}>
                {t.totalCashDenomPayout}: <Text style={{ ...bold, color: '#0F172A' }}>{denomInlineText}</Text>
              </Text>
            </View>
            <View
              style={[
                styles.yellowCell,
                {
                  width: C.amt,
                  paddingVertical: 3.5,
                  paddingHorizontal: 6,
                  borderLeftWidth: 0.75,
                  borderLeftColor: '#334155',
                  borderLeftStyle: 'solid',
                },
              ]}
            >
              <Text style={{ ...bold, textAlign: 'right', fontSize: compact ? 8.0 : 8.8 }}>
                {fmt(data.denominationCashTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* Template Mechanics Row (only for non-standard templates) */}
        {(data.basePlusPremium || data.gold || data.commodity || data.asca || data.formulaLines.length > 0) && (
          <View style={[styles.summaryCard, { flex: 0, marginBottom: compact ? 5 : 7 }]} wrap={false}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryCardTitle}>
                {data.group.engineLabel} — {t.templateMechanicsTitle}
              </Text>
            </View>
            <View style={styles.summaryCardBody}>
              {data.basePlusPremium && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLbl}>
                    {t.nonPrizedLabel} {fmt(data.basePlusPremium.nonPrizedInstalment)} / {t.prizedLabel}{' '}
                    {fmt(data.basePlusPremium.prizedInstalment)} · {data.basePlusPremium.alreadyPrizedTicketUnits}
                  </Text>
                  <Text style={styles.kvVal}>
                    {fmt(data.basePlusPremium.collectedPool)} · {fmt(data.basePlusPremium.poolSurplus)}
                  </Text>
                </View>
              )}
              {data.gold && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLbl}>
                    {fmt(data.gold.goldRatePerGram)}/g
                    {data.gold.gramsPerFullTicket > 0 ? ` · ${data.gold.gramsPerFullTicket} g` : ''}
                  </Text>
                  <Text style={styles.kvVal}>
                    {data.gold.bonusMonths > 0 ? `${data.gold.bonusMonths} mo` : `${data.gold.bonusPct}%`}
                  </Text>
                </View>
              )}
              {data.commodity && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLbl}>{data.commodity.itemsSummary}</Text>
                  <Text style={styles.kvVal}>
                    {data.commodity.merchantBonusPct}%
                    {data.commodity.merchantBonusAmount > 0 ? ` + ${fmt(data.commodity.merchantBonusAmount)}` : ''}
                  </Text>
                </View>
              )}
              {data.asca && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLbl}>{data.asca.monthlyLoanInterestPct}% / mo</Text>
                  <Text style={styles.kvVal}>{fmt(data.asca.adminExpensePerCycle)}</Text>
                </View>
              )}
              {data.formulaLines.length > 0 && (
                <Text style={{ fontSize: 6.5, color: '#475569' }}>{data.formulaLines.join('  |  ')}</Text>
              )}
            </View>
          </View>
        )}

        {/* Two-Column Pool Money Flow & Security Summary */}
        <View style={styles.summaryStrip} wrap={false}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryCardTitle}>{t.poolMoneyFlowTitle}</Text>
            </View>
            <View style={styles.summaryCardBody}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>{t.otherMembersExpected(s.otherMembersCount)}:</Text>
                <Text style={styles.kvVal}>{fmt(s.otherMembersExpectedCollection)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>
                  {t.lessForemanComm}
                  {s.gstAmount > 0 ? ` + ${t.gstLabel}` : ''}:
                </Text>
                <Text style={styles.kvVal}>-{fmt(s.commission + s.gstAmount)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>{t.netPoolForPayout}:</Text>
                <Text style={styles.kvVal}>{fmt(s.netFundsAvailableForWinner)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>
                  {t.actualCollected(data.collections.paidCount, data.collections.unpaidCount)}:
                </Text>
                <Text style={styles.kvVal}>{fmt(data.collections.totalCollected)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>{t.pendingCollectionBal}:</Text>
                <Text style={styles.kvVal}>{fmt(data.collections.totalOutstanding)}</Text>
              </View>
              {data.collections.byMode.map((mb) => (
                <View key={mb.mode} style={styles.kvRow}>
                  <Text style={styles.kvLbl}>
                    · {mb.label} ({mb.count} {t.txnsWord}):
                  </Text>
                  <Text style={styles.kvVal}>{fmt(mb.amount)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryCardTitle}>{t.securityGateTitle}</Text>
            </View>
            <View style={styles.summaryCardBody}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>{t.attendanceLabel}:</Text>
                <Text style={styles.kvVal}>
                  {data.auction.presentCount} Present · {data.auction.proxyCount} Proxy · {data.auction.absentCount} Absent
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>{t.collateralTypeLabel}:</Text>
                <Text style={styles.kvVal}>{data.security?.typeLabel ?? t.pendingAssignment}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLbl}>{t.securityStatusLabel}:</Text>
                <Text style={styles.kvVal}>{humanizeStatus(data.security?.status ?? 'pending')}</Text>
              </View>
              {data.security?.value != null && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLbl}>{t.collateralValueLabel}:</Text>
                  <Text style={styles.kvVal}>{fmt(data.security.value)}</Text>
                </View>
              )}
              {data.security?.guarantorLabel && (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLbl}>{t.guarantorWitnessLabel}:</Text>
                  <Text style={styles.kvVal}>{data.security.guarantorLabel}</Text>
                </View>
              )}
              {data.security?.details && (
                <Text style={{ fontSize: 6.5, color: '#475569', marginTop: 1 }}>
                  {t.notesLabel}: {data.security.details}
                </Text>
              )}
              {data.security && data.security.documents.length > 0 && (
                <Text style={{ fontSize: 6.5, color: '#065F46', marginTop: 1 }}>
                  {t.docsLabel}:{' '}
                  {data.security.documents.map((d) => `${d.label} (${humanizeStatus(d.status)})`).join(', ')}
                </Text>
              )}
              {data.payouts.dividendReceiptNo && (
                <Text style={{ fontSize: 6.5, color: '#5A195B', marginTop: 1 }}>
                  {t.dividendReceiptLabel}: {data.payouts.dividendReceiptNo}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Multi-Division Winners Table (if any) */}
        {data.multiDivisionWinners.length > 1 && (
          <View style={styles.sectionBox} wrap={false}>
            <View style={styles.sectionTitleBar}>
              <Text style={styles.sectionTitleText}>
                {t.periodWord} {data.auction.periodNumber} {t.multiDivTitle} ({data.multiDivisionWinners.length})
              </Text>
            </View>
            <View style={styles.miniHeader}>
              <Text style={[styles.miniTh, { width: '12%' }]}>{t.ticketCol}</Text>
              <Text style={[styles.miniTh, { width: '36%' }]}>{t.winnerNameCol}</Text>
              <Text style={[styles.miniTh, { width: '16%' }]}>{t.winTypeCol}</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>{t.prizeCol}</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>{t.discountCol}</Text>
            </View>
            {data.multiDivisionWinners.map((mw, idx) => (
              <View key={idx} style={[styles.miniTr, { backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }]}>
                <Text style={[styles.miniTd, { width: '12%' }]}>#{mw.ticketNo ?? idx + 1}</Text>
                <Text style={[styles.miniTd, { width: '36%' }]}>{mw.memberName}</Text>
                <Text style={[styles.miniTd, { width: '16%' }]}>{humanizeStatus(mw.winType)}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right', ...bold }]}>{fmt(mw.prizeAmount)}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right' }]}>{fmt(mw.bidDiscount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Per-Member Collection & Dividend Ledger Table */}
        <View style={styles.sectionBox}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>
              {t.memberLedgerTitle} — {t.periodWord} {data.auction.periodNumber}
            </Text>
            <Text style={styles.sectionTitleMeta}>
              {data.memberRows.length} {t.membersWord}
            </Text>
          </View>
          <View style={styles.miniHeader}>
            <Text style={[styles.miniTh, { width: '6%' }]}>{t.ticketCol}</Text>
            <Text style={[styles.miniTh, { width: '22%' }]}>{t.memberCol}</Text>
            <Text style={[styles.miniTh, { width: '10%' }]}>{t.roleCol}</Text>
            <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>{t.baseCol}</Text>
            <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>
              {data.gold?.gramsPerFullTicket
                ? t.gramsCol
                : data.statement.deferredDividendTotal > 0
                  ? t.divDefCol
                  : t.dividendCol}
            </Text>
            <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>{t.netDueCol}</Text>
            <Text style={[styles.miniTh, { width: '9%', textAlign: 'right' }]}>{t.paidCol}</Text>
            <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>{t.balCol}</Text>
            <Text style={[styles.miniTh, { width: '13%', textAlign: 'right' }]}>{t.modeStatusCol}</Text>
          </View>
          {data.memberRows.map((m, idx) => {
            const isWinner = String(m.role).toLowerCase() === 'winner';
            const rowBg = isWinner ? '#ECFDF5' : idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
            return (
              <View
                key={idx}
                style={[
                  styles.miniTr,
                  {
                    backgroundColor: rowBg,
                    borderBottomWidth: idx === data.memberRows.length - 1 ? 0 : 0.5,
                  },
                ]}
                wrap={false}
              >
                <Text style={[styles.miniTd, { width: '6%', ...bold }]}>#{m.ticketNo}</Text>
                <Text style={[styles.miniTd, { width: '22%' }]}>{m.memberName}</Text>
                <Text
                  style={[
                    styles.miniTd,
                    {
                      width: '10%',
                      color: isWinner ? '#065F46' : '#475569',
                      ...(isWinner ? bold : {}),
                    },
                  ]}
                >
                  {humanizeMemberRole(m.role)}
                </Text>
                <Text style={[styles.miniTd, { width: '10%', textAlign: 'right' }]}>{fmt(m.baseDue)}</Text>
                <Text style={[styles.miniTd, { width: '10%', textAlign: 'right', color: '#047857' }]}>
                  {data.gold?.gramsPerFullTicket
                    ? `${m.goldGramsCredited.toFixed(4)} g`
                    : m.deferredDividend > 0
                      ? `${fmt(m.dividendEarned)} / ${fmt(m.deferredDividend)}`
                      : fmt(m.dividendEarned)}
                </Text>
                <Text style={[styles.miniTd, { width: '10%', textAlign: 'right', ...bold }]}>{fmt(m.netDue)}</Text>
                <Text style={[styles.miniTd, { width: '9%', textAlign: 'right' }]}>{fmt(m.paidAmount)}</Text>
                <Text
                  style={[
                    styles.miniTd,
                    {
                      width: '10%',
                      textAlign: 'right',
                      color: m.outstanding > 0 ? '#B91C1C' : '#047857',
                      ...bold,
                    },
                  ]}
                >
                  {fmt(m.outstanding)}
                </Text>
                <Text style={[styles.miniTd, { width: '13%', textAlign: 'right', color: '#334155' }]}>
                  {humanizeMemberModeStatus(m.paymentMode, m.status)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Bottom 2-Column Strip: Bidding Log (Left) & Official Period Minutes (Right) */}
        <View style={{ flexDirection: 'row', gap: 7 }} wrap={false}>
          <View style={[styles.summaryCard, { flex: 1.05 }]}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryCardTitle}>
                {t.periodWord} {data.auction.periodNumber} {t.biddingLogTitle} ({data.bids.length})
              </Text>
            </View>
            {visibleBids.length === 0 ? (
              <View style={styles.summaryCardBody}>
                <Text style={{ fontSize: 6.8, color: '#64748B' }}>
                  {t.noBidsRecorded} ({data.group.auctionType} / {data.group.engineLabel})
                </Text>
              </View>
            ) : (
              <View>
                <View style={styles.miniHeader}>
                  <Text style={[styles.miniTh, { width: '11%' }]}>{t.ticketCol}</Text>
                  <Text style={[styles.miniTh, { width: '31%' }]}>{t.memberCol}</Text>
                  <Text style={[styles.miniTh, { width: '21%', textAlign: 'right' }]}>{t.prizeCol}</Text>
                  <Text style={[styles.miniTh, { width: '19%', textAlign: 'right' }]}>{t.discountCol}</Text>
                  <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>{t.sourceCol}</Text>
                </View>
                {visibleBids.map((b, i) => (
                  <View
                    key={i}
                    style={[
                      styles.miniTr,
                      {
                        backgroundColor: b.status === 'winning' ? '#ECFDF5' : i % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                        borderBottomWidth: i === visibleBids.length - 1 && hiddenBidCount === 0 ? 0 : 0.5,
                      },
                    ]}
                  >
                    <Text style={[styles.miniTd, { width: '11%' }]}>#{b.ticketNo}</Text>
                    <Text style={[styles.miniTd, { width: '31%' }]}>{b.memberName}</Text>
                    <Text style={[styles.miniTd, { width: '21%', textAlign: 'right', ...bold }]}>
                      {fmt(b.prizeAmount)}
                    </Text>
                    <Text style={[styles.miniTd, { width: '19%', textAlign: 'right' }]}>{fmt(b.bidDiscount)}</Text>
                    <Text style={[styles.miniTd, { width: '18%', textAlign: 'right', color: '#475569' }]}>
                      {humanizeBidSource(b.source)}
                    </Text>
                  </View>
                ))}
                {hiddenBidCount > 0 && (
                  <Text style={{ fontSize: 6.3, color: '#64748B', paddingHorizontal: 5, paddingVertical: 2.5 }}>
                    +{hiddenBidCount} additional bid(s) recorded
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={[styles.summaryCard, { flex: 1 }]}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryCardTitle}>{t.officialMinutesTitle}</Text>
            </View>
            <View style={styles.summaryCardBody}>
              <Text style={styles.minutesText}>{data.auction.minutesText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {data.tenantName} · {t.periodWord} {data.auction.periodNumber} {t.settlementReportWord} · {data.group.name}
          </Text>
          <Text render={({ pageNumber, totalPages }) => t.pageOf(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
