import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  DEFAULT_CHIT_PDF_THEME,
  type ChitPdfTheme,
  type ChitPeriodReportData,
} from './periodReport';
import { getPeriodReportCopy, type PeriodReportCopy } from './periodReportI18n';
import { ensurePdfFonts, getPdfFontFamily, resolvePdfLang } from '../reports/pdfFonts';

function localizeCommissionBasis(raw: string, t: PeriodReportCopy): string {
  const up = String(raw || '').toUpperCase();
  return t.commissionBasisLabels[up] ?? raw;
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

function createThemedPdfStyles(
  fontFamily: any,
  hasUnicode: boolean,
  compact: boolean,
  theme: ChitPdfTheme,
) {
  const bold = hasUnicode ? { fontFamily, fontWeight: 'bold' as const } : { fontFamily: 'Helvetica-Bold' as const };
  const padRow = compact ? 4.4 : 5.2;
  const miniPad = compact ? 3.2 : 3.8;

  return {
    bold,
    styles: StyleSheet.create({
      page: {
        fontFamily,
        fontSize: compact ? 8.2 : 8.6,
        paddingTop: 18,
        paddingHorizontal: 22,
        paddingBottom: 38,
        backgroundColor: '#FFFFFF',
        color: '#1E293B',
        lineHeight: 1.3,
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
        borderBottomWidth: 1.2,
        borderBottomColor: theme.primary,
        borderBottomStyle: 'solid',
        paddingVertical: 8,
        paddingHorizontal: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      },
      brandLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        flex: 1.15,
      },
      logoBox: {
        width: 34,
        height: 34,
        borderRadius: 6,
        borderWidth: 0.7,
        borderColor: '#E2E8F0',
        borderStyle: 'solid',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 2,
      },
      logoImg: {
        width: 30,
        height: 30,
        objectFit: 'contain',
      },
      monogram: {
        width: 34,
        height: 34,
        borderRadius: 6,
        backgroundColor: theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
      },
      monogramText: {
        ...bold,
        fontSize: 15,
        color: '#FFFFFF',
      },
      companyNameWrap: {
        marginBottom: 1.5,
      },
      brandTitle: {
        ...bold,
        fontSize: 12.6,
        color: '#0F172A',
      },
      branchSub: {
        ...bold,
        fontSize: 8.2,
        color: theme.primaryDark,
      },
      engineSub: {
        fontSize: 7.1,
        color: '#64748B',
        marginTop: 1,
      },
      contactColRight: {
        flex: 0.85,
        alignItems: 'flex-end',
        justifyContent: 'center',
      },
      contactLine: {
        fontSize: 7.4,
        color: '#475569',
        textAlign: 'right',
        lineHeight: 1.35,
      },
      contactBold: {
        ...bold,
        fontSize: 7.8,
        color: '#0F172A',
        textAlign: 'right',
        marginBottom: 1.5,
      },
      execBottomBand: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      },
      kickerLabel: {
        ...bold,
        fontSize: 7.2,
        color: theme.primaryDark,
        marginBottom: 1.5,
      },
      reportTitle: {
        ...bold,
        fontSize: 17.5,
        lineHeight: 1.25,
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 3,
      },
      reportSubTitle: {
        fontSize: 9.2,
        lineHeight: 1.3,
        color: '#475569',
        textAlign: 'center',
        marginBottom: 6,
      },
      metaStripRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 2,
      },
      metaStripItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
      },
      metaStripSep: {
        width: 1,
        height: 12,
        backgroundColor: '#CBD5E1',
      },
      metaStripLbl: {
        fontSize: 9.5,
        color: '#64748B',
      },
      metaStripVal: {
        ...bold,
        fontSize: 10.2,
        color: '#0F172A',
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
      metaBoxThemed: {
        backgroundColor: theme.primaryLight,
        borderWidth: 0.7,
        borderColor: theme.primary,
        borderStyle: 'solid',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 7,
        minWidth: 58,
      },
      metaBoxLbl: {
        fontSize: 6.2,
        color: '#64748B',
      },
      metaBoxVal: {
        ...bold,
        fontSize: 7.5,
        color: '#0F172A',
        marginTop: 1,
      },

      // 2. Redesigned Winner Highlight Banner (no front number square, theme colored)
      winnerBanner: {
        backgroundColor: theme.primaryLight,
        borderWidth: 0.9,
        borderColor: theme.primary,
        borderStyle: 'solid',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 11,
        marginBottom: 9,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      },
      winnerLeft: {
        flex: 1,
      },
      prizedPill: {
        backgroundColor: theme.primaryDark,
        borderRadius: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
      },
      prizedPillTxt: {
        ...bold,
        fontSize: 6.6,
        color: '#FFFFFF',
      },
      ticketTagPill: {
        backgroundColor: '#FFFFFF',
        borderWidth: 0.6,
        borderColor: theme.primary,
        borderStyle: 'solid',
        borderRadius: 3,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
      },
      winnerNameBig: {
        ...bold,
        fontSize: 12.2,
        color: '#0F172A',
        marginTop: 3,
      },
      winnerMetaSub: {
        fontSize: 7.5,
        color: '#475569',
        marginTop: 1.5,
      },
      winnerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      grossPillBox: {
        backgroundColor: '#FFFFFF',
        borderWidth: 0.6,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        paddingVertical: 5,
        paddingHorizontal: 9,
        alignItems: 'flex-end',
      },
      netHandPill: {
        backgroundColor: theme.primaryDark,
        borderRadius: 5,
        paddingVertical: 5.5,
        paddingHorizontal: 10,
        alignItems: 'flex-end',
      },
      netHandLbl: {
        ...bold,
        fontSize: 6.5,
        color: theme.primaryLight,
      },
      netHandVal: {
        ...bold,
        fontSize: 11.2,
        color: '#FFFFFF',
        marginTop: 1,
      },

      // Section Heading
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
      secDotTheme: {
        width: 5,
        height: 11,
        borderRadius: 1.5,
        backgroundColor: theme.primary,
      },
      secHeadTitle: {
        ...bold,
        fontSize: 8.4,
        color: '#0F172A',
      },
      secHeadRight: {
        fontSize: 7.2,
        color: '#475569',
      },

      // Section 1 Table (Distinct Theme-Dark Header + Column Separation Borders + Bigger Fonts)
      tableCard: {
        borderWidth: 0.9,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 9,
        backgroundColor: '#FFFFFF',
      },
      tableHeadThemed: {
        flexDirection: 'row',
        backgroundColor: theme.primaryDark,
        alignItems: 'stretch',
      },
      thCell: {
        paddingVertical: 5.5,
        paddingHorizontal: 7,
        justifyContent: 'center',
      },
      thText: {
        ...bold,
        fontSize: 8.4,
        color: '#FFFFFF',
      },
      thDivider: {
        borderRightWidth: 0.6,
        borderRightColor: 'rgba(255, 255, 255, 0.28)',
        borderRightStyle: 'solid',
      },
      trSplit: {
        flexDirection: 'row',
        borderBottomWidth: 0.6,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        alignItems: 'stretch',
        backgroundColor: '#FFFFFF',
      },
      trSplitAlt: {
        flexDirection: 'row',
        borderBottomWidth: 0.6,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        alignItems: 'stretch',
        backgroundColor: '#F8FAFC',
      },
      tdCell: {
        paddingVertical: padRow,
        paddingHorizontal: 7,
        justifyContent: 'center',
      },
      tdColSep: {
        borderRightWidth: 0.6,
        borderRightColor: '#CBD5E1',
        borderRightStyle: 'solid',
      },
      rowMainTxt: {
        ...bold,
        fontSize: 8.8,
        color: '#0F172A',
      },
      rowAmtTxt: {
        ...bold,
        fontSize: 9.2,
        color: '#0F172A',
        textAlign: 'right',
      },
      trSubNote: {
        fontSize: 7.2,
        color: '#475569',
        marginTop: 1.5,
      },
      trNetThemed: {
        flexDirection: 'row',
        backgroundColor: theme.primaryLight,
        borderTopWidth: 1.0,
        borderTopColor: theme.primary,
        borderTopStyle: 'solid',
        borderBottomWidth: 1.0,
        borderBottomColor: theme.primary,
        borderBottomStyle: 'solid',
        alignItems: 'stretch',
      },
      sectionSubBanner: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderBottomWidth: 0.6,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        paddingVertical: 4,
        paddingHorizontal: 8,
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      sectionSubBannerTxt: {
        ...bold,
        fontSize: 8.0,
        color: theme.primaryDark,
      },

      // Section 3 & 4 Split Cards
      splitGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 9,
      },
      splitColDividerCard: {
        flex: 1,
        borderWidth: 0.9,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      },
      themeCardBar: {
        backgroundColor: theme.primaryDark,
        paddingVertical: 5,
        paddingHorizontal: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      themeCardBarTitle: {
        ...bold,
        fontSize: 8.2,
        color: '#FFFFFF',
      },
      themeCardBarRight: {
        ...bold,
        fontSize: 7.2,
        color: theme.primaryLight,
      },
      cardBody: {
        paddingVertical: 6,
        paddingHorizontal: 8,
      },
      kvHairlineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E2E8F0',
        borderBottomStyle: 'solid',
        paddingVertical: 3.4,
        gap: 6,
      },
      kvLbl: {
        fontSize: 7.5,
        color: '#475569',
      },
      kvVal: {
        ...bold,
        fontSize: 7.7,
        color: '#0F172A',
        textAlign: 'right',
      },
      cardFooterTheme: {
        backgroundColor: theme.primaryLight,
        borderTopWidth: 0.6,
        borderTopColor: theme.primary,
        borderTopStyle: 'solid',
        paddingVertical: 5,
        paddingHorizontal: 8,
      },

      // Ledger Table
      miniHeaderThemed: {
        flexDirection: 'row',
        backgroundColor: theme.primaryDark,
        alignItems: 'stretch',
      },
      miniThCell: {
        paddingVertical: 4.5,
        paddingHorizontal: 4.5,
        justifyContent: 'center',
      },
      miniThText: {
        ...bold,
        fontSize: 7.1,
        color: '#FFFFFF',
      },
      miniTr: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#CBD5E1',
        borderBottomStyle: 'solid',
        alignItems: 'stretch',
      },
      miniTdCell: {
        paddingVertical: miniPad,
        paddingHorizontal: 4.5,
        justifyContent: 'center',
      },
      miniTd: {
        fontSize: compact ? 7.2 : 7.5,
        color: '#1E293B',
      },
      totalsRow: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderTopWidth: 0.9,
        borderTopColor: '#94A3B8',
        borderTopStyle: 'solid',
        alignItems: 'stretch',
      },

      // Badges
      badgeNeutral: {
        backgroundColor: '#F1F5F9',
        borderWidth: 0.5,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1.2,
      },
      badgeThemeSolid: {
        backgroundColor: theme.primaryDark,
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1.2,
      },
      badgeThemeTint: {
        backgroundColor: theme.primaryLight,
        borderWidth: 0.6,
        borderColor: theme.primary,
        borderStyle: 'solid',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2.2,
      },
      badgeAmberOutline: {
        backgroundColor: '#FFFBEB',
        borderWidth: 0.5,
        borderColor: '#FCD34D',
        borderStyle: 'solid',
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1.2,
      },

      // Minutes & Sign-Off
      minutesBox: {
        borderWidth: 0.8,
        borderColor: '#CBD5E1',
        borderStyle: 'solid',
        borderRadius: 5,
        backgroundColor: '#F8FAFC',
        padding: 8,
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
        padding: 8,
        minHeight: 70,
        justifyContent: 'space-between',
      },
      sealCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 0.8,
        borderColor: theme.primary,
        borderStyle: 'dashed',
        backgroundColor: theme.primaryLight,
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
        fontSize: 6.9,
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
  const theme = data.theme ?? DEFAULT_CHIT_PDF_THEME;

  const compact = data.memberRows.length >= 10 || data.bids.length > 4 || data.multiDivisionWinners.length > 1;
  const { styles, bold } = createThemedPdfStyles(getPdfFontFamily(resolvedLang), hasUnicode, compact, theme);

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
  const denomInlineText =
    activeDenoms.length > 0
      ? activeDenoms.map((d) => `${sym}${d.denomination} × ${d.count} (${fmt(d.amount)})`).join('  ·  ')
      : t.digitalNil;
  const visibleBids = data.bids.slice(0, 8);
  const hiddenBidCount = Math.max(0, data.bids.length - visibleBids.length);
  const pendingBalance = Number(data.payouts.remainingPayoutBalance ?? 0);
  const arrearsOffsetTotal =
    Number(data.payouts.arrearsDeductedAmount ?? 0) + Number(data.payouts.penaltyDeductedAmount ?? 0);
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
        {/* 1. Unified Executive Header Card: Left = Logo + Company Name (with divider) + Branch Name; Right = Address & Contact */}
        <View style={styles.execHeaderCard} wrap={false}>
          <View style={styles.execTopBand}>
            <View style={styles.brandLeft}>
              {data.logoDataUri ? (
                <View style={styles.logoBox}>
                  <Image src={data.logoDataUri} style={styles.logoImg} />
                </View>
              ) : (
                <View style={styles.monogram}>
                  <Text style={styles.monogramText}>{tenantInitial}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.companyNameWrap}>
                  <Text style={styles.brandTitle}>{data.tenantName}</Text>
                </View>
                <Text style={styles.branchSub}>{data.branchName}</Text>
                <Text style={styles.engineSub}>
                  {engineTitle} · {localizeFrequency(data.group.frequency, t)}
                </Text>
              </View>
            </View>

            <View style={styles.contactColRight}>
              <Text style={styles.contactBold}>{data.branchName}</Text>
              {data.companyAddress ? <Text style={styles.contactLine}>{data.companyAddress}</Text> : null}
              {data.companyPhone ? <Text style={styles.contactLine}>{data.companyPhone}</Text> : null}
              {data.companyEmail ? <Text style={styles.contactLine}>{data.companyEmail}</Text> : null}
              <Text style={styles.contactLine}>
                {t.generatedWord}: {fmtDate(data.generatedAt)}
              </Text>
            </View>
          </View>

          <View style={styles.execBottomBand}>
            <Text style={styles.reportTitle}>{data.group.name}</Text>
            <Text style={styles.reportSubTitle}>
              {data.templateSectionTitle} ({fmt(s.chitValue)})
            </Text>
            <View style={styles.metaStripRow}>
              <View style={styles.metaStripItem}>
                <Text style={styles.metaStripLbl}>{t.groupWord}: </Text>
                <Text style={styles.metaStripVal}>{groupRef}</Text>
              </View>
              <View style={styles.metaStripSep} />
              <View style={styles.metaStripItem}>
                <Text style={styles.metaStripLbl}>{t.periodWord}: </Text>
                <Text style={[styles.metaStripVal, { color: theme.primaryDark }]}>
                  {data.auction.periodNumber} {t.ofWord} {data.group.totalMembers}
                </Text>
              </View>
              <View style={styles.metaStripSep} />
              <View style={styles.metaStripItem}>
                <Text style={styles.metaStripLbl}>{t.commencedWord}: </Text>
                <Text style={styles.metaStripVal}>
                  {fmtDate(data.group.startDate || data.auction.auctionDate)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Redesigned Winner Highlight Banner (no front number square, theme colored) */}
        <View style={styles.winnerBanner} wrap={false}>
          <View style={styles.winnerLeft}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.prizedPill}>
                <Text style={styles.prizedPillTxt}>{t.prizedBeneficiary}</Text>
              </View>
              {data.auction.winnerTicketNo ? (
                <View style={styles.ticketTagPill}>
                  <Text style={{ fontSize: 7.0, ...bold, color: theme.primaryDark }}>
                    {t.ticketCol} #{data.auction.winnerTicketNo}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.winnerNameBig}>{data.auction.winnerName || t.winnerPending}</Text>
            <Text style={styles.winnerMetaSub}>
              {t.discountCol}: {fmt(s.bidDiscount)} ({discountPct}%) ·{' '}
              {data.security ? localizeSecurityType(data.security.typeCode, data.security.typeLabel, t) : t.pendingAssignment}
            </Text>
          </View>

          <View style={styles.winnerRight}>
            <View style={styles.grossPillBox}>
              <Text style={{ fontSize: 6.7, color: '#475569' }}>{t.grossPrizeLabel}</Text>
              <Text style={{ ...bold, fontSize: 10.2, color: '#0F172A', marginTop: 1 }}>{fmt(s.prizePayoutTotal)}</Text>
            </View>
            <View style={styles.netHandPill}>
              <Text style={styles.netHandLbl}>{t.netPayableWinnerHand}</Text>
              <Text style={styles.netHandVal}>{fmt(s.netPayableAfterWinnerInstallment)}</Text>
            </View>
          </View>
        </View>

        {/* SECTION 1: Unified Prize Settlement, Arrears Offset (FIFO), Payout & Cash Denomination Table */}
        <View wrap={false}>
          <View style={styles.secHeadRow}>
            <View style={styles.secHeadLeft}>
              <View style={styles.secDotTheme} />
              <Text style={styles.secHeadTitle}>{t.section1Title}</Text>
            </View>
            <Text style={styles.secHeadRight}>
              {data.group.totalMembers} {t.membersWord} · {t.commWord} {data.group.commissionPct}% (
              {localizeCommissionBasis(data.group.commissionBasis, t)})
            </Text>
          </View>

          <View style={styles.tableCard}>
            {/* Distinct Theme-Dark Header Bar with Column Separators */}
            <View style={styles.tableHeadThemed}>
              <View style={[styles.thCell, styles.thDivider, { width: C.sl, alignItems: 'center' }]}>
                <Text style={styles.thText}>{t.slNo}</Text>
              </View>
              <View style={[styles.thCell, styles.thDivider, { width: C.desc }]}>
                <Text style={styles.thText}>
                  {t.description} — {winnerTitle}
                </Text>
              </View>
              <View style={[styles.thCell, { width: C.amt, alignItems: 'flex-end' }]}>
                <Text style={styles.thText}>
                  {t.amountCol} ({sym})
                </Text>
              </View>
            </View>

            {/* Row 1 */}
            <View style={styles.trSplit}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.6, color: '#64748B', ...bold }}>1</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                <Text style={styles.rowMainTxt}>
                  {t.totalChitValue} ({t.grossPool} = {data.group.totalMembers} × {fmt(s.baseInstallment)})
                </Text>
              </View>
              <View style={[styles.tdCell, { width: C.amt }]}>
                <Text style={styles.rowAmtTxt}>{fmt(s.chitValue)}</Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.trSplitAlt}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.6, color: '#64748B', ...bold }}>2</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                <Text style={styles.rowMainTxt}>{s.row2Title}</Text>
                <Text style={styles.trSubNote}>{s.row2Note}</Text>
              </View>
              <View style={[styles.tdCell, { width: C.amt }]}>
                <Text style={styles.rowAmtTxt}>{fmt(s.bidDiscount)}</Text>
              </View>
            </View>

            {/* Row 3 */}
            <View style={styles.trSplit}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.6, color: '#64748B', ...bold }}>3</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                <Text style={styles.rowMainTxt}>{s.row3Title}</Text>
                <Text style={styles.trSubNote}>
                  {t.foremanFeePerTicket}: {fmt(s.foremanFeePerTicket)}
                  {s.gstAmount > 0 ? ` · ${t.gstLabel}: ${fmt(s.gstAmount)}` : ''}
                  {s.roundingIncome > 0 ? ` · ${t.roundingLabel}: ${fmt(s.roundingIncome)}` : ''}
                </Text>
              </View>
              <View style={[styles.tdCell, { width: C.amt }]}>
                <Text style={styles.rowAmtTxt}>{fmt(s.commission)}</Text>
              </View>
            </View>

            {/* Row 4 */}
            <View style={styles.trSplitAlt}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.6, color: '#64748B', ...bold }}>4</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                <Text style={styles.rowMainTxt}>{s.row4Title}</Text>
                <Text style={styles.trSubNote}>{s.row4Note}</Text>
              </View>
              <View style={[styles.tdCell, { width: C.amt }]}>
                <Text style={[styles.rowAmtTxt, { color: theme.primaryDark }]}>
                  {s.dividendPerTicket > 0
                    ? fmt(s.dividendPerTicket)
                    : s.deferredDividendTotal > 0
                      ? fmt(s.deferredDividendTotal)
                      : fmt(0)}
                </Text>
              </View>
            </View>

            {/* Row 5 */}
            <View style={styles.trSplit}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.6, color: '#64748B', ...bold }}>5</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                <Text style={styles.rowMainTxt}>{s.row5Title}</Text>
                <Text style={styles.trSubNote}>
                  {Math.abs(s.prizedMemberInstallment - s.netMemberInstallment) > 0.01
                    ? `${t.nonPrizedLabel}: ${fmt(s.netMemberInstallment)} · ${t.prizedLabel}: ${fmt(s.prizedMemberInstallment)} · `
                    : `${t.baseDueWord} ${fmt(s.baseInstallment)} - ${t.dividendCol} ${fmt(s.dividendPerTicket)} · `}
                  {s.verificationFormulaLine}
                </Text>
              </View>
              <View style={[styles.tdCell, { width: C.amt }]}>
                <Text style={styles.rowAmtTxt}>
                  {Math.abs(s.prizedMemberInstallment - s.netMemberInstallment) > 0.01
                    ? `${fmt(s.netMemberInstallment)} / ${fmt(s.prizedMemberInstallment)}`
                    : fmt(s.netMemberInstallment)}
                </Text>
              </View>
            </View>

            {/* Row 6 */}
            <View style={[styles.trSplitAlt, { borderBottomWidth: 0 }]}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.6, color: '#64748B', ...bold }}>6</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                <Text style={styles.rowMainTxt}>
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
              <View style={[styles.tdCell, { width: C.amt }]}>
                <Text style={styles.rowAmtTxt}>{fmt(s.winnerPeriodInstallmentUnpaid)}</Text>
              </View>
            </View>

            {/* Highlighted Theme NET Row */}
            <View style={styles.trNetThemed}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center', borderRightColor: theme.primary }]}>
                <Text style={{ ...bold, fontSize: 8.8, color: theme.primaryDark }}>NET</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc, borderRightColor: theme.primary }]}>
                <Text style={{ ...bold, fontSize: 9.6, color: theme.primaryDark }}>{t.netPayableWinnerHand}</Text>
                <Text style={{ fontSize: 7.2, color: theme.primaryDark, marginTop: 1 }}>
                  {t.prizePayoutMinusWinnerInst} ({fmt(s.prizePayoutTotal)} - {fmt(s.winnerPeriodInstallmentUnpaid)})
                </Text>
              </View>
              <View style={[styles.tdCell, { width: C.amt }]}>
                <Text style={{ ...bold, fontSize: 10.6, color: theme.primaryDark, textAlign: 'right' }}>
                  {fmt(s.netPayableAfterWinnerInstallment)}
                </Text>
              </View>
            </View>

            {/* Integrated Payout, Arrears (FIFO) & Cash Denominations Sub-Section */}
            <View style={styles.sectionSubBanner}>
              <Text style={styles.sectionSubBannerTxt}>{t.payoutModeBanner}</Text>
              <Text style={{ fontSize: 7.2, ...bold, color: payoutPaid ? theme.primaryDark : '#92400E' }}>
                {localizeStatus(data.auction.payoutStatus, t)}
              </Text>
            </View>

            {data.payouts.rows.map((row, idx) => (
              <View key={row.slNo} style={idx % 2 === 1 ? styles.trSplitAlt : styles.trSplit}>
                <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                  <Text style={{ fontSize: 8.3, color: '#64748B', ...bold }}>{row.slNo}</Text>
                </View>
                <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                  <Text style={{ fontSize: 8.4, color: '#0F172A', ...bold }}>{row.description}</Text>
                  <Text style={styles.trSubNote}>{row.modeOrRef}</Text>
                </View>
                <View style={[styles.tdCell, { width: C.amt }]}>
                  <Text style={styles.rowAmtTxt}>{fmt(row.amount)}</Text>
                </View>
              </View>
            ))}

            {data.payouts.rows.length === 0 && (
              <View style={styles.trSplit}>
                <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                  <Text style={{ fontSize: 8.3, color: '#64748B', ...bold }}>1</Text>
                </View>
                <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                  <Text style={{ fontSize: 8.4, color: '#475569' }}>
                    {t.noPayoutPosted} ({t.payoutWord}: {localizeStatus(data.auction.payoutStatus, t)})
                  </Text>
                </View>
                <View style={[styles.tdCell, { width: C.amt }]}>
                  <Text style={styles.rowAmtTxt}>{fmt(0)}</Text>
                </View>
              </View>
            )}

            {/* Integrated Winner Unpaid Arrears & Penalty Offset (FIFO) */}
            <View style={[styles.trSplit, arrearsOffsetTotal > 0 ? { backgroundColor: '#FFFBEB' } : {}]}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.0, ...bold, color: arrearsOffsetTotal > 0 ? '#B45309' : '#64748B' }}>FIFO</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                <Text style={styles.rowMainTxt}>{t.arrearsOffsetTitle}</Text>
                <Text style={styles.trSubNote}>
                  {t.arrearsOffsetNote(
                    fmt(data.payouts.arrearsDeductedAmount),
                    fmt(data.payouts.penaltyDeductedAmount),
                  )}
                </Text>
              </View>
              <View style={[styles.tdCell, { width: C.amt }]}>
                <Text style={[styles.rowAmtTxt, { color: arrearsOffsetTotal > 0 ? '#B45309' : '#475569' }]}>
                  {arrearsOffsetTotal > 0 ? `- ${fmt(arrearsOffsetTotal)}` : fmt(0)}
                </Text>
              </View>
            </View>

            {/* BAL 3-Column Summary with Crisp Vertical Dividers */}
            <View style={[styles.trSplit, { backgroundColor: '#F8FAFC' }]}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.2, ...bold, color: '#0F172A' }}>BAL</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: '33.5%' }]}>
                <Text style={{ fontSize: 6.9, color: '#64748B' }}>
                  {arrearsOffsetTotal > 0 ? t.netTargetAfterArrears : t.targetGrossPayout}
                </Text>
                <Text style={{ ...bold, fontSize: 9.0, color: '#0F172A', marginTop: 1 }}>
                  {fmt(data.payouts.netPayableAmount ?? s.prizePayoutTotal)}
                </Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: '33.5%' }]}>
                <Text style={{ fontSize: 6.9, color: '#64748B' }}>{t.paidDisbursed}</Text>
                <Text style={{ ...bold, fontSize: 9.0, color: theme.primaryDark, marginTop: 1 }}>
                  {fmt(data.payouts.totalDisbursedToWinner)}
                </Text>
              </View>
              <View
                style={[
                  styles.tdCell,
                  {
                    width: C.amt,
                    backgroundColor: pendingBalance > 0 ? '#FEF9C3' : theme.primaryLight,
                  },
                ]}
              >
                <Text style={{ fontSize: 6.9, color: '#0F172A', textAlign: 'right' }}>{t.balancePending}</Text>
                <Text
                  style={{
                    ...bold,
                    fontSize: 9.2,
                    textAlign: 'right',
                    marginTop: 1,
                    color: pendingBalance > 0 ? '#92400E' : theme.primaryDark,
                  }}
                >
                  {fmt(pendingBalance)}
                </Text>
              </View>
            </View>

            {/* Cash Note Denominations Brought Directly Inside Section 1 Table */}
            {activeDenoms.map((d, idx) => (
              <View key={d.denomination} style={idx % 2 === 1 ? styles.trSplitAlt : styles.trSplit}>
                <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                  <Text style={{ fontSize: 8.2, ...bold, color: '#475569' }}>{d.denomination}</Text>
                </View>
                <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                  <Text style={{ fontSize: 8.1, color: '#1E293B' }}>
                    {t.cashNoteCount}: {d.count} {t.notesWord} × {fmt(d.denomination)}
                  </Text>
                </View>
                <View style={[styles.tdCell, { width: C.amt }]}>
                  <Text style={styles.rowAmtTxt}>{fmt(d.amount)}</Text>
                </View>
              </View>
            ))}

            <View style={[styles.trSplit, { borderBottomWidth: 0, backgroundColor: '#F8FAFC' }]}>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.sl, alignItems: 'center' }]}>
                <Text style={{ fontSize: 8.1, ...bold, color: theme.primaryDark }}>CASH</Text>
              </View>
              <View style={[styles.tdCell, styles.tdColSep, { width: C.desc }]}>
                <Text style={{ fontSize: 7.7, color: '#475569' }}>
                  {t.totalCashDenomPayout}:{' '}
                  <Text style={{ ...bold, color: '#0F172A' }}>{denomInlineText}</Text>
                </Text>
              </View>
              <View style={[styles.tdCell, { width: C.amt, backgroundColor: theme.primaryLight }]}>
                <Text style={{ ...bold, fontSize: 9.4, textAlign: 'right', color: theme.primaryDark }}>
                  {fmt(data.denominationCashTotal)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Template Mechanics (non-standard schemes only) */}
        {(data.basePlusPremium || data.gold || data.commodity || data.asca || data.formulaLines.length > 0) && (
          <View style={styles.tableCard} wrap={false}>
            <View style={styles.themeCardBar}>
              <Text style={styles.themeCardBarTitle}>
                {engineTitle} — {t.templateMechanicsTitle}
              </Text>
            </View>
            <View style={styles.cardBody}>
              {data.basePlusPremium && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>
                    {t.nonPrizedLabel} {fmt(data.basePlusPremium.nonPrizedInstalment)} / {t.prizedLabel}{' '}
                    {fmt(data.basePlusPremium.prizedInstalment)}
                  </Text>
                  <Text style={styles.kvVal}>
                    {fmt(data.basePlusPremium.collectedPool)} · {fmt(data.basePlusPremium.poolSurplus)}
                  </Text>
                </View>
              )}
              {data.gold && (
                <View style={styles.kvHairlineRow}>
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
                <Text style={{ fontSize: 7.2, color: '#475569', marginTop: 2 }}>
                  {data.formulaLines.join('  |  ')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Two-Column Pool Money Flow & Security Verification (Theme Dark Headers) */}
        <View style={styles.splitGrid} wrap={false}>
          {/* Left Card: Pool Money Flow & Collections */}
          <View style={styles.splitColDividerCard}>
            <View style={styles.themeCardBar}>
              <Text style={styles.themeCardBarTitle}>{t.poolMoneyFlowTitle}</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>{t.otherMembersExpected(s.otherMembersCount)}</Text>
                <Text style={styles.kvVal}>{fmt(s.otherMembersExpectedCollection)}</Text>
              </View>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>
                  {t.lessForemanComm}
                  {s.gstAmount > 0 ? ` + ${t.gstLabel}` : ''}
                </Text>
                <Text style={[styles.kvVal, { color: '#BE123C' }]}>-{fmt(s.commission + s.gstAmount)}</Text>
              </View>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>{t.netPoolForPayout}</Text>
                <Text style={styles.kvVal}>{fmt(s.netFundsAvailableForWinner)}</Text>
              </View>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>
                  {t.actualCollected(data.collections.paidCount, data.collections.unpaidCount)}
                </Text>
                <Text style={[styles.kvVal, { color: theme.primaryDark }]}>
                  {fmt(data.collections.totalCollected)}
                </Text>
              </View>
              <View style={[styles.kvHairlineRow, { borderBottomWidth: data.collections.byMode.length > 0 ? 0.5 : 0 }]}>
                <Text style={styles.kvLbl}>{t.pendingCollectionBal}</Text>
                <Text
                  style={[
                    styles.kvVal,
                    { color: data.collections.totalOutstanding > 0 ? '#B91C1C' : theme.primaryDark },
                  ]}
                >
                  {fmt(data.collections.totalOutstanding)}
                </Text>
              </View>
              {data.collections.byMode.map((mb, i) => (
                <View
                  key={mb.mode}
                  style={[
                    styles.kvHairlineRow,
                    { borderBottomWidth: i === data.collections.byMode.length - 1 ? 0 : 0.5 },
                  ]}
                >
                  <Text style={styles.kvLbl}>
                    · {mb.label} ({mb.count} {t.txnsWord})
                  </Text>
                  <Text style={styles.kvVal}>{fmt(mb.amount)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Right Card: Security & Attendance */}
          <View style={styles.splitColDividerCard}>
            <View style={styles.themeCardBar}>
              <Text style={styles.themeCardBarTitle}>{t.securityGateTitle}</Text>
              <Text style={styles.themeCardBarRight}>
                {localizeStatus(data.security?.status ?? 'pending', t)}
              </Text>
            </View>
            <View style={[styles.cardBody, { flex: 1 }]}>
              <View style={styles.kvHairlineRow}>
                <Text style={styles.kvLbl}>{t.collateralTypeLabel}</Text>
                <View style={styles.badgeNeutral}>
                  <Text style={{ fontSize: 7.1, ...bold, color: '#0F172A' }}>
                    {data.security
                      ? localizeSecurityType(data.security.typeCode, data.security.typeLabel, t)
                      : t.pendingAssignment}
                  </Text>
                </View>
              </View>
              {data.security?.value != null && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>{t.collateralValueLabel}</Text>
                  <Text style={[styles.kvVal, { color: theme.primaryDark }]}>{fmt(data.security.value)}</Text>
                </View>
              )}
              {data.security?.guarantorLabel && (
                <View style={styles.kvHairlineRow}>
                  <Text style={styles.kvLbl}>{t.guarantorWitnessLabel}</Text>
                  <Text style={styles.kvVal}>{data.security.guarantorLabel}</Text>
                </View>
              )}
              <View style={[styles.kvHairlineRow, { borderBottomWidth: data.security?.details ? 0.5 : 0 }]}>
                <Text style={styles.kvLbl}>{t.attendanceLabel}</Text>
                <Text style={styles.kvVal}>
                  {data.auction.presentCount} {t.presentWord} · {data.auction.proxyCount} {t.proxyWord} ·{' '}
                  {data.auction.absentCount} {t.absentWord}
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
              <View style={styles.cardFooterTheme}>
                {data.security && data.security.documents.length > 0 && (
                  <Text style={{ fontSize: 7.0, color: theme.primaryDark }}>
                    {t.docsLabel}:{' '}
                    {data.security.documents
                      .map((d) => `${localizeSecurityDocLabel(d, t)} (${localizeStatus(d.status, t)})`)
                      .join(' · ')}
                  </Text>
                )}
                {data.payouts.dividendReceiptNo && (
                  <Text style={{ fontSize: 7.0, ...bold, color: theme.primaryDark, marginTop: 1.5 }}>
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
            <View style={styles.themeCardBar}>
              <Text style={styles.themeCardBarTitle}>
                {t.periodWord} {data.auction.periodNumber} {t.multiDivTitle} ({data.multiDivisionWinners.length})
              </Text>
            </View>
            <View style={styles.miniHeaderThemed}>
              <View style={[styles.miniThCell, styles.thDivider, { width: '12%' }]}>
                <Text style={styles.miniThText}>{t.ticketCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '36%' }]}>
                <Text style={styles.miniThText}>{t.winnerNameCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '16%' }]}>
                <Text style={styles.miniThText}>{t.winTypeCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '18%', alignItems: 'flex-end' }]}>
                <Text style={styles.miniThText}>{t.prizeCol}</Text>
              </View>
              <View style={[styles.miniThCell, { width: '18%', alignItems: 'flex-end' }]}>
                <Text style={styles.miniThText}>{t.discountCol}</Text>
              </View>
            </View>
            {data.multiDivisionWinners.map((mw, idx) => (
              <View key={idx} style={[styles.miniTr, { backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }]} wrap={false}>
                <View style={[styles.miniTdCell, styles.tdColSep, { width: '12%' }]}>
                  <Text style={styles.miniTd}>#{mw.ticketNo ?? idx + 1}</Text>
                </View>
                <View style={[styles.miniTdCell, styles.tdColSep, { width: '36%' }]}>
                  <Text style={[styles.miniTd, bold]}>{mw.memberName}</Text>
                </View>
                <View style={[styles.miniTdCell, styles.tdColSep, { width: '16%' }]}>
                  <Text style={styles.miniTd}>{localizeStatus(mw.winType, t)}</Text>
                </View>
                <View style={[styles.miniTdCell, styles.tdColSep, { width: '18%' }]}>
                  <Text style={[styles.miniTd, bold, { textAlign: 'right' }]}>{fmt(mw.prizeAmount)}</Text>
                </View>
                <View style={[styles.miniTdCell, { width: '18%' }]}>
                  <Text style={[styles.miniTd, { textAlign: 'right' }]}>{fmt(mw.bidDiscount)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Member Subscription & Dividend Ledger (Intact Section + Vertical Dividers + Theme Colors) */}
        <View wrap={!keepLedgerWhole} style={{ marginBottom: 9 }}>
          <View style={styles.secHeadRow} minPresenceAhead={45}>
            <View style={styles.secHeadLeft}>
              <View style={styles.secDotTheme} />
              <Text style={styles.secHeadTitle}>
                {t.section5LedgerTitle} ({data.memberRows.length} {t.membersWord})
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              <View style={styles.badgeThemeTint}>
                <Text style={{ fontSize: 6.9, ...bold, color: theme.primaryDark }}>
                  {data.collections.paidCount} {localizeStatus('paid', t)}
                </Text>
              </View>
              <View style={styles.badgeAmberOutline}>
                <Text style={{ fontSize: 6.9, ...bold, color: '#92400E' }}>
                  {data.collections.unpaidCount} {localizeStatus('pending', t)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.tableCard, { marginBottom: 0 }]}>
            <View style={styles.miniHeaderThemed}>
              <View style={[styles.miniThCell, styles.thDivider, { width: '5%', alignItems: 'center' }]}>
                <Text style={styles.miniThText}>{t.siCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '7%' }]}>
                <Text style={styles.miniThText}>{t.ticketCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '21%' }]}>
                <Text style={styles.miniThText}>{t.memberCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '11%', alignItems: 'center' }]}>
                <Text style={styles.miniThText}>{t.roleCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '10%', alignItems: 'flex-end' }]}>
                <Text style={styles.miniThText}>{t.baseCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '10%', alignItems: 'flex-end' }]}>
                <Text style={styles.miniThText}>
                  {data.gold?.gramsPerFullTicket ? t.gramsCol : data.statement.deferredDividendTotal > 0 ? t.divDefCol : t.dividendCol}
                </Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '10%', alignItems: 'flex-end' }]}>
                <Text style={styles.miniThText}>{t.netDueCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '8%', alignItems: 'flex-end' }]}>
                <Text style={styles.miniThText}>{t.paidCol}</Text>
              </View>
              <View style={[styles.miniThCell, styles.thDivider, { width: '9%', alignItems: 'flex-end' }]}>
                <Text style={styles.miniThText}>{t.balCol}</Text>
              </View>
              <View style={[styles.miniThCell, { width: '9%', alignItems: 'center' }]}>
                <Text style={styles.miniThText}>{t.statusCol}</Text>
              </View>
            </View>

            {data.memberRows.map((m, idx) => {
              const isWinner = String(m.role).toLowerCase() === 'winner';
              const isPaid = String(m.status).toLowerCase() === 'paid';
              const rowBg = isWinner ? theme.primaryLight : idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
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
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '5%', alignItems: 'center' }]}>
                    <Text style={[styles.miniTd, { color: '#64748B' }]}>{idx + 1}</Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '7%' }]}>
                    <Text style={[styles.miniTd, bold, { color: isWinner ? theme.primaryDark : '#0F172A' }]}>
                      #{m.ticketNo}
                    </Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '21%' }]}>
                    <Text style={[styles.miniTd, isWinner ? bold : {}, { color: '#0F172A' }]}>
                      {m.memberName}
                    </Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '11%', alignItems: 'center' }]}>
                    <View style={isWinner ? styles.badgeThemeSolid : styles.badgeNeutral}>
                      <Text style={{ fontSize: 6.3, ...bold, color: isWinner ? '#FFFFFF' : '#475569' }}>
                        {localizeMemberRole(m.role, t)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '10%' }]}>
                    <Text style={[styles.miniTd, { textAlign: 'right' }]}>{fmtPlain(m.baseDue)}</Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '10%' }]}>
                    <Text style={[styles.miniTd, bold, { textAlign: 'right', color: theme.primaryDark }]}>
                      {data.gold?.gramsPerFullTicket
                        ? `${m.goldGramsCredited.toFixed(4)}g`
                        : m.deferredDividend > 0
                          ? `${fmtPlain(m.dividendEarned)}/${fmtPlain(m.deferredDividend)}`
                          : fmtPlain(m.dividendEarned)}
                    </Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '10%' }]}>
                    <Text style={[styles.miniTd, bold, { textAlign: 'right' }]}>{fmtPlain(m.netDue)}</Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '8%' }]}>
                    <Text
                      style={[
                        styles.miniTd,
                        isPaid ? bold : {},
                        { textAlign: 'right', color: isPaid ? theme.primaryDark : '#94A3B8' },
                      ]}
                    >
                      {fmtPlain(m.paidAmount)}
                    </Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '9%' }]}>
                    <Text
                      style={[
                        styles.miniTd,
                        bold,
                        { textAlign: 'right', color: m.outstanding > 0 ? '#BE123C' : theme.primaryDark },
                      ]}
                    >
                      {fmtPlain(m.outstanding)}
                    </Text>
                  </View>
                  <View style={[styles.miniTdCell, { width: '9%', alignItems: 'center' }]}>
                    <View style={isPaid ? styles.badgeThemeSolid : styles.badgeAmberOutline}>
                      <Text style={{ fontSize: 6.1, ...bold, color: isPaid ? '#FFFFFF' : '#92400E' }}>
                        {localizeMemberModeStatus(m.paymentMode, m.status, t)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Aggregate Totals Row */}
            <View style={styles.totalsRow} wrap={false}>
              <View style={[styles.miniTdCell, styles.tdColSep, { width: '44%' }]}>
                <Text style={{ fontSize: 7.3, ...bold, color: '#0F172A' }}>
                  {t.aggregateTotalsLabel} ({data.memberRows.length})
                </Text>
              </View>
              <View style={[styles.miniTdCell, styles.tdColSep, { width: '10%' }]}>
                <Text style={{ fontSize: 7.4, ...bold, color: '#0F172A', textAlign: 'right' }}>
                  {fmtPlain(ledgerTotals.baseDue)}
                </Text>
              </View>
              <View style={[styles.miniTdCell, styles.tdColSep, { width: '10%' }]}>
                <Text style={{ fontSize: 7.4, ...bold, color: theme.primaryDark, textAlign: 'right' }}>
                  {fmtPlain(ledgerTotals.dividend)}
                </Text>
              </View>
              <View style={[styles.miniTdCell, styles.tdColSep, { width: '10%' }]}>
                <Text style={{ fontSize: 7.4, ...bold, color: '#0F172A', textAlign: 'right' }}>
                  {fmtPlain(ledgerTotals.netDue)}
                </Text>
              </View>
              <View style={[styles.miniTdCell, styles.tdColSep, { width: '8%' }]}>
                <Text style={{ fontSize: 7.4, ...bold, color: theme.primaryDark, textAlign: 'right' }}>
                  {fmtPlain(ledgerTotals.paid)}
                </Text>
              </View>
              <View style={[styles.miniTdCell, styles.tdColSep, { width: '9%' }]}>
                <Text style={{ fontSize: 7.4, ...bold, color: '#BE123C', textAlign: 'right' }}>
                  {fmtPlain(ledgerTotals.bal)}
                </Text>
              </View>
              <View style={[styles.miniTdCell, { width: '9%', alignItems: 'center' }]}>
                <View style={{ backgroundColor: theme.primaryDark, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 5.9, ...bold, color: '#FFFFFF' }}>{t.reconciledBadge}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Official Period Minutes & Bidding Log */}
        <View wrap={false} style={{ marginBottom: 9 }}>
          {visibleBids.length > 0 && (
            <View style={styles.tableCard}>
              <View style={styles.themeCardBar}>
                <Text style={styles.themeCardBarTitle}>
                  {t.periodWord} {data.auction.periodNumber} {t.biddingLogTitle} ({data.bids.length})
                </Text>
              </View>
              <View style={[styles.miniHeaderThemed, { backgroundColor: '#F1F5F9', borderBottomWidth: 0.7, borderBottomColor: '#CBD5E1', borderBottomStyle: 'solid' }]}>
                <View style={[styles.miniThCell, styles.tdColSep, { width: '12%' }]}>
                  <Text style={[styles.miniThText, { color: '#0F172A' }]}>{t.ticketCol}</Text>
                </View>
                <View style={[styles.miniThCell, styles.tdColSep, { width: '34%' }]}>
                  <Text style={[styles.miniThText, { color: '#0F172A' }]}>{t.memberCol}</Text>
                </View>
                <View style={[styles.miniThCell, styles.tdColSep, { width: '20%', alignItems: 'flex-end' }]}>
                  <Text style={[styles.miniThText, { color: '#0F172A' }]}>{t.prizeCol}</Text>
                </View>
                <View style={[styles.miniThCell, styles.tdColSep, { width: '18%', alignItems: 'flex-end' }]}>
                  <Text style={[styles.miniThText, { color: '#0F172A' }]}>{t.discountCol}</Text>
                </View>
                <View style={[styles.miniThCell, { width: '16%', alignItems: 'flex-end' }]}>
                  <Text style={[styles.miniThText, { color: '#0F172A' }]}>{t.sourceCol}</Text>
                </View>
              </View>
              {visibleBids.map((b, i) => (
                <View
                  key={i}
                  style={[
                    styles.miniTr,
                    {
                      backgroundColor: b.status === 'winning' ? theme.primaryLight : i % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                      borderBottomWidth: i === visibleBids.length - 1 && hiddenBidCount === 0 ? 0 : 0.5,
                    },
                  ]}
                >
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '12%' }]}>
                    <Text style={[styles.miniTd, bold]}>#{b.ticketNo}</Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '34%' }]}>
                    <Text style={styles.miniTd}>{b.memberName}</Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '20%' }]}>
                    <Text style={[styles.miniTd, bold, { textAlign: 'right' }]}>{fmt(b.prizeAmount)}</Text>
                  </View>
                  <View style={[styles.miniTdCell, styles.tdColSep, { width: '18%' }]}>
                    <Text style={[styles.miniTd, { textAlign: 'right' }]}>{fmt(b.bidDiscount)}</Text>
                  </View>
                  <View style={[styles.miniTdCell, { width: '16%' }]}>
                    <Text style={[styles.miniTd, { textAlign: 'right', color: '#475569' }]}>
                      {localizeBidSource(b.source, t)}
                    </Text>
                  </View>
                </View>
              ))}
              {hiddenBidCount > 0 && (
                <Text style={{ fontSize: 6.9, color: '#64748B', paddingHorizontal: 7, paddingVertical: 3.5 }}>
                  {t.additionalBidsNote(hiddenBidCount)}
                </Text>
              )}
            </View>
          )}

          <View style={styles.minutesBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <View style={styles.secDotTheme} />
              <Text style={{ ...bold, fontSize: 8.0, color: '#0F172A' }}>{t.officialMinutesTitle}</Text>
            </View>
            <Text style={{ fontSize: 7.6, color: '#334155', lineHeight: 1.4 }}>{data.auction.minutesText}</Text>
          </View>
        </View>

        {/* Sign-Off & Verification Endorsements */}
        <View wrap={false}>
          <View style={styles.secHeadRow}>
            <View style={styles.secHeadLeft}>
              <View style={styles.secDotTheme} />
              <Text style={styles.secHeadTitle}>{t.section6SignoffTitle}</Text>
            </View>
            <Text style={styles.secHeadRight}>
              {groupRef} · {t.periodWord} {data.auction.periodNumber}
            </Text>
          </View>

          <View style={styles.signGrid}>
            <View style={styles.signCard}>
              <View>
                <Text style={{ ...bold, fontSize: 7.2, color: theme.primaryDark }}>{t.foremanSignoffTitle}</Text>
                <Text style={{ fontSize: 6.8, color: '#64748B', marginTop: 2 }}>{data.branchName}</Text>
              </View>
              <View style={{ borderTopWidth: 0.6, borderTopColor: '#CBD5E1', borderTopStyle: 'solid', paddingTop: 3.5 }}>
                <Text style={{ ...bold, fontSize: 8.0, color: '#0F172A' }}>{data.tenantName}</Text>
                <Text style={{ fontSize: 6.4, color: '#64748B' }}>
                  {t.foremanSignLine} | {fmtDate(data.generatedAt)}
                </Text>
              </View>
            </View>

            <View style={styles.signCard}>
              <View>
                <Text style={{ ...bold, fontSize: 7.2, color: '#0F172A' }}>{t.winnerSignoffTitle}</Text>
                <Text style={{ fontSize: 6.8, color: '#64748B', marginTop: 2 }}>
                  {fmt(s.netPayableAfterWinnerInstallment)} ({t.netPayableWinnerHand})
                </Text>
              </View>
              <View style={{ borderTopWidth: 0.6, borderTopColor: '#CBD5E1', borderTopStyle: 'solid', paddingTop: 3.5 }}>
                <Text style={{ ...bold, fontSize: 8.0, color: '#0F172A' }}>
                  {data.auction.winnerName || t.winnerPending}
                </Text>
                <Text style={{ fontSize: 6.4, color: '#64748B' }}>
                  {t.winnerAckLine} | {fmtDate(data.auction.auctionDate)}
                </Text>
              </View>
            </View>

            <View style={styles.signCard}>
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ ...bold, fontSize: 7.2, color: theme.primaryDark }}>{t.auditorSignoffTitle}</Text>
                  <View style={securityApproved ? styles.badgeThemeTint : styles.badgeAmberOutline}>
                    <Text style={{ fontSize: 6.3, ...bold, color: securityApproved ? theme.primaryDark : '#92400E' }}>
                      {localizeStatus(data.security?.status ?? 'pending', t)}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 6.8, color: '#64748B', marginTop: 2 }}>{t.auditorNoteLine}</Text>
              </View>
              <View
                style={{
                  borderTopWidth: 0.6,
                  borderTopColor: '#CBD5E1',
                  borderTopStyle: 'solid',
                  paddingTop: 3.5,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ ...bold, fontSize: 7.6, color: '#0F172A' }}>{localizeStatus(data.auction.status, t)}</Text>
                  <Text style={{ fontSize: 6.4, color: theme.primaryDark }}>
                    {groupRef}-P{data.auction.periodNumber}
                  </Text>
                </View>
                <View style={styles.sealCircle}>
                  <Text style={{ ...bold, fontSize: 6.1, color: theme.primaryDark }}>{t.sealWord}</Text>
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
