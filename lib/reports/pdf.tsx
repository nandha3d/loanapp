import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { getReportLabel } from './types';

const S = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 9, padding: 36 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1.5 solid #F5A623', paddingBottom: 8 },
  brandName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#F5A623' },
  brandSub:  { fontSize: 7, color: '#6B7280', marginTop: 2 },
  reportTitle:{ fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  period:    { fontSize: 7, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  section:   { marginBottom: 14 },
  sHead:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', marginBottom: 6, backgroundColor: '#F8F9FA', padding: 4 },
  row:       { flexDirection: 'row', borderBottom: '0.5 solid #E5E7EB', paddingVertical: 3, paddingHorizontal: 2 },
  th:        { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6B7280' },
  td:        { fontSize: 8, color: '#1A1A1A' },
  kpiGrid:   { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kpiBox:    { flex: 1, border: '0.5 solid #E5E7EB', borderRadius: 4, padding: 8 },
  kpiVal:    { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#F5A623' },
  kpiLbl:    { fontSize: 7, color: '#6B7280', marginTop: 2 },
});

function fmt(n: number, sym = '₹') {
  return `${sym}${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

interface ReportData {
  from: string;
  to: string;
  appName: string;
  branchName: string;
  collectionEfficiency: { expected: number; collected: number; efficiency: number };
  agentPerformance: { name: string; route: string; customers: number; expected: number; collected: number; hitRate: number }[];
  penaltyReport: { accrued: number; settled: number; waived: number };
  disbursement: { count: number; totalPrincipal: number };
  agingBuckets: {
    short:  { count: number; penalty: number };
    medium: { count: number; penalty: number };
    long:   { count: number; penalty: number };
  };
  currencySymbol: string;
}

export function CollectionReportPDF({ data }: { data: ReportData }) {
  const sym = data.currencySymbol;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.brandName}>{data.appName}</Text>
            <Text style={S.brandSub}>{data.branchName}</Text>
          </View>
          <View>
            <Text style={S.reportTitle}>COLLECTION REPORT</Text>
            <Text style={S.period}>{data.from} to {data.to}</Text>
          </View>
        </View>

        {/* KPI summary */}
        <View style={S.kpiGrid}>
          <View style={S.kpiBox}>
            <Text style={S.kpiVal}>{fmt(data.collectionEfficiency.collected, sym)}</Text>
            <Text style={S.kpiLbl}>Total Collected</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiVal}>{fmt(data.collectionEfficiency.expected, sym)}</Text>
            <Text style={S.kpiLbl}>Total Expected</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiVal}>{data.collectionEfficiency.efficiency}%</Text>
            <Text style={S.kpiLbl}>Efficiency</Text>
          </View>
          <View style={S.kpiBox}>
            <Text style={S.kpiVal}>{data.disbursement.count}</Text>
            <Text style={S.kpiLbl}>Loans Disbursed</Text>
          </View>
        </View>

        {/* Agent performance table */}
        <View style={S.section}>
          <Text style={S.sHead}>Agent Performance</Text>
          <View style={[S.row, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[S.th, { width: '22%' }]}>Agent</Text>
            <Text style={[S.th, { width: '20%' }]}>Route</Text>
            <Text style={[S.th, { width: '10%', textAlign: 'right' }]}>Customers</Text>
            <Text style={[S.th, { width: '16%', textAlign: 'right' }]}>Expected</Text>
            <Text style={[S.th, { width: '16%', textAlign: 'right' }]}>Collected</Text>
            <Text style={[S.th, { width: '16%', textAlign: 'right' }]}>Hit Rate</Text>
          </View>
          {data.agentPerformance.map((a, i) => (
            <View key={i} style={[S.row, { backgroundColor: i % 2 === 1 ? '#F9FAFB' : '#fff' }]}>
              <Text style={[S.td, { width: '22%' }]}>{a.name}</Text>
              <Text style={[S.td, { width: '20%' }]}>{a.route}</Text>
              <Text style={[S.td, { width: '10%', textAlign: 'right' }]}>{a.customers}</Text>
              <Text style={[S.td, { width: '16%', textAlign: 'right' }]}>{fmt(a.expected, sym)}</Text>
              <Text style={[S.td, { width: '16%', textAlign: 'right' }]}>{fmt(a.collected, sym)}</Text>
              <Text style={[S.td, { width: '16%', textAlign: 'right', color: a.hitRate >= 80 ? '#27AE60' : a.hitRate >= 50 ? '#F59E0B' : '#E74C3C', fontFamily: 'Helvetica-Bold' }]}>
                {a.hitRate}%
              </Text>
            </View>
          ))}
        </View>

        {/* Penalty summary */}
        <View style={S.section}>
          <Text style={S.sHead}>Penalty Summary</Text>
          <View style={S.kpiGrid}>
            <View style={S.kpiBox}>
              <Text style={[S.kpiVal, { color: '#E74C3C' }]}>{fmt(data.penaltyReport.accrued, sym)}</Text>
              <Text style={S.kpiLbl}>Total Accrued</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={[S.kpiVal, { color: '#27AE60' }]}>{fmt(data.penaltyReport.settled, sym)}</Text>
              <Text style={S.kpiLbl}>Settled</Text>
            </View>
            <View style={S.kpiBox}>
              <Text style={[S.kpiVal, { color: '#6B7280' }]}>{fmt(data.penaltyReport.waived, sym)}</Text>
              <Text style={S.kpiLbl}>Waived</Text>
            </View>
          </View>
        </View>

        {/* Aging */}
        <View style={S.section}>
          <Text style={S.sHead}>Overdue Aging</Text>
          <View style={[S.row, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[S.th, { width: '40%' }]}>Bucket</Text>
            <Text style={[S.th, { width: '30%', textAlign: 'right' }]}>Customers</Text>
            <Text style={[S.th, { width: '30%', textAlign: 'right' }]}>Penalty</Text>
          </View>
          {[
            { label: '1–30 days overdue',   bucket: data.agingBuckets.short },
            { label: '31–90 days overdue',  bucket: data.agingBuckets.medium },
            { label: '90+ days overdue',    bucket: data.agingBuckets.long },
          ].map(({ label, bucket }, i) => (
            <View key={i} style={S.row}>
              <Text style={[S.td, { width: '40%' }]}>{label}</Text>
              <Text style={[S.td, { width: '30%', textAlign: 'right' }]}>{bucket.count}</Text>
              <Text style={[S.td, { width: '30%', textAlign: 'right' }]}>{fmt(bucket.penalty, sym)}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={{ marginTop: 20, borderTop: '0.5 solid #E5E7EB', paddingTop: 8 }}>
          <Text style={{ fontSize: 7, color: '#9CA3AF', textAlign: 'center' }}>
            Generated by {data.appName} · {new Date().toLocaleString('en-IN')} · Confidential
          </Text>
        </View>

      </Page>
    </Document>
  );
}

const getLabel = getReportLabel;

export function TableReportPDF({ payload, dict }: { payload: any; dict?: any }) {
  const sym = payload.meta.currencySymbol;

  const formatCell = (val: any, type?: string) => {
    if (val === undefined || val === null) return '—';
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (type === 'currency' && typeof val === 'number') {
      return fmt(val, sym);
    }
    return String(val);
  };

  return (
    <Document>
      <Page size="A4" style={S.page} orientation={payload.columns.length > 7 ? 'landscape' : 'portrait'}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.brandName}>{payload.meta.appName || 'LoanTrack'}</Text>
            <Text style={S.brandSub}>{payload.meta.branchName || 'All Branches'}</Text>
          </View>
          <View>
            <Text style={S.reportTitle}>{getLabel(payload.title, dict).toUpperCase()}</Text>
            <Text style={S.period}>
              {payload.meta.from && payload.meta.to ? `${payload.meta.from} to ${payload.meta.to}` : ''}
            </Text>
          </View>
        </View>

        {/* KPI Grid */}
        {payload.kpis && payload.kpis.length > 0 && (
          <View style={S.kpiGrid}>
            {payload.kpis.map((k: any, idx: number) => (
              <View key={idx} style={S.kpiBox}>
                <Text style={S.kpiVal}>{k.value}</Text>
                <Text style={S.kpiLbl}>{getLabel(k.label, dict)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Data Table */}
        <View style={S.section}>
          {/* Header */}
          <View style={[S.row, { backgroundColor: '#F3F4F6', borderBottom: '1 solid #D1D5DB' }]}>
            {payload.columns.map((col: any, idx: number) => {
              const widthPct = col.width ? `${col.width}%` : `${100 / payload.columns.length}%`;
              const align = col.align || 'left';
              return (
                <Text key={idx} style={[S.th, { width: widthPct, textAlign: align }]}>
                  {getLabel(col.label, dict)}
                </Text>
              );
            })}
          </View>

          {/* Rows */}
          {payload.rows.map((row: any, rIdx: number) => (
            <View key={rIdx} style={[S.row, { backgroundColor: rIdx % 2 === 1 ? '#F9FAFB' : '#fff' }]}>
              {payload.columns.map((col: any, cIdx: number) => {
                const widthPct = col.width ? `${col.width}%` : `${100 / payload.columns.length}%`;
                const align = col.align || 'left';
                return (
                  <Text key={cIdx} style={[S.td, { width: widthPct, textAlign: align }]}>
                    {formatCell(row[col.key], col.type)}
                  </Text>
                );
              })}
            </View>
          ))}

          {/* Totals */}
          {payload.totals && (
            <View style={[S.row, { backgroundColor: '#F3F4F6', borderTop: '1 solid #D1D5DB', borderBottom: '1.5 double #D1D5DB', marginTop: 4 }]}>
              {payload.columns.map((col: any, idx: number) => {
                const widthPct = col.width ? `${col.width}%` : `${100 / payload.columns.length}%`;
                const align = col.align || 'left';
                if (idx === 0) {
                  return (
                    <Text key={idx} style={[S.th, { width: widthPct, textAlign: align, fontFamily: 'Helvetica-Bold' }]}>
                      {getLabel('reports.totals', dict) || 'TOTAL'}
                    </Text>
                  );
                }
                const totalVal = col.total && payload.totals ? payload.totals[col.key] : null;
                return (
                  <Text key={idx} style={[S.th, { width: widthPct, textAlign: align, fontFamily: 'Helvetica-Bold' }]}>
                    {totalVal !== null ? formatCell(totalVal, col.type) : ''}
                  </Text>
                );
              })}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={{ marginTop: 20, borderTop: '0.5 solid #E5E7EB', paddingTop: 8 }}>
          <Text style={{ fontSize: 7, color: '#9CA3AF', textAlign: 'center' }}>
            Generated by {payload.meta.appName || 'LoanTrack'} · {new Date().toLocaleString('en-IN')} · Confidential
          </Text>
        </View>
      </Page>
    </Document>
  );
}

