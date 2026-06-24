import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 40, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#F5A623', borderBottomStyle: 'solid', paddingBottom: 15,
  },
  brandTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#F5A623' },
  brandSub: { fontSize: 9, color: '#4B5563', marginTop: 2 },
  docTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827', textAlign: 'right' },
  docDate: { fontSize: 8, color: '#6B7280', textAlign: 'right', marginTop: 3 },
  infoBlock: {
    backgroundColor: '#F9FAFB', borderRadius: 6, padding: 12, marginBottom: 20,
    borderWidth: 0.5, borderColor: '#E5E7EB', borderStyle: 'solid',
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLabel: { color: '#6B7280', fontSize: 8.5 },
  infoValue: { fontFamily: 'Helvetica-Bold', color: '#111827', fontSize: 8.5 },
  table: { width: '100%', marginBottom: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1E293B', borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 6 },
  th: { fontFamily: 'Helvetica-Bold', color: '#FFFFFF', fontSize: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', borderBottomStyle: 'solid', padding: 6, alignItems: 'center' },
  rowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', borderBottomStyle: 'solid', backgroundColor: '#F9FAFB', padding: 6, alignItems: 'center' },
  td: { fontSize: 8, color: '#374151' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1E293B', borderTopStyle: 'solid' },
  totalLabel: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#111827', marginRight: 12 },
  totalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#166534' },
  footer: {
    position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#E5E7EB',
    borderTopStyle: 'solid', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: '#9CA3AF',
  },
});

export interface CollectionReceiptEntry {
  submittedAt: string | Date;
  loanCode: string;
  dueAmount: number | string;
  receivedAmount: number | string;
  paymentMode: string;
  agentName: string;
}

export interface CollectionReceiptProps {
  customer: { name: string; customerCode: string; phone?: string | null; address?: string | null };
  entries: CollectionReceiptEntry[];
  tenantName: string;
  branchName?: string;
  currencySymbol?: string;
  periodLabel?: string;
}

/** Customer-level collection receipt: every payment they made, with date, loan,
 *  amount and mode of payment, plus the total received. */
export function CollectionReceiptPDF({
  customer,
  entries,
  tenantName,
  branchName,
  currencySymbol = '₹',
  periodLabel,
}: CollectionReceiptProps) {
  const fmt = (n: number | string | undefined | null) => {
    if (n === undefined || n === null) return `${currencySymbol}0.00`;
    return `${currencySymbol}${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };
  const fmtDate = (d: string | Date | undefined | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const totalReceived = entries.reduce((s, e) => s + Number(e.receivedAmount || 0), 0);

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
            <Text style={styles.infoLabel}>Customer:</Text>
            <Text style={styles.infoValue}>{customer.name} ({customer.customerCode})</Text>
          </View>
          {customer.phone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{customer.phone}</Text>
            </View>
          ) : null}
          {customer.address ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address:</Text>
              <Text style={{ ...styles.infoValue, width: '60%', textAlign: 'right' }}>{customer.address}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Payments:</Text>
            <Text style={styles.infoValue}>{entries.length}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.th, width: '8%', textAlign: 'center' }}>#</Text>
            <Text style={{ ...styles.th, width: '22%' }}>Date</Text>
            <Text style={{ ...styles.th, width: '20%' }}>Loan</Text>
            <Text style={{ ...styles.th, width: '18%', textAlign: 'right' }}>Received</Text>
            <Text style={{ ...styles.th, width: '14%' }}>Mode</Text>
            <Text style={{ ...styles.th, width: '18%' }}>Collected By</Text>
          </View>

          {entries.map((e, idx) => (
            <View key={idx} style={idx % 2 ? styles.rowAlt : styles.row}>
              <Text style={{ ...styles.td, width: '8%', textAlign: 'center' }}>{idx + 1}</Text>
              <Text style={{ ...styles.td, width: '22%' }}>{fmtDate(e.submittedAt)}</Text>
              <Text style={{ ...styles.td, width: '20%' }}>{e.loanCode}</Text>
              <Text style={{ ...styles.td, width: '18%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmt(e.receivedAmount)}</Text>
              <Text style={{ ...styles.td, width: '14%', textTransform: 'uppercase', fontSize: 7 }}>{e.paymentMode || 'cash'}</Text>
              <Text style={{ ...styles.td, width: '18%' }}>{e.agentName || '—'}</Text>
            </View>
          ))}

          {entries.length === 0 ? (
            <View style={styles.row}>
              <Text style={{ ...styles.td, width: '100%', textAlign: 'center', color: '#9CA3AF' }}>No collections recorded.</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Received:</Text>
          <Text style={styles.totalValue}>{fmt(totalReceived)}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Computer-generated collection receipt — {tenantName}.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
