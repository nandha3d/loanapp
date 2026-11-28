import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ChitPeriodReportData } from './periodReport';
import { getPeriodReportCopy } from './periodReportI18n';
import { ensurePdfFonts, getPdfFontFamily, resolvePdfLang } from '../reports/pdfFonts';

function createPeriodStyles(fontFamily: any, hasUnicode: boolean) {
  const bold = hasUnicode ? { fontFamily, fontWeight: 'bold' as const } : { fontFamily: 'Helvetica-Bold' as const };
  return {
    bold,
    styles: StyleSheet.create({
      page: {
        fontFamily,
        fontSize: 8.5,
        padding: 30,
        paddingBottom: 46,
        backgroundColor: '#FFFFFF',
        color: '#111827',
        lineHeight: 1.3,
      },
      topMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
      },
      brandTitle: {
        fontSize: 13,
        ...bold,
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
        fontSize: 11,
        ...bold,
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
        ...bold,
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
        ...bold,
        fontSize: 8,
        color: '#1E293B',
      },
      redLabel: {
        ...bold,
        fontSize: 9.2,
        color: '#DC2626',
      },
      greenAmount: {
        ...bold,
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
        ...bold,
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
        ...bold,
        color: '#111827',
      },
      subHead: {
        fontSize: 9,
        ...bold,
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
        ...bold,
        color: '#FFFFFF',
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
    }),
  };
}

const C = { sl: '11%', desc: '63%', amt: '26%' };

export function ChitPeriodReportPDF({ data, lang }: { data: ChitPeriodReportData; lang?: string }) {
  const hasUnicode = ensurePdfFonts();
  const resolvedLang = resolvePdfLang(lang ?? data.lang);
  const t = getPeriodReportCopy(resolvedLang);
  const { styles, bold } = createPeriodStyles(getPdfFontFamily(resolvedLang), hasUnicode);

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
              {t.groupWord}: {data.group.groupCode || data.group.id.slice(-8)} · {data.group.frequency}
            </Text>
            <Text style={styles.rightMeta}>
              {t.statusWord}: {data.auction.status.toUpperCase()} · {t.payoutWord}: {data.auction.payoutStatus.toUpperCase()}
            </Text>
            <Text style={styles.rightMeta}>
              {t.generatedWord}: {fmtDate(data.generatedAt)}
            </Text>
          </View>
        </View>

        {/* Top Framed Title Box */}
        <View style={styles.titleBox}>
          <Text style={styles.titleBoxText}>
            {data.group.name} ({fmt(s.chitValue)}) — {t.periodWord} {data.auction.periodNumber} {t.ofWord}{' '}
            {data.group.totalMembers} — {fmtDate(data.auction.auctionDate)}
          </Text>
          <Text style={styles.titleBoxSub}>
            {data.templateSectionTitle} · {data.group.totalMembers} {t.membersWord} · {t.baseDueWord}{' '}
            {fmt(s.baseInstallment)} · {t.commWord} {data.group.commissionPct}% ({data.group.commissionBasis})
          </Text>
        </View>

        {/* Framed Core Period Statement & Settlement Table */}
        <View style={styles.tableOuter}>
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
            <View style={{ width: C.desc }}>
              <Text>
                {t.totalChitValue} ({t.grossPool} = {data.group.totalMembers} × {fmt(s.baseInstallment)})
              </Text>
            </View>
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

          {/* Green Highlighted Bar: Net Payable to Winner */}
          <View style={styles.trGreen}>
            <Text style={{ width: C.sl, textAlign: 'center', ...bold }}>NET</Text>
            <View style={{ width: C.desc }}>
              <Text style={styles.redLabel}>{t.netPayableWinnerHand}</Text>
              <Text style={styles.tdSubNote}>
                {t.prizePayoutMinusWinnerInst} ({fmt(s.prizePayoutTotal)} - {fmt(s.winnerPeriodInstallmentUnpaid)})
              </Text>
            </View>
            <Text style={styles.greenAmount}>{fmt(s.netPayableAfterWinnerInstallment)}</Text>
          </View>

          {/* Payout & Settlement Transfers Sub-table */}
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
              <Text style={{ width: C.desc, color: '#6B7280' }}>
                {t.noPayoutPosted} ({t.payoutWord}: {data.auction.payoutStatus})
              </Text>
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
            <Text style={[styles.redLabel, { width: C.desc, textAlign: 'right', paddingRight: 10 }]}>
              {t.totalDisbursedWinner}
            </Text>
            <Text style={{ width: C.amt, textAlign: 'right', ...bold, fontSize: 9.5 }}>
              {fmt(data.payouts.totalDisbursedToWinner)}
            </Text>
          </View>

          {/* Arrears & Penalty Auto-Deduction Summary (FIFO Settlement) */}
          {(data.payouts.arrearsDeductedAmount > 0 || data.payouts.penaltyDeductedAmount > 0) && (
            <>
              <View style={[styles.tr, { backgroundColor: '#FFFBEB' }]}>
                <Text style={{ width: C.sl, textAlign: 'center', ...bold }}>NET</Text>
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
            </>
          )}

          {/* Target vs Disbursed vs Balance */}
          <View style={[styles.tr, { paddingVertical: 0, paddingHorizontal: 0 }]}>
            <Text style={{ width: C.sl, padding: 5, textAlign: 'center', ...bold }}>BAL</Text>
            <View
              style={{
                width: '31.5%',
                padding: 5,
                borderLeftWidth: 0.75,
                borderLeftColor: '#CBD5E1',
                borderLeftStyle: 'solid',
              }}
            >
              <Text style={{ fontSize: 7, color: '#6B7280' }}>
                {data.payouts.arrearsDeductedAmount > 0 || data.payouts.penaltyDeductedAmount > 0
                  ? t.netTargetAfterArrears
                  : t.targetGrossPayout}
              </Text>
              <Text style={{ ...bold }}>{fmt(data.payouts.netPayableAmount ?? s.prizePayoutTotal)}</Text>
            </View>
            <View
              style={{
                width: '31.5%',
                padding: 5,
                borderLeftWidth: 0.75,
                borderLeftColor: '#CBD5E1',
                borderLeftStyle: 'solid',
              }}
            >
              <Text style={{ fontSize: 7, color: '#6B7280' }}>{t.paidDisbursed}</Text>
              <Text style={{ ...bold }}>{fmt(data.payouts.totalDisbursedToWinner)}</Text>
            </View>
            <View
              style={[
                styles.yellowCell,
                { width: C.amt, padding: 5, borderLeftWidth: 0.75, borderLeftColor: '#111827', borderLeftStyle: 'solid' },
              ]}
            >
              <Text style={{ fontSize: 7, color: '#111827', textAlign: 'right' }}>{t.balancePending}</Text>
              <Text style={{ ...bold, textAlign: 'right' }}>{fmt(data.payouts.remainingPayoutBalance)}</Text>
            </View>
          </View>

          {/* Cash Denomination Rows */}
          {data.denominations.map((den) => (
            <View key={den.denomination} style={[styles.tr, { paddingVertical: 3.5 }]}>
              <Text style={{ width: C.sl, textAlign: 'center', ...bold }}>{den.denomination}</Text>
              <Text style={{ width: C.desc, fontSize: 8, color: '#4B5563' }}>
                {t.cashNoteCount}:{' '}
                {den.count > 0 ? `${den.count} ${t.notesWord} × ${sym} ${den.denomination}` : t.digitalNil}
              </Text>
              <Text style={{ width: C.amt, textAlign: 'right' }}>{fmt(den.amount)}</Text>
            </View>
          ))}

          <View style={[styles.tr, { borderBottomWidth: 0, paddingVertical: 0, paddingHorizontal: 0 }]}>
            <Text style={{ width: '74%', padding: 5, textAlign: 'center', ...bold }}>{t.totalCashDenomPayout}</Text>
            <View
              style={[
                styles.yellowCell,
                { width: C.amt, padding: 5, borderLeftWidth: 0.75, borderLeftColor: '#111827', borderLeftStyle: 'solid' },
              ]}
            >
              <Text style={{ ...bold, textAlign: 'right', fontSize: 9.5 }}>
                {fmt(data.denominationCashTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* Template-Specific Mechanics & Engine Equation Card */}
        {(data.basePlusPremium || data.gold || data.commodity || data.asca || data.formulaLines.length > 0) && (
          <View style={[styles.summaryCard, { flex: 0, marginBottom: 8 }]}>
            <Text style={styles.summaryCardTitle}>
              {data.group.engineLabel} — {t.templateMechanicsTitle}
            </Text>
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
              <Text style={{ fontSize: 7, color: '#374151', marginTop: 2 }}>
                {data.formulaLines.join('  |  ')}
              </Text>
            )}
          </View>
        )}

        {/* Money Flow & Security Summary Strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>{t.poolMoneyFlowTitle}</Text>
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

          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>{t.securityGateTitle}</Text>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>{t.attendanceLabel}:</Text>
              <Text style={styles.kvVal}>
                {data.auction.presentCount} / {data.auction.proxyCount} / {data.auction.absentCount}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>{t.collateralTypeLabel}:</Text>
              <Text style={styles.kvVal}>{data.security?.typeLabel ?? t.pendingAssignment}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLbl}>{t.securityStatusLabel}:</Text>
              <Text style={styles.kvVal}>{(data.security?.status ?? 'pending').toUpperCase()}</Text>
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
              <Text style={{ fontSize: 7, color: '#374151', marginTop: 2 }}>
                {t.notesLabel}: {data.security.details}
              </Text>
            )}
            {data.security && data.security.documents.length > 0 && (
              <Text style={{ fontSize: 7, color: '#065F46', marginTop: 2 }}>
                {t.docsLabel}: {data.security.documents.map((d) => `${d.label} (${d.status})`).join(', ')}
              </Text>
            )}
            {data.payouts.dividendReceiptNo && (
              <Text style={{ fontSize: 7, color: '#5A195B', marginTop: 2 }}>
                {t.dividendReceiptLabel}: {data.payouts.dividendReceiptNo}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {data.tenantName} · {t.periodWord} {data.auction.periodNumber} {t.settlementReportWord} ·{' '}
            {data.group.name}
          </Text>
          <Text render={({ pageNumber, totalPages }) => t.pageOf(pageNumber, totalPages)} />
        </View>
      </Page>

      {/* PAGE 2: Multi-Division Winners (if any), Bid Log, Member Ledger & Minutes */}
      <Page size="A4" style={styles.page}>
        {data.multiDivisionWinners.length > 1 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.subHead}>
              {t.periodWord} {data.auction.periodNumber} {t.multiDivTitle} ({data.multiDivisionWinners.length})
            </Text>
            <View style={styles.miniHeader}>
              <Text style={[styles.miniTh, { width: '12%' }]}>{t.ticketCol}</Text>
              <Text style={[styles.miniTh, { width: '36%' }]}>{t.winnerNameCol}</Text>
              <Text style={[styles.miniTh, { width: '16%' }]}>{t.winTypeCol}</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>{t.prizeCol}</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>{t.discountCol}</Text>
            </View>
            {data.multiDivisionWinners.map((mw, idx) => (
              <View
                key={idx}
                style={[styles.miniTr, { backgroundColor: idx % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }]}
              >
                <Text style={[styles.miniTd, { width: '12%' }]}>#{mw.ticketNo ?? idx + 1}</Text>
                <Text style={[styles.miniTd, { width: '36%' }]}>{mw.memberName}</Text>
                <Text style={[styles.miniTd, { width: '16%', textTransform: 'uppercase' }]}>{mw.winType}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right', ...bold }]}>
                  {fmt(mw.prizeAmount)}
                </Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right' }]}>{fmt(mw.bidDiscount)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.subHead}>
          {t.periodWord} {data.auction.periodNumber} {t.biddingLogTitle} ({data.bids.length} {t.bidsWord})
        </Text>
        {data.bids.length === 0 ? (
          <Text style={{ fontSize: 8, color: '#6B7280', marginBottom: 8 }}>
            {t.noBidsRecorded} ({data.group.auctionType} / {data.group.engineLabel})
          </Text>
        ) : (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.miniHeader}>
              <Text style={[styles.miniTh, { width: '10%' }]}>{t.ticketCol}</Text>
              <Text style={[styles.miniTh, { width: '30%' }]}>{t.memberCol}</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>{t.prizeCol}</Text>
              <Text style={[styles.miniTh, { width: '18%', textAlign: 'right' }]}>{t.discountCol}</Text>
              <Text style={[styles.miniTh, { width: '12%', textAlign: 'center' }]}>{t.sourceCol}</Text>
              <Text style={[styles.miniTh, { width: '12%', textAlign: 'center' }]}>{t.statusCol}</Text>
            </View>
            {data.bids.slice(0, 15).map((b, i) => (
              <View
                key={i}
                style={[
                  styles.miniTr,
                  { backgroundColor: b.status === 'winning' ? '#DCFCE7' : i % 2 === 1 ? '#F9FAFB' : '#FFFFFF' },
                ]}
              >
                <Text style={[styles.miniTd, { width: '10%' }]}>#{b.ticketNo}</Text>
                <Text style={[styles.miniTd, { width: '30%' }]}>{b.memberName}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right', ...bold }]}>
                  {fmt(b.prizeAmount)}
                </Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right' }]}>{fmt(b.bidDiscount)}</Text>
                <Text style={[styles.miniTd, { width: '12%', textAlign: 'center' }]}>{b.source}</Text>
                <Text style={[styles.miniTd, { width: '12%', textAlign: 'center' }]}>{b.status}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.subHead}>
          {t.memberLedgerTitle} — {t.periodWord} {data.auction.periodNumber} ({data.memberRows.length} {t.membersWord})
        </Text>
        <View style={styles.miniHeader}>
          <Text style={[styles.miniTh, { width: '7%' }]}>{t.ticketCol}</Text>
          <Text style={[styles.miniTh, { width: '20%' }]}>{t.memberCol}</Text>
          <Text style={[styles.miniTh, { width: '10%' }]}>{t.roleCol}</Text>
          <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>{t.baseCol}</Text>
          <Text style={[styles.miniTh, { width: '11%', textAlign: 'right' }]}>
            {data.gold?.gramsPerFullTicket
              ? t.gramsCol
              : data.statement.deferredDividendTotal > 0
                ? t.divDefCol
                : t.dividendCol}
          </Text>
          <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>{t.netDueCol}</Text>
          <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>{t.paidCol}</Text>
          <Text style={[styles.miniTh, { width: '10%', textAlign: 'right' }]}>{t.balCol}</Text>
          <Text style={[styles.miniTh, { width: '12%', textAlign: 'right' }]}>{t.modeStatusCol}</Text>
        </View>
        {data.memberRows.map((m, idx) => (
          <View
            key={idx}
            style={[styles.miniTr, { backgroundColor: idx % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }]}
            wrap={false}
          >
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
            <Text style={[styles.miniTd, { width: '10%', textAlign: 'right', ...bold }]}>{fmt(m.netDue)}</Text>
            <Text style={[styles.miniTd, { width: '10%', textAlign: 'right' }]}>{fmt(m.paidAmount)}</Text>
            <Text
              style={[
                styles.miniTd,
                { width: '10%', textAlign: 'right', color: m.outstanding > 0 ? '#B91C1C' : '#047857' },
              ]}
            >
              {fmt(m.outstanding)}
            </Text>
            <Text style={[styles.miniTd, { width: '12%', textAlign: 'right' }]}>
              {m.paymentMode !== '—' ? `${m.paymentMode} (${m.status})` : m.status}
            </Text>
          </View>
        ))}

        <Text style={styles.subHead}>{t.officialMinutesTitle}</Text>
        <View style={styles.minutesBox}>
          <Text>{data.auction.minutesText}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {data.tenantName} · {t.periodWord} {data.auction.periodNumber} {t.settlementReportWord} ·{' '}
            {data.group.name}
          </Text>
          <Text render={({ pageNumber, totalPages }) => t.pageOf(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
