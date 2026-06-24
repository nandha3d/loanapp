import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 40, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 18, borderBottomWidth: 2, borderBottomColor: '#F5A623', borderBottomStyle: 'solid', paddingBottom: 14,
  },
  brandTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#F5A623' },
  brandSub: { fontSize: 9, color: '#4B5563', marginTop: 2 },
  docTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827', textAlign: 'right' },
  docDate: { fontSize: 8, color: '#6B7280', textAlign: 'right', marginTop: 3 },
  infoBlock: {
    backgroundColor: '#F9FAFB', borderRadius: 6, padding: 10, marginBottom: 16,
    borderWidth: 0.5, borderColor: '#E5E7EB', borderStyle: 'solid',
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  infoLabel: { color: '#6B7280', fontSize: 8.5 },
  infoValue: { fontFamily: 'Helvetica-Bold', color: '#111827', fontSize: 8.5 },
  loanHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#EEF2F7', borderRadius: 4, paddingVertical: 5, paddingHorizontal: 8, marginTop: 12, marginBottom: 0,
  },
  loanCode: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1E293B' },
  loanMeta: { fontSize: 8, color: '#4B5563' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1E293B', padding: 5 },
  th: { fontFamily: 'Helvetica-Bold', color: '#FFFFFF', fontSize: 7.5, textTransform: 'uppercase' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', borderBottomStyle: 'solid', paddingVertical: 4, paddingHorizontal: 5, alignItems: 'center' },
  rowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', borderBottomStyle: 'solid', backgroundColor: '#F9FAFB', paddingVertical: 4, paddingHorizontal: 5, alignItems: 'center' },
  rowPaid: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', borderBottomStyle: 'solid', backgroundColor: '#F0FDF4', paddingVertical: 4, paddingHorizontal: 5, alignItems: 'center' },
  td: { fontSize: 8, color: '#374151' },
  loanTotal: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 5, paddingHorizontal: 5, backgroundColor: '#F1F5F9' },
  loanTotalText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#111827' },
  grandTotal: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1E293B', borderTopStyle: 'solid' },
  grandLabel: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#111827', marginRight: 12 },
  grandValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#166534' },
  footer: {
    position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#E5E7EB',
    borderTopStyle: 'solid', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#9CA3AF',
  },
});

// Column widths (sum to 100). Numbers right-aligned with their own cell so
// Received and Mode never collide.
const W = { idx: '6%', date: '20%', due: '17%', paid: '17%', balance: '20%', mode: '12%', by: '8%' };

export interface ReceiptLedgerRow {
  date: string | Date;
  due: number;
  paid: number;
  balance: number;
  mode: string;
  collectedBy?: string;
}

export interface ReceiptLoan {
  loanCode: string;
  principal: number;
  totalPayable: number;
  totalPaid: number;
  rows: ReceiptLedgerRow[];
}

export interface CollectionReceiptProps {
  customer: { name: string; customerCode: string; phone?: string | null; address?: string | null };
  loans: ReceiptLoan[];
  tenantName: string;
  branchName?: string;
  currencySymbol?: string;
  periodLabel?: string;
}

/**
 * Customer collection receipt — a day-wise passbook per loan: each row is a
 * date showing what was due, what was actually paid that day (0 if none, the
 * full amount on the day it was paid — never back-distributed) and the running
 * balance.
 */
export function CollectionReceiptPDF({
  customer,
  loans,
  tenantName,
  branchName,
  currencySymbol = '₹',
  periodLabel,
}: CollectionReceiptProps) {
  const fmt = (n: number | undefined | null) =>
    `${currencySymbol}${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string | Date | undefined | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const grandPaid = loans.reduce((s, l) => s + l.totalPaid, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>{tenantName}</Text>
            <Text style={styles.brandSub}>{branchName || 'Collection Receipt'}</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>COLLECTION RECEIPT</Text>
            <Text style={styles.docDate}>
              Generated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            {periodLabel ? <Text style={styles.docDate}>Period: {periodLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Customer</Text>
            <Text style={styles.infoValue}>{customer.name} ({customer.customerCode})</Text>
          </View>
          {customer.phone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{customer.phone}</Text>
            </View>
          ) : null}
          {customer.address ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={{ ...styles.infoValue, width: '60%', textAlign: 'right' }}>{customer.address}</Text>
            </View>
          ) : null}
        </View>

        {loans.map((loan) => (
          <View key={loan.loanCode} wrap={false}>
            <View style={styles.loanHead}>
              <Text style={styles.loanCode}>{loan.loanCode}</Text>
              <Text style={styles.loanMeta}>
                Principal {fmt(loan.principal)}  •  Payable {fmt(loan.totalPayable)}  •  Balance {fmt(Math.max(0, loan.totalPayable - loan.totalPaid))}
              </Text>
            </View>

            <View style={styles.tableHeader}>
              <Text style={{ ...styles.th, width: W.idx, textAlign: 'center' }}>#</Text>
              <Text style={{ ...styles.th, width: W.date }}>Date</Text>
              <Text style={{ ...styles.th, width: W.due, textAlign: 'right' }}>Due</Text>
              <Text style={{ ...styles.th, width: W.paid, textAlign: 'right' }}>Paid</Text>
              <Text style={{ ...styles.th, width: W.balance, textAlign: 'right' }}>Balance</Text>
              <Text style={{ ...styles.th, width: W.mode, textAlign: 'center' }}>Mode</Text>
              <Text style={{ ...styles.th, width: W.by }}>By</Text>
            </View>

            {loan.rows.map((r, idx) => {
              const rowStyle = r.paid > 0 ? styles.rowPaid : idx % 2 ? styles.rowAlt : styles.row;
              return (
                <View key={idx} style={rowStyle}>
                  <Text style={{ ...styles.td, width: W.idx, textAlign: 'center' }}>{idx + 1}</Text>
                  <Text style={{ ...styles.td, width: W.date }}>{fmtDate(r.date)}</Text>
                  <Text style={{ ...styles.td, width: W.due, textAlign: 'right' }}>{r.due > 0 ? fmt(r.due) : '—'}</Text>
                  <Text style={{ ...styles.td, width: W.paid, textAlign: 'right', fontFamily: r.paid > 0 ? 'Helvetica-Bold' : 'Helvetica', color: r.paid > 0 ? '#166534' : '#9CA3AF' }}>{fmt(r.paid)}</Text>
                  <Text style={{ ...styles.td, width: W.balance, textAlign: 'right' }}>{fmt(r.balance)}</Text>
                  <Text style={{ ...styles.td, width: W.mode, textAlign: 'center', textTransform: 'uppercase', fontSize: 7 }}>{r.paid > 0 ? (r.mode || 'cash') : '—'}</Text>
                  <Text style={{ ...styles.td, width: W.by, fontSize: 7 }}>{r.collectedBy || '—'}</Text>
                </View>
              );
            })}

            <View style={styles.loanTotal}>
              <Text style={styles.loanTotalText}>Loan total paid: {fmt(loan.totalPaid)}</Text>
            </View>
          </View>
        ))}

        {loans.length === 0 ? (
          <Text style={{ ...styles.td, textAlign: 'center', color: '#9CA3AF', marginTop: 20 }}>No loans found for this customer.</Text>
        ) : null}

        <View style={styles.grandTotal}>
          <Text style={styles.grandLabel}>Total Received:</Text>
          <Text style={styles.grandValue}>{fmt(grandPaid)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Computer-generated collection receipt — {tenantName}.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
