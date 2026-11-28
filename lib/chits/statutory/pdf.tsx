import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { ensurePdfFonts, getPdfBoldStyle, getPdfFontFamily, resolvePdfLang } from '@/lib/reports/pdfFonts';
import type { StatutoryRegisterDataset } from './builder';
import { getStatutoryPdfCopy } from './i18n';

export function StatutoryRegisterPDF({ data, lang }: { data: StatutoryRegisterDataset; lang?: string }) {
  ensurePdfFonts();
  const resolvedLang = resolvePdfLang(lang ?? data.lang);
  const copy = getStatutoryPdfCopy(resolvedLang);
  const fontFamily = getPdfFontFamily(resolvedLang);
  const bold = getPdfBoldStyle(resolvedLang);

  const styles = StyleSheet.create({
    page: {
      fontFamily,
      fontSize: 8.5,
      padding: 28,
      paddingBottom: 48,
      backgroundColor: '#FFFFFF',
      color: '#111827',
    },
    headerBox: {
      borderWidth: 1.5,
      borderColor: '#1E293B',
      padding: 10,
      backgroundColor: '#F8FAFC',
      marginBottom: 10,
    },
    formBadge: {
      fontSize: 8,
      ...bold,
      color: '#5A195B',
      marginBottom: 2,
    },
    title: {
      fontSize: 13,
      ...bold,
      color: '#0F172A',
    },
    subtitle: {
      fontSize: 8,
      color: '#475569',
      marginTop: 2,
    },
    metaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 10,
      borderWidth: 1,
      borderColor: '#CBD5E1',
      padding: 7,
      gap: 6,
    },
    metaCell: {
      width: '48%',
      fontSize: 7.8,
      color: '#334155',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#1E293B',
      color: '#FFFFFF',
      paddingVertical: 5,
      paddingHorizontal: 6,
      ...bold,
      fontSize: 7.5,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.7,
      borderBottomColor: '#CBD5E1',
      paddingVertical: 4.5,
      paddingHorizontal: 6,
      fontSize: 7.4,
    },
    totalsBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginTop: 10,
      padding: 8,
      backgroundColor: '#F1F5F9',
      borderWidth: 1,
      borderColor: '#CBD5E1',
    },
    sigRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 24,
      paddingTop: 10,
    },
    sigBox: {
      width: '30%',
      borderTopWidth: 1,
      borderTopColor: '#475569',
      paddingTop: 4,
      fontSize: 7.5,
      textAlign: 'center',
      color: '#334155',
    },
    footer: {
      position: 'absolute',
      bottom: 16,
      left: 28,
      right: 28,
      borderTopWidth: 0.8,
      borderTopColor: '#CBD5E1',
      paddingTop: 5,
      fontSize: 7,
      color: '#64748B',
      textAlign: 'center',
    },
  });

  const colCount = Math.max(1, data.columns.length);
  const totalWeight = data.columns.reduce((sum, c) => sum + (c.weight ?? 1), 0) || colCount;
  const colWidths = data.columns.map(
    (c) => `${(((c.weight ?? 1) / totalWeight) * 100).toFixed(2)}%`,
  );

  return (
    <Document>
      <Page size="A4" orientation={colCount >= 6 ? 'landscape' : 'portrait'} style={styles.page}>
        <View style={styles.headerBox}>
          <Text style={styles.formBadge}>
            {data.meta.stateName} · {data.meta.statuteTitle} · {data.meta.formCode}
          </Text>
          <Text style={styles.title}>{data.meta.title}</Text>
          <Text style={styles.subtitle}>{data.meta.subtitle}</Text>
        </View>

        <View style={styles.metaGrid}>
          <Text style={styles.metaCell}>
            {copy.groupLabel}: {data.groupSummary.groupName} ({data.groupSummary.groupCode})
          </Text>
          <Text style={styles.metaCell}>
            {copy.chitValueLabel}: {data.groupSummary.chitValueFormatted} ({data.groupSummary.totalMembers} {copy.membersUnit})
          </Text>
          <Text style={styles.metaCell}>
            {copy.foremanLabel}: {data.groupSummary.foremanName} · {copy.commissionWord} {data.groupSummary.commissionPct}%
          </Text>
          <Text style={styles.metaCell}>
            {copy.regSanctionLabel}: {data.groupSummary.chitRegistrationNumber} / {data.groupSummary.priorSanctionNumber}
          </Text>
          <Text style={styles.metaCell}>
            {copy.registrarLabel}: {data.groupSummary.registrarJurisdiction}
          </Text>
          <Text style={styles.metaCell}>
            {copy.officeLabel}: {data.groupSummary.registeredOfficeAddress}
          </Text>
        </View>

        <View style={styles.tableHeader}>
          {data.columns.map((c, idx) => (
            <View key={c.key} style={{ width: colWidths[idx], paddingHorizontal: 5 }}>
              <Text style={{ textAlign: c.align === 'right' ? 'right' : 'left' }}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>

        {data.rows.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={{ color: '#64748B' }}>{copy.emptyRecords}</Text>
          </View>
        ) : (
          data.rows.map((row, rIdx) => (
            <View key={rIdx} style={styles.tableRow} wrap={false}>
              {data.columns.map((c, idx) => (
                <View key={c.key} style={{ width: colWidths[idx], paddingHorizontal: 5 }}>
                  <Text style={{ textAlign: c.align === 'right' ? 'right' : 'left' }}>
                    {String(row[c.key] ?? '—')}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}

        {data.totals.length > 0 && (
          <View style={styles.totalsBar}>
            {data.totals.map((t, i) => (
              <Text key={i} style={{ fontSize: 8, ...bold }}>
                {t.label}: {t.value}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.sigRow}>
          {data.meta.signatureBlocks.map((sig, i) => (
            <Text key={i} style={styles.sigBox}>
              {sig}
            </Text>
          ))}
        </View>

        <Text style={styles.footer} fixed>
          {data.disclaimer}
        </Text>
      </Page>
    </Document>
  );
}
