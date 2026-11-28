import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ChitPeriodReportData } from './periodReport';
import { getPeriodReportCopy, type PeriodReportCopy } from './periodReportI18n';
import { ensurePdfFonts, getPdfFontFamily, resolvePdfLang } from '../reports/pdfFonts';

function localizeCommissionBasis(raw: string, t: PeriodReportCopy): string {
  const up = String(raw || '').toUpperCase();
  return t.commissionBasisLabels[up] ?? raw;
}

function localizeChitType(raw: string, t: PeriodReportCopy): string {
  const low = String(raw || '').toLowerCase();
  return t.chitTypeLabels[low] ?? raw;
}

function localizeFrequency(raw: string, t: PeriodReportCopy): string {
  const low = String(raw || '').toLowerCase();
  return t.frequencyLabels[low] ?? (low ? low.charAt(0).toUpperCase() + low.slice(1) : '');
}

function localizeMemberRole(raw: string, t: PeriodReportCopy): string {
  const low = String(raw || '').toLowerCase();
  return t.roleLabels[low] ?? raw;
}

function localizeStatus(raw: string, t: PeriodReportCopy): string {
  const low = String(raw || '').toLowerCase();
  return t.statusLabels[low] ?? (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '');
}

function localizeBidSource(raw: string, t: PeriodReportCopy): string {
  const low = String(raw || '').toLowerCase();
  return t.bidSourceLabels[low] ?? raw;
}

function localizeEngineTitle(engineType: string, fallback: string, t: PeriodReportCopy): string {
  return t.engineTitles[engineType] ?? fallback;
}

function localizeSecurityType(typeCode: string, fallback: string, t: PeriodReportCopy): string {
  return t.securityTypeLabels[typeCode] ?? fallback;
}

function localizeSecurityDocLabel(doc: { type?: string; label: string }, t: PeriodReportCopy): string {
  return (doc.type && t.securityDocLabels[doc.type]) || doc.label;
}

function localizeMemberModeStatus(paymentMode: string, status: string, t: PeriodReportCopy): string {
  const cleanStatus = localizeStatus(status, t);
  const modeClean = (paymentMode || '').trim();
  const modeLow = modeClean.toLowerCase();
  if (!modeClean || modeClean === '—' || modeLow === 'recorded') {
    return cleanStatus;
  }
  const translatedMode = t.modeLabels[modeLow] ?? modeClean;
  if (translatedMode.toLowerCase() === cleanStatus.toLowerCase()) {
    return cleanStatus;
  }
  return `${translatedMode} · ${cleanStatus}`;
}

function createStitchPdfStyles(fontFamily: any, hasUnicode: boolean, compact: boolean) {
  const bold = hasUnicode ? { fontFamily, fontWeight: 'bold' as const } : { fontFamily: 'Helvetica-Bold' as const };
  const padRow = compact ? 4.2 : 5.0;
  const miniPad = compact ? 3.0 : 3.6;

  return {
    bold,
    styles: StyleSheet.create({
      page: {
        fontFamily,
        fontSize: compact ? 7.6 : 8.1,
        paddingTop: 18,
        paddingHorizontal: 22,
        paddingBottom: 38,
        backgroundColor: '#FFFFFF',
        color: '#1E293B',
        lineHeight: 1.28,
      },
      // 1. Unified Executive Header Card
      execHeaderCard: {
        borderWidth: 0.9,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
      },
      execTopBand: {
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 0.7,
        borderBottomColor: '#E2E8F0',
        borderBottomStyle: 'solid',
        paddingVertical: 7,
        paddingHorizontal: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      brandLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
      },
      monogram: {
        width: 26,
        height: 26,
        borderRadius: 5,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
        justifyContent: 'center',
      },
      monogramText: {
        ...bold,
        fontSize: 13,
        color: '#FFFFFF',
      },
      brandTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      },
      brandTitle: {
        ...bold,
        fontSize: 11.5,
        color: '#0F172A',
      },
      amberChip: {
        backgroundColor: '#FFFBEB',
        borderWidth: 0.6,
        borderColor: '#FCD34D',
        borderStyle: 'solid',
        borderRadius: 3,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
      },
      amberChipText: {
        ...bold,
        fontSize: 6.4,
        color: '#92400E',
      },
      brandSub: {
        fontSize: 7.0,
        color: '#64748B',
        marginTop: 1.5,
      },
      headerPillsCol: {
        flexDirection: 'row',
        gap: 5,
        alignItems: 'center',
      },
      indigoChip: {
        backgroundColor: '#EEF2FF',
        borderWidth: 0.6,
        borderColor: '#C7D2FE',
        borderStyle: 'solid',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
      },
      indigoChipText: {
        ...bold,
        fontSize: 6.8,
        color: '#312E81',
      },
      emeraldChip: {
        backgroundColor: '#ECFDF5',
        borderWidth: 0.6,
        borderColor: '#6EE7B7',
        borderStyle: 'solid',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
      },
      emeraldChipText: {
        ...bold,
        fontSize: 6.8,
        color: '#065F46',
      },
      execBottomBand: {
        paddingVertical: 7,
        paddingHorizontal: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
      },
      kickerLabel: {
        ...bold,
        fontSize: 6.8,
        color: '#4338CA',
        marginBottom: 1.5,
      },
      reportTitle: {
        ...bold,
        fontSize: 11.2,
        color: '#0F172A',
      },
      reportSubTitle: {
        fontSize: 7.2,
        color: '#475569',
        marginTop: 1.5,
      },
      metaBoxesRow: {
        flexDirection: 'row',
        gap: 5,
      },
      metaBox: {
        backgroundColor: '#F8FAFC',
        borderWidth: 0.6,
        borderColor: '#E2E8F0',
        borderStyle: 'solid',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 7,
        minWidth: 56,
      },
      metaBoxGreen: {
        backgroundColor: '#ECFDF5',
        borderWidth: 0.7,
        borderColor: '#6EE7B7',
        borderStyle: 'solid',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 7,
        minWidth: 58,
      },
      metaBoxLbl: {
        fontSize: 6.0,
        color: '#64748B',
      },
      metaBoxVal: {
        ...bold,
        fontSize: 7.2,
        color: '#0F172A',
        marginTop: 1,
      },

      // 2. Prized Winner Highlight Banner
      winnerBanner: {
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#A5B4FC',
        borderStyle: 'solid',
        borderRadius: 6,
        paddingVertical: 7,
        paddingHorizontal: 10,
        marginBottom: 9,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
      },
      winnerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
      },
      winnerBadgeBox: {
        width: 28,
        height: 28,
        borderRadius: 5,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
        justifyContent: 'center',
      },
      winnerBadgeBoxTxt: {
        ...bold,
        fontSize: 10,
        color: '#FFFFFF',
      },
      prizedPill: {
        backgroundColor: '#4F46E5',
        borderRadius: 3,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
      },
      prizedPillTxt: {
        ...bold,
        fontSize: 6.3,
        color: '#FFFFFF',
      },
      winnerNameBig: {
        ...bold,
        fontSize: 11,
        color: '#0F172A',
        marginTop: 1.5,
      },
      winnerMetaSub: {
        fontSize: 7.0,
        color: '#475569',
        marginTop: 1,
      },
      winnerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      grossBox: {
        alignItems: 'flex-end',
      },
      netHandPill: {
        backgroundColor: '#059669',
        borderRadius: 5,
        paddingVertical: 5,
        paddingHorizontal: 9,
        alignItems: 'flex-end',
      },
      netHandLbl: {
        ...bold,
        fontSize: 6.2,
        color: '#D1FAE5',
      },
      netHandVal: {
        ...bold,
        fontSize: 10.6,
        color: '#FFFFFF',
        marginTop: 1,
      },

      // Section Header Strip (Stitch bar with small square pill, never card left-border!)
      secHeadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 0.8,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        paddingBottom: 3,
        marginBottom: 5,
      },
      secHeadLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      },
      secDotIndigo: {
        width: 5,
        height: 10,
        borderRadius: 1.5,
        backgroundColor: '#4F46E5',
      },
      secDotRose: {
        width: 5,
        height: 10,
        borderRadius: 1.5,
        backgroundColor: '#E11D48',
      },
      secHeadTitle: {
        ...bold,
        fontSize: 7.8,
        color: '#0F172A',
      },
      secHeadRight: {
        fontSize: 6.8,
        color: '#64748B',
      },

      // Section 1 Table (Light Slate Header per Stitch)
      tableCard: {
        borderWidth: 0.8,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 9,
        backgroundColor: '#FFFFFF',
      },
      tableHeadLight: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderBottomWidth: 0.8,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        paddingVertical: 5,
        paddingHorizontal: 8,
        alignItems: 'center',
      },
      thLight: {
        ...bold,
        fontSize: 7.4,
        color: '#0F172A',
      },
      tr: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E2E8F0',
        borderBottomStyle: 'solid',
        paddingVertical: padRow,
        paddingHorizontal: 8,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
      },
      trSubNote: {
        fontSize: 6.6,
        color: '#64748B',
        marginTop: 1,
      },
      trEmeraldNet: {
        flexDirection: 'row',
        backgroundColor: '#DCFCE7',
        borderTopWidth: 1.0,
        borderTopColor: '#34D399',
        borderTopStyle: 'solid',
        paddingVertical: 5.5,
        paddingHorizontal: 8,
        alignItems: 'center',
      },

      // Section 2: 4-Card Handover Strip
      handoverCard: {
        borderWidth: 0.8,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        backgroundColor: '#F8FAFC',
        padding: 7,
        marginBottom: 9,
      },
      kpiGrid: {
        flexDirection: 'row',
        gap: 6,
      },
      kpiBox: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 0.6,
        borderColor: '#E2E8F0',
        borderStyle: 'solid',
        borderRadius: 4,
        paddingVertical: 5,
        paddingHorizontal: 7,
      },
      kpiBoxRose: {
        flex: 1,
        backgroundColor: '#FFF1F2',
        borderWidth: 0.7,
        borderColor: '#FECDD3',
        borderStyle: 'solid',
        borderRadius: 4,
        paddingVertical: 5,
        paddingHorizontal: 7,
      },
      kpiBoxEmerald: {
        flex: 1,
        backgroundColor: '#059669',
        borderRadius: 4,
        paddingVertical: 5,
        paddingHorizontal: 7,
      },
      kpiBoxAmber: {
        flex: 1,
        backgroundColor: '#FEF3C7',
        borderWidth: 0.7,
        borderColor: '#FCD34D',
        borderStyle: 'solid',
        borderRadius: 4,
        paddingVertical: 5,
        paddingHorizontal: 7,
      },
      kpiLbl: {
        fontSize: 6.5,
        color: '#64748B',
      },
      kpiVal: {
        ...bold,
        fontSize: 9.2,
        color: '#0F172A',
        marginTop: 2,
      },

      // Section 3 & 4 Dark-Header Split Cards
      splitGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 9,
      },
      darkHeaderCard: {
        flex: 1,
        borderWidth: 0.8,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      },
      darkCardBar: {
        backgroundColor: '#0F172A',
        paddingVertical: 4.5,
        paddingHorizontal: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      darkCardBarTitle: {
        ...bold,
        fontSize: 7.5,
        color: '#FFFFFF',
      },
      darkCardBarRight: {
        fontSize: 6.6,
        color: '#94A3B8',
      },
      cardBody: {
        paddingVertical: 5,
        paddingHorizontal: 8,
      },
      kvHairlineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#F1F5F9',
        borderBottomStyle: 'solid',
        paddingVertical: 3,
        gap: 6,
      },
      kvLbl: {
        fontSize: 6.9,
        color: '#64748B',
      },
      kvVal: {
        ...bold,
        fontSize: 7.0,
        color: '#0F172A',
        textAlign: 'right',
      },
      cardFooterIndigo: {
        backgroundColor: '#EEF2FF',
        borderTopWidth: 0.6,
        borderTopColor: '#C7D2FE',
        borderTopStyle: 'solid',
        paddingVertical: 4.5,
        paddingHorizontal: 8,
      },

      // Section 5 Member Ledger
      miniHeaderLight: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderBottomWidth: 0.8,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        paddingVertical: 4.2,
        paddingHorizontal: 5,
        alignItems: 'center',
      },
      miniThLight: {
        ...bold,
        fontSize: 6.7,
        color: '#1E293B',
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
        fontSize: compact ? 6.8 : 7.1,
        color: '#334155',
      },
      totalsRow: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderTopWidth: 0.9,
        borderTopColor: '#94A3B8',
        borderTopStyle: 'solid',
        paddingVertical: 4.5,
        paddingHorizontal: 5,
        alignItems: 'center',
      },

      // Badges inside tables
      badgeNeutral: {
        backgroundColor: '#F1F5F9',
        borderWidth: 0.5,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1,
      },
      badgeWinnerSolid: {
        backgroundColor: '#4F46E5',
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1,
      },
      badgeGreenSolid: {
        backgroundColor: '#059669',
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1,
      },
      badgeAmberOutline: {
        backgroundColor: '#FFFBEB',
        borderWidth: 0.5,
        borderColor: '#FCD34D',
        borderStyle: 'solid',
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1,
      },

      // Minutes & Sign-Off
      minutesBox: {
        borderWidth: 0.8,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        backgroundColor: '#F8FAFC',
        padding: 7,
        marginBottom: 9,
      },
      signGrid: {
        flexDirection: 'row',
        gap: 7,
      },
      signCard: {
        flex: 1,
        borderWidth: 0.8,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
        padding: 7,
        minHeight: 68,
        justifyContent: 'space-between',
      },
      sealCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 0.8,
        borderColor: '#818CF8',
        borderStyle: 'dashed',
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
      },
      footer: {
        position: 'absolute',
        bottom: 13,
        left: 22,
        right: 22,
        borderTopWidth: 0.6,
        borderTopColor: '#CBD5E1',
        borderTopStyle: 'solid',
        paddingTop: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 6.7,
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

  const compact = data.memberRows.length >= 10 || data.bids.length > 4 || data.multiDivisionWinners.length > 1;
  const { styles, bold } = createStitchPdfStyles(getPdfFontFamily(resolvedLang), hasUnicode, compact);

  const sym = !data.currencySymbol || data.currencySymbol === '₹' ? (hasUnicode ? '₹' : 'Rs.') : data.currencySymbol;
  const fmt = (n: number | null | undefined, decimals = 0) =>
    `${sym} ${Number(n ?? 0).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  const fmtPlain = (n: number | null | undefined) =>
    Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const s = data.statement;
  const winnerTitle = data.auction.winnerName
    ? `${data.auction.winnerName}${data.auction.winnerTicketNo ? ` (#${data.auction.winnerTicketNo})` : ''}`
    : t.winnerPending;
  const discountPct =
    s.chitValue > 0 ? ((s.bidDiscount / s.chitValue) * 100).toFixed(2) : '0.00';

  const activeDenoms = data.denominations.filter((d) => d.count > 0);
  const visibleBids = data.bids.slice(0, 8);
  const hiddenBidCount = Math.max(0, data.bids.length - visibleBids.length);
  const pendingBalance = Number(data.payouts.remainingPayoutBalance ?? 0);
  const arrearsOffsetTotal = Number(data.payouts.arrearsDeductedAmount ?? 0) + Number(data.payouts.penaltyDeductedAmount ?? 0);
  const engineTitle = localizeEngineTitle(data.group.engineType, data.group.engineLabel, t);
  const keepLedgerWhole = data.memberRows.length <= 26;
  const tenantInitial = (data.tenantName || 'Z').trim().charAt(0).toUpperCase();
  const groupRef = data.group.groupCode || data.group.id.slice(-8);

  const ledgerTotals = data.memberRows.reduce(
    (acc, m) => ({
      baseDue: acc.baseDue + Number(m.baseDue ?? 0),
      dividend: acc.dividend + Number(m.dividendEarned ?? 0),
      netDue: acc.netDue + Number(m.netDue ?? 0),
      paid: acc.paid + Number(m.paidAmount ?? 0),
      bal: acc.bal + Number(m.outstanding ?? 0),
    }),
    { baseDue: 0, dividend: 0, netDue: 0, paid: 0, bal: 0 },
  );

  const securityApproved = ['approved', 'verified'].includes(String(data.security?.status || '').toLowerCase());
  const payoutPaid = String(data.auction.payoutStatus || '').toLowerCase() === 'paid';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 1. Unified Executive Header & Identity Box */}
        <View style={styles.execHeaderCard} wrap={false}>
          <View style={styles.execTopBand}>
            <View style={styles.brandLeft}>
              <View style={styles.monogram}>
                <Text style={styles.monogramText}>{tenantInitial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.brandTitleRow}>
                  <Text style={styles.brandTitle}>{data.tenantName}</Text>
                  <View style={styles.amberChip}>
                    <Text style={styles.amberChipText}>{localizeChitType(data.group.chitType, t)}</Text>
                  </View>
                </View>
                <Text style={styles.brandSub}>
                  {data.branchName} · {engineTitle} · {localizeFrequency(data.group.frequency, t)}
                </Text>
              </View>
            </View>
            <View style={styles.headerPillsCol}>
              <View style={styles.indigoChip}>
                <Text style={styles.indigoChipText}>
                  {t.statusWord}: {localizeStatus(data.auction.status, t)}
                </Text>
              </View>
              <View style={payoutPaid ? styles.emeraldChip : styles.amberChip}>
                <Text style={payoutPaid ? styles.emeraldChipText : styles.amberChipText}>
                  {t.payoutWord}: {localizeStatus(data.auction.payoutStatus, t)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.execBottomBand}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kickerLabel}>{t.settlementReportWord}</Text>
              <Text style={styles.reportTitle}>{data.group.name}</Text>
              <Text style={styles.reportSubTitle}>
                {data.templateSectionTitle} ({fmt(s.chitValue)})
              </Text>
            </View>
            <View style={styles.metaBoxesRow}>
              <View style={styles.metaBox}>
                <Text style={styles.metaBoxLbl}>{t.groupWord}</Text>
                <Text style={styles.metaBoxVal}>{groupRef}</Text>
              </View>
              <View style={styles.metaBox}>
                <Text style={styles.metaBoxLbl}>{t.periodWord}</Text>
                <Text style={[styles.metaBoxVal, { color: '#312E81' }]}>
                  {data.auction.periodNumber} {t.ofWord} {data.group.totalMembers}
                </Text>
              </View>
              <View style={styles.metaBox}>
                <Text style={styles.metaBoxLbl}>{t.generatedWord}</Text>
                <Text style={styles.metaBoxVal}>{fmtDate(data.auction.auctionDate)}</Text>
              </View>
              <View style={payoutPaid ? styles.metaBoxGreen : styles.metaBox}>
                <Text style={styles.metaBoxLbl}>{t.payoutWord}</Text>
                <Text style={[styles.metaBoxVal, { color: payoutPaid ? '#065F46' : '#92400E' }]}>
                  {localizeStatus(data.auction.payoutStatus, t)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Prized Winner Highlight Banner */}
        <View style={styles.winnerBanner} wrap={false}>
          <View style={styles.winnerLeft}>
            <View style={styles.winnerBadgeBox}>
              <Text style={styles.winnerBadgeBoxTxt}>
                #{data.auction.winnerTicketNo || '—'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={styles.prizedPill}>
                  <Text style={styles.prizedPillTxt}>{t.prizedBeneficiary}</Text>
                </View>
                {data.auction.winnerTicketNo && (
                  <Text style={{ fontSize: 7.0, ...bold, color: '#3730A3' }}>
                    {t.ticketCol} #{data.auction.winnerTicketNo}
                  </Text>
                )}
              </View>
              <Text style={styles.winnerNameBig}>{data.auction.winnerName || t.winnerPending}</Text>
              <Text style={styles.winnerMetaSub}>
                {t.discountCol}: {fmt(s.bidDiscount)} ({discountPct}%) ·{' '}
                {data.security ? localizeSecurityType(data.security.typeCode, data.security.typeLabel, t) : t.pendingAssignment}
              </Text>
            </View>
          </View>

          <View style={styles.winnerRight}>
            <View style={styles.grossBox}>
              <Text style={{ fontSize: 6.4, color: '#475569' }}>{t.grossPrizeLabel}</Text>
              <Text style={{ ...bold, fontSize: 10, color: '#0F172A' }}>{fmt(s.prizePayoutTotal)}</Text>
            </View>
            <View style={styles.netHandPill}>
              <Text style={styles.netHandLbl}>{t.netPayableWinnerHand}</Text>
              <Text style={styles.netHandVal}>{fmt(s.netPayableAfterWinnerInstallment)}</Text>
            </View>
          </View>
        </View>

        {/* SECTION 1: Prize Settlement & Dividend Computation Table */}
        <View wrap={false}>
          <View style={styles.secHeadRow}>
            <View style={styles.secHeadLeft}>
              <View style={styles.secDotIndigo} />
              <Text style={styles.secHeadTitle}>{t.section1Title}</Text>
            </View>
            <Text style={styles.secHeadRight}>
              {data.group.totalMembers} {t.membersWord} · {t.commWord} {data.group.commissionPct}% ({localizeCommissionBasis(data.group.commissionBasis, t)})
            </Text>
          </View>

          <View style={styles.tableCard}>
            <View style={styles.tableHeadLight}>
              <Text style={[styles.thLight, { width: C.sl, textAlign: 'center' }]}>{t.slNo}</Text>
              <Text style={[styles.thLight, { width: C.desc }]}>
                {t.description} — {winnerTitle}
              </Text>
              <Text style={[styles.thLight, { width: C.amt, textAlign: 'right' }]}>
                {t.amountCol} ({sym})
              </Text>
            </View>

            <View style={styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center', color: '#64748B' }}>1</Text>
              <Text style={{ width: C.desc, ...bold, color: '#0F172A' }}>
                {t.totalChitValue} ({t.grossPool} = {data.group.totalMembers} × {fmt(s.baseInstallment)})
              </Text>
              <Text style={{ width: C.amt, textAlign: 'right', ...bold, fontSize: 8.6, color: '#0F172A' }}>
                {fmt(s.chitValue)}
              </Text>
            </View>

            <View style={styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center', color: '#64748B' }}>2</Text>
              <View style={{ width: C.desc }}>
                <Text style={{ ...bold, color: '#0F172A' }}>{s.row2Title}</Text>
                <Text style={styles.trSubNote}>{s.row2Note}</Text>
              </View>
              <Text style={{ width: C.amt, textAlign: 'right', ...bold }}>{fmt(s.bidDiscount)}</Text>
            </View>

            <View style={styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center', color: '#64748B' }}>3</Text>
              <View style={{ width: C.desc }}>
                <Text style={{ ...bold, color: '#0F172A' }}>{s.row3Title}</Text>
                <Text style={styles.trSubNote}>
                  {t.foremanFeePerTicket}: {fmt(s.foremanFeePerTicket)}
                  {s.gstAmount > 0 ? ` · ${t.gstLabel}: ${fmt(s.gstAmount)}` : ''}
                  {s.roundingIncome > 0 ? ` · ${t.roundingLabel}: ${fmt(s.roundingIncome)}` : ''}
                </Text>
              </View>
              <Text style={{ width: C.amt, textAlign: 'right', ...bold }}>{fmt(s.commission)}</Text>
            </View>

            <View style={styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center', color: '#64748B' }}>4</Text>
              <View style={{ width: C.desc }}>
                <Text style={{ ...bold, color: '#0F172A' }}>{s.row4Title}</Text>
                <Text style={styles.trSubNote}>{s.row4Note}</Text>
              </View>
              <Text style={{ width: C.amt, textAlign: 'right', ...bold, color: '#047857' }}>
                {s.dividendPerTicket > 0
                  ? fmt(s.dividendPerTicket)
                  : s.deferredDividendTotal > 0
                    ? fmt(s.deferredDividendTotal)
                    : fmt(0)}
              </Text>
            </View>

            <View style={styles.tr}>
              <Text style={{ width: C.sl, textAlign: 'center', color: '#64748B' }}>5</Text>
              <View style={{ width: C.desc }}>
                <Text style={{ ...bold, color: '#0F172A' }}>{s.row5Title}</Text>
                <Text style={styles.trSubNote}>
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

            <View style={[styles.tr, { borderBottomWidth: 0 }]}>
              <Text style={{ width: C.sl, textAlign: 'center', color: '#64748B' }}>6</Text>
              <View style={{ width: C.desc }}>
                <Text style={{ ...bold, color: '#0F172A' }}>
                  {t.winnerCurrentInst} (
                  {s.winnerPeriodInstallmentUnpaid === 0 && s.winnerPeriodInstallmentPaid > 0
                    ? t.alreadyPaid
                    : t.deductedFromPrize}
                  )
                </Text>
                <Text style={styles.trSubNote}>
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

            <View style={styles.trEmeraldNet}>
              <Text style={{ width: C.sl, textAlign: 'center', ...bold, color: '#065F46' }}>NET</Text>
              <View style={{ width: C.desc }}>
                <Text style={{ ...bold, fontSize: 8.8, color: '#065F46' }}>{t.netPayableWinnerHand}</Text>
                <Text style={{ fontSize: 6.6, color: '#047857', marginTop: 1 }}>
                  {t.prizePayoutMinusWinnerInst} ({fmt(s.prizePayoutTotal)} - {fmt(s.winnerPeriodInstallmentUnpaid)})
                </Text>
              </View>
              <Text style={{ width: C.amt, textAlign: 'right', ...bold, fontSize: 10.2, color: '#065F46' }}>
                {fmt(s.netPayableAfterWinnerInstallment)}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 2: Arrears Recovery & Payout Settlement Cards */}
        <View style={styles.handoverCard} wrap={false}>
          <View style={[styles.secHeadRow, { marginBottom: 6, borderBottomColor: '#E2E8F0' }]}>
            <View style={styles.secHeadLeft}>
              <View style={styles.secDotRose} />
              <Text style={styles.secHeadTitle}>{t.section2Title}</Text>
            </View>
            <View style={payoutPaid ? styles.emeraldChip : styles.amberChip}>
              <Text style={payoutPaid ? styles.emeraldChipText : styles.amberChipText}>
                {t.payoutWord}: {localizeStatus(data.auction.payoutStatus, t)}
              </Text>
            </View>
          </View>

          <View style={styles.kpiGrid}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLbl}>{t.targetGrossPayout}</Text>
              <Text style={styles.kpiVal}>{fmt(s.prizePayoutTotal)}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLbl}>{t.netTargetAfterArrears}</Text>
              <Text style={styles.kpiVal}>{fmt(data.payouts.netPayableAmount ?? s.prizePayoutTotal)}</Text>
            </View>
            <View style={arrearsOffsetTotal > 0 ? styles.kpiBoxRose : styles.kpiBox}>
              <Text style={[styles.kpiLbl, arrearsOffsetTotal > 0 ? { color: '#BE123C' } : {}]}>
                {t.arrearsOffsetTitle}
              </Text>
              <Text style={[styles.kpiVal, { color: arrearsOffsetTotal > 0 ? '#BE123C' : '#047857' }]}>
                {arrearsOffsetTotal > 0 ? `- ${fmt(arrearsOffsetTotal)}` : fmt(0)}
              </Text>
            </View>
            <View style={pendingBalance > 0 ? styles.kpiBoxAmber : styles.kpiBoxEmerald}>
              <Text style={{ fontSize: 6.4, color: pendingBalance > 0 ? '#92400E' : '#D1FAE5' }}>
                {pendingBalance > 0 ? t.balancePending : t.paidDisbursed}
              </Text>
              <Text style={{ ...bold, fontSize: 9.4, color: pendingBalance > 0 ? '#92400E' : '#FFFFFF', marginTop: 2 }}>
                {pendingBalance > 0 ? fmt(pendingBalance) : fmt(data.payouts.totalDisbursedToWinner)}
              </Text>
            </View>
          </View>

          {data.payouts.rows.length > 0 ? (
            <View style={{ marginTop: 6, borderTopWidth: 0.6, borderTopColor: '#E2E8F0', borderTopStyle: 'solid', paddingTop: 4 }}>
              {data.payouts.rows.map((r) => (
                <View key={r.slNo} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1.5 }}>
                  <Text style={{ fontSize: 6.8, color: '#334155' }}>
                    {r.slNo}. {r.description} ({r.modeOrRef})
                  </Text>
                  <Text style={{ fontSize: 6.9, ...bold, color: '#065F46' }}>{fmt(r.amount)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 6.7, color: '#64748B', marginTop: 5 }}>
              {t.noPayoutPosted} ({t.paidDisbursed}: {fmt(data.payouts.totalDisbursedToWinner)} · {t.balancePending}: {fmt(pendingBalance)})
            </Text>
          )}
        </View>

        {/* Template Mechanics (non-standard schemes only) */}
        {(data.basePlusPremium || data.gold || data.commodity || data.asca || data.formulaLines.length > 0) && (
          <View style={styles.tableCard} wrap={false}>
            <View style={styles.darkCardBar}>
              <Text style={styles.darkCardBarTitle}>{engineTitle} — {t.templateMechanicsTitle}</Text>
            </View>
            <View style={styles.cardBody}>
              {data.basePlusPremium && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>
                    {t.nonPrizedLabel} {fmt(data.basePlusPremium.nonPrizedInstalment)} / {t.prizedLabel} {fmt(data.basePlusPremium.prizedInstalment)}
                  </Text>
                  <Text style={styles.kvVal}>
                    {fmt(data.basePlusPremium.collectedPool)} · {fmt(data.basePlusPremium.poolSurplus)}
                  </Text>
                </View>
              )}
              {data.gold && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>
                    {fmt(data.gold.goldRatePerGram)}/g{data.gold.gramsPerFullTicket > 0 ? ` · ${data.gold.gramsPerFullTicket} g` : ''}
                  </Text>
                  <Text style={styles.kvVal}>
                    {data.gold.bonusMonths > 0 ? `${data.gold.bonusMonths} mo` : `${data.gold.bonusPct}%`}
                  </Text>
                </View>
              )}
              {data.commodity && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>{data.commodity.itemsSummary}</Text>
                  <Text style={styles.kvVal}>{data.commodity.merchantBonusPct}%</Text>
                </View>
              )}
              {data.asca && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>{data.asca.monthlyLoanInterestPct}% / mo</Text>
                  <Text style={styles.kvVal}>{fmt(data.asca.adminExpensePerCycle)}</Text>
                </View>
              )}
              {data.formulaLines.length > 0 && (
                <Text style={{ fontSize: 6.6, color: '#475569', marginTop: 2 }}>{data.formulaLines.join('  |  ')}</Text>
              )}
            </View>
          </View>
        )}

        {/* SECTION 3 & 4: Cash Denomination + Pool Flow (Left) & Security Verification (Right) */}
        <View style={styles.splitGrid} wrap={false}>
          {/* Left Card: Cash Breakdown & Pool Flow */}
          <View style={styles.darkHeaderCard}>
            <View style={styles.darkCardBar}>
              <Text style={styles.darkCardBarTitle}>{t.section3CashTitle}</Text>
              <Text style={styles.darkCardBarRight}>{fmt(data.denominationCashTotal)}</Text>
            </View>

            {activeDenoms.length > 0 ? (
              <View>
                <View style={styles.miniHeaderLight}>
                  <Text style={[styles.miniThLight, { width: '32%' }]}>{t.cashNoteCount}</Text>
                  <Text style={[styles.miniThLight, { width: '32%', textAlign: 'center' }]}>{t.notesWord}</Text>
                  <Text style={[styles.miniThLight, { width: '36%', textAlign: 'right' }]}>{t.amountCol} ({sym})</Text>
                </View>
                {activeDenoms.map((d, idx) => (
                  <View key={idx} style={styles.miniTr}>
                    <Text style={[styles.miniTd, { width: '32%', ...bold }]}>{sym} {d.denomination}</Text>
                    <Text style={[styles.miniTd, { width: '32%', textAlign: 'center', color: '#64748B' }]}>
                      {d.count} {t.notesWord}
                    </Text>
                    <Text style={[styles.miniTd, { width: '36%', textAlign: 'right', ...bold }]}>{fmt(d.amount)}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', backgroundColor: '#ECFDF5', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.6, borderBottomColor: '#CBD5E1', borderBottomStyle: 'solid' }}>
                  <Text style={{ width: '64%', fontSize: 6.8, ...bold, color: '#065F46' }}>{t.totalCashDenomPayout}</Text>
                  <Text style={{ width: '36%', textAlign: 'right', fontSize: 7.4, ...bold, color: '#065F46' }}>{fmt(data.denominationCashTotal)}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.cardBody}>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>{t.otherMembersExpected(s.otherMembersCount)}</Text>
                <Text style={styles.kvVal}>{fmt(s.otherMembersExpectedCollection)}</Text>
              </View>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>{t.lessForemanComm}{s.gstAmount > 0 ? ` + ${t.gstLabel}` : ''}</Text>
                <Text style={[styles.kvVal, { color: '#BE123C' }]}>-{fmt(s.commission + s.gstAmount)}</Text>
              </View>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>{t.actualCollected(data.collections.paidCount, data.collections.unpaidCount)}</Text>
                <Text style={[styles.kvVal, { color: '#047857' }]}>{fmt(data.collections.totalCollected)}</Text>
              </View>
              <View style={[styles.kvHairlineRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.kvLbl}>{t.pendingCollectionBal}</Text>
                <Text style={[styles.kvVal, { color: data.collections.totalOutstanding > 0 ? '#B91C1C' : '#047857' }]}>
                  {fmt(data.collections.totalOutstanding)}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Card: Security & Attendance */}
          <View style={styles.darkHeaderCard}>
            <View style={styles.darkCardBar}>
              <Text style={styles.darkCardBarTitle}>{t.securityGateTitle}</Text>
              <Text style={{ fontSize: 6.8, ...bold, color: securityApproved ? '#6EE7B7' : '#FCD34D' }}>
                {localizeStatus(data.security?.status ?? 'pending', t)}
              </Text>
            </View>
            <View style={[styles.cardBody, { flex: 1 }]}>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>{t.collateralTypeLabel}</Text>
                <View style={styles.badgeNeutral}>
                  <Text style={{ fontSize: 6.7, ...bold, color: '#0F172A' }}>
                    {data.security ? localizeSecurityType(data.security.typeCode, data.security.typeLabel, t) : t.pendingAssignment}
                  </Text>
                </View>
              </View>
              {data.security?.value != null && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>{t.collateralValueLabel}</Text>
                  <Text style={[styles.kvVal, { color: '#065F46' }]}>{fmt(data.security.value)}</Text>
                </View>
              )}
              {data.security?.guarantorLabel && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>{t.guarantorWitnessLabel}</Text>
                  <Text style={styles.kvVal}>{data.security.guarantorLabel}</Text>
                </View>
              )}
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>{t.attendanceLabel}</Text>
                <Text style={styles.kvVal}>
                  {data.auction.presentCount} {t.presentWord} · {data.auction.proxyCount} {t.proxyWord} · {data.auction.absentCount} {t.absentWord}
                </Text>
              </View>
              {data.security?.details && (
                <View style={[styles.kvHairlineRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.kvLbl}>{t.notesLabel}</Text>
                  <Text style={styles.kvVal}>{data.security.details}</Text>
                </View>
              )}
            </View>

            {((data.security && data.security.documents.length > 0) || data.payouts.dividendReceiptNo) && (
              <View style={styles.cardFooterIndigo}>
                {data.security && data.security.documents.length > 0 && (
                  <Text style={{ fontSize: 6.6, color: '#312E81' }}>
                    {t.docsLabel}:{' '}
                    {data.security.documents
                      .map((d) => `${localizeSecurityDocLabel(d, t)} (${localizeStatus(d.status, t)})`)
                      .join(' · ')}
                  </Text>
                )}
                {data.payouts.dividendReceiptNo && (
                  <Text style={{ fontSize: 6.6, color: '#4338CA', marginTop: 1 }}>
                    {t.dividendReceiptLabel}: {data.payouts.dividendReceiptNo}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Multi-Division Winners Table (if any, kept intact) */}
        {data.multiDivisionWinners.length > 1 && (
          <View style={styles.tableCard} wrap={false}>
            <View style={styles.darkCardBar}>
              <Text style={styles.darkCardBarTitle}>
                {t.periodWord} {data.auction.periodNumber} {t.multiDivTitle} ({data.multiDivisionWinners.length})
              </Text>
            </View>
            <View style={styles.miniHeaderLight}>
              <Text style={[styles.miniThLight, { width: '12%' }]}>{t.ticketCol}</Text>
              <Text style={[styles.miniThLight, { width: '36%' }]}>{t.winnerNameCol}</Text>
              <Text style={[styles.miniThLight, { width: '16%' }]}>{t.winTypeCol}</Text>
              <Text style={[styles.miniThLight, { width: '18%', textAlign: 'right' }]}>{t.prizeCol}</Text>
              <Text style={[styles.miniThLight, { width: '18%', textAlign: 'right' }]}>{t.discountCol}</Text>
            </View>
            {data.multiDivisionWinners.map((mw, idx) => (
              <View key={idx} style={[styles.miniTr, { backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }]} wrap={false}>
                <Text style={[styles.miniTd, { width: '12%' }]}>#{mw.ticketNo ?? idx + 1}</Text>
                <Text style={[styles.miniTd, { width: '36%', ...bold }]}>{mw.memberName}</Text>
                <Text style={[styles.miniTd, { width: '16%' }]}>{localizeStatus(mw.winType, t)}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right', ...bold }]}>{fmt(mw.prizeAmount)}</Text>
                <Text style={[styles.miniTd, { width: '18%', textAlign: 'right' }]}>{fmt(mw.bidDiscount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* SECTION 5: Member Subscription & Dividend Ledger (kept whole on one page if <= 26 members) */}
        <View wrap={!keepLedgerWhole} style={{ marginBottom: 9 }}>
          <View style={styles.secHeadRow} minPresenceAhead={45}>
            <View style={styles.secHeadLeft}>
              <View style={styles.secDotIndigo} />
              <Text style={styles.secHeadTitle}>
                {t.section5LedgerTitle} ({data.memberRows.length} {t.membersWord})
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              <View style={styles.emeraldChip}>
                <Text style={styles.emeraldChipText}>{data.collections.paidCount} {localizeStatus('paid', t)}</Text>
              </View>
              <View style={styles.amberChip}>
                <Text style={styles.amberChipText}>{data.collections.unpaidCount} {localizeStatus('pending', t)}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.tableCard, { marginBottom: 0 }]}>
            <View style={styles.miniHeaderLight}>
              <Text style={[styles.miniThLight, { width: '5%', textAlign: 'center' }]}>{t.siCol}</Text>
              <Text style={[styles.miniThLight, { width: '7%' }]}>{t.ticketCol}</Text>
              <Text style={[styles.miniThLight, { width: '21%' }]}>{t.memberCol}</Text>
              <Text style={[styles.miniThLight, { width: '11%', textAlign: 'center' }]}>{t.roleCol}</Text>
              <Text style={[styles.miniThLight, { width: '10%', textAlign: 'right' }]}>{t.baseCol}</Text>
              <Text style={[styles.miniThLight, { width: '10%', textAlign: 'right', color: '#065F46' }]}>
                {data.gold?.gramsPerFullTicket ? t.gramsCol : data.statement.deferredDividendTotal > 0 ? t.divDefCol : t.dividendCol}
              </Text>
              <Text style={[styles.miniThLight, { width: '10%', textAlign: 'right' }]}>{t.netDueCol}</Text>
              <Text style={[styles.miniThLight, { width: '8%', textAlign: 'right', color: '#047857' }]}>{t.paidCol}</Text>
              <Text style={[styles.miniThLight, { width: '9%', textAlign: 'right', color: '#BE123C' }]}>{t.balCol}</Text>
              <Text style={[styles.miniThLight, { width: '9%', textAlign: 'center' }]}>{t.statusCol}</Text>
            </View>

            {data.memberRows.map((m, idx) => {
              const isWinner = String(m.role).toLowerCase() === 'winner';
              const isPaid = String(m.status).toLowerCase() === 'paid';
              const rowBg = isWinner ? '#EEF2FF' : idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
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
                  <Text style={[styles.miniTd, { width: '5%', textAlign: 'center', color: '#64748B' }]}>{idx + 1}</Text>
                  <Text style={[styles.miniTd, { width: '7%', ...bold, color: isWinner ? '#312E81' : '#0F172A' }]}>
                    #{m.ticketNo}
                  </Text>
                  <Text style={[styles.miniTd, { width: '21%', ...(isWinner ? bold : {}), color: '#0F172A' }]}>
                    {m.memberName}
                  </Text>
                  <View style={{ width: '11%', alignItems: 'center' }}>
                    <View style={isWinner ? styles.badgeWinnerSolid : styles.badgeNeutral}>
                      <Text style={{ fontSize: 6.1, ...bold, color: isWinner ? '#FFFFFF' : '#475569' }}>
                        {localizeMemberRole(m.role, t)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.miniTd, { width: '10%', textAlign: 'right' }]}>{fmtPlain(m.baseDue)}</Text>
                  <Text style={[styles.miniTd, { width: '10%', textAlign: 'right', color: '#047857', ...bold }]}>
                    {data.gold?.gramsPerFullTicket
                      ? `${m.goldGramsCredited.toFixed(4)}g`
                      : m.deferredDividend > 0
                        ? `${fmtPlain(m.dividendEarned)}/${fmtPlain(m.deferredDividend)}`
                        : fmtPlain(m.dividendEarned)}
                  </Text>
                  <Text style={[styles.miniTd, { width: '10%', textAlign: 'right', ...bold }]}>{fmtPlain(m.netDue)}</Text>
                  <Text style={[styles.miniTd, { width: '8%', textAlign: 'right', color: isPaid ? '#047857' : '#94A3B8', ...(isPaid ? bold : {}) }]}>
                    {fmtPlain(m.paidAmount)}
                  </Text>
                  <Text style={[styles.miniTd, { width: '9%', textAlign: 'right', color: m.outstanding > 0 ? '#BE123C' : '#047857', ...bold }]}>
                    {fmtPlain(m.outstanding)}
                  </Text>
                  <View style={{ width: '9%', alignItems: 'center' }}>
                    <View style={isPaid ? styles.badgeGreenSolid : styles.badgeAmberOutline}>
                      <Text style={{ fontSize: 5.9, ...bold, color: isPaid ? '#FFFFFF' : '#92400E' }}>
                        {localizeMemberModeStatus(m.paymentMode, m.status, t)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Aggregate Totals Footer Row */}
            <View style={styles.totalsRow} wrap={false}>
              <Text style={{ width: '44%', fontSize: 6.9, ...bold, color: '#0F172A' }}>
                {t.aggregateTotalsLabel} ({data.memberRows.length})
              </Text>
              <Text style={{ width: '10%', textAlign: 'right', fontSize: 7.0, ...bold, color: '#0F172A' }}>
                {fmtPlain(ledgerTotals.baseDue)}
              </Text>
              <Text style={{ width: '10%', textAlign: 'right', fontSize: 7.0, ...bold, color: '#065F46' }}>
                {fmtPlain(ledgerTotals.dividend)}
              </Text>
              <Text style={{ width: '10%', textAlign: 'right', fontSize: 7.0, ...bold, color: '#0F172A' }}>
                {fmtPlain(ledgerTotals.netDue)}
              </Text>
              <Text style={{ width: '8%', textAlign: 'right', fontSize: 7.0, ...bold, color: '#065F46' }}>
                {fmtPlain(ledgerTotals.paid)}
              </Text>
              <Text style={{ width: '9%', textAlign: 'right', fontSize: 7.0, ...bold, color: '#BE123C' }}>
                {fmtPlain(ledgerTotals.bal)}
              </Text>
              <View style={{ width: '9%', alignItems: 'center' }}>
                <View style={{ backgroundColor: '#0F172A', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 5.7, ...bold, color: '#FFFFFF' }}>{t.reconciledBadge}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Official Period Minutes & Bidding Log */}
        <View wrap={false} style={{ marginBottom: 9 }}>
          {visibleBids.length > 0 && (
            <View style={styles.tableCard}>
              <View style={styles.darkCardBar}>
                <Text style={styles.darkCardBarTitle}>
                  {t.periodWord} {data.auction.periodNumber} {t.biddingLogTitle} ({data.bids.length})
                </Text>
              </View>
              <View style={styles.miniHeaderLight}>
                <Text style={[styles.miniThLight, { width: '12%' }]}>{t.ticketCol}</Text>
                <Text style={[styles.miniThLight, { width: '34%' }]}>{t.memberCol}</Text>
                <Text style={[styles.miniThLight, { width: '20%', textAlign: 'right' }]}>{t.prizeCol}</Text>
                <Text style={[styles.miniThLight, { width: '18%', textAlign: 'right' }]}>{t.discountCol}</Text>
                <Text style={[styles.miniThLight, { width: '16%', textAlign: 'right' }]}>{t.sourceCol}</Text>
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
                  <Text style={[styles.miniTd, { width: '12%', ...bold }]}>#{b.ticketNo}</Text>
                  <Text style={[styles.miniTd, { width: '34%' }]}>{b.memberName}</Text>
                  <Text style={[styles.miniTd, { width: '20%', textAlign: 'right', ...bold }]}>{fmt(b.prizeAmount)}</Text>
                  <Text style={[styles.miniTd, { width: '18%', textAlign: 'right' }]}>{fmt(b.bidDiscount)}</Text>
                  <Text style={[styles.miniTd, { width: '16%', textAlign: 'right', color: '#475569' }]}>
                    {localizeBidSource(b.source, t)}
                  </Text>
                </View>
              ))}
              {hiddenBidCount > 0 && (
                <Text style={{ fontSize: 6.5, color: '#64748B', paddingHorizontal: 6, paddingVertical: 3 }}>
                  {t.additionalBidsNote(hiddenBidCount)}
                </Text>
              )}
            </View>
          )}

          <View style={styles.minutesBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <View style={styles.secDotIndigo} />
              <Text style={{ ...bold, fontSize: 7.4, color: '#0F172A' }}>{t.officialMinutesTitle}</Text>
            </View>
            <Text style={{ fontSize: 7.1, color: '#334155', lineHeight: 1.38 }}>{data.auction.minutesText}</Text>
          </View>
        </View>

        {/* SECTION 6: Sign-Off & Verification Endorsements (3-Card Signature Grid) */}
        <View wrap={false}>
          <View style={styles.secHeadRow}>
            <View style={styles.secHeadLeft}>
              <View style={styles.secDotIndigo} />
              <Text style={styles.secHeadTitle}>{t.section6SignoffTitle}</Text>
            </View>
            <Text style={styles.secHeadRight}>{groupRef} · {t.periodWord} {data.auction.periodNumber}</Text>
          </View>

          <View style={styles.signGrid}>
            <View style={styles.signCard}>
              <View>
                <Text style={{ ...bold, fontSize: 6.8, color: '#312E81' }}>{t.foremanSignoffTitle}</Text>
                <Text style={{ fontSize: 6.3, color: '#64748B', marginTop: 2 }}>{data.branchName}</Text>
              </View>
              <View style={{ borderTopWidth: 0.6, borderTopColor: '#CBD5E1', borderTopStyle: 'solid', paddingTop: 3 }}>
                <Text style={{ ...bold, fontSize: 7.4, color: '#0F172A' }}>{data.tenantName}</Text>
                <Text style={{ fontSize: 6.0, color: '#64748B' }}>{t.foremanSignLine} | {fmtDate(data.generatedAt)}</Text>
              </View>
            </View>

            <View style={styles.signCard}>
              <View>
                <Text style={{ ...bold, fontSize: 6.8, color: '#0F172A' }}>{t.winnerSignoffTitle}</Text>
                <Text style={{ fontSize: 6.3, color: '#64748B', marginTop: 2 }}>
                  {fmt(s.netPayableAfterWinnerInstallment)} ({t.netPayableWinnerHand})
                </Text>
              </View>
              <View style={{ borderTopWidth: 0.6, borderTopColor: '#CBD5E1', borderTopStyle: 'solid', paddingTop: 3 }}>
                <Text style={{ ...bold, fontSize: 7.4, color: '#0F172A' }}>{data.auction.winnerName || t.winnerPending}</Text>
                <Text style={{ fontSize: 6.0, color: '#64748B' }}>{t.winnerAckLine} | {fmtDate(data.auction.auctionDate)}</Text>
              </View>
            </View>

            <View style={styles.signCard}>
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ ...bold, fontSize: 6.8, color: '#065F46' }}>{t.auditorSignoffTitle}</Text>
                  <View style={securityApproved ? styles.emeraldChip : styles.amberChip}>
                    <Text style={securityApproved ? styles.emeraldChipText : styles.amberChipText}>
                      {localizeStatus(data.security?.status ?? 'pending', t)}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 6.3, color: '#64748B', marginTop: 2 }}>{t.auditorNoteLine}</Text>
              </View>
              <View style={{ borderTopWidth: 0.6, borderTopColor: '#CBD5E1', borderTopStyle: 'solid', paddingTop: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ ...bold, fontSize: 7.1, color: '#0F172A' }}>{localizeStatus(data.auction.status, t)}</Text>
                  <Text style={{ fontSize: 6.0, color: '#065F46' }}>{groupRef}-P{data.auction.periodNumber}</Text>
                </View>
                <View style={styles.sealCircle}>
                  <Text style={{ ...bold, fontSize: 5.8, color: '#312E81' }}>{t.sealWord}</Text>
                </View>
              </View>
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
