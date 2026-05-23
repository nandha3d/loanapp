import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 30,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#F5A623',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
  },
  brandName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#F5A623',
  },
  brandSub: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 2,
  },
  receiptTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    textAlign: 'right',
  },
  receiptNo: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 2,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    color: '#6B7280',
    width: '40%',
  },
  value: {
    fontSize: 9,
    color: '#1A1A1A',
    width: '58%',
    textAlign: 'right',
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    marginVertical: 10,
  },
  amountBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#854F0B',
  },
  amountValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#F5A623',
  },
  footer: {
    marginTop: 20,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    borderTopStyle: 'solid',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLeft: {
    fontSize: 8,
    color: '#9CA3AF',
    width: '60%',
  },
  stamp: {
    width: 80,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'solid',
    padding: 8,
    alignItems: 'center',
  },
  stampText: {
    fontSize: 7,
    color: '#6B7280',
    textAlign: 'center',
  },
  paid: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#27AE60',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  statusBar: {
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#166534',
  },
});

export interface ReceiptData {
  receiptNo: string;
  date: string;
  // Borrower
  customerName: string;
  customerCode: string;
  customerPhone: string;
  // Loan
  loanCode: string;
  frequency: string;
  instalmentNo: number;
  totalInstalments: number;
  dueAmount: number;
  receivedAmount: number;
  outstandingBalance: number;
  paymentMode: string;
  // Agent
  agentName: string;
  // Branding
  appName: string;
  branchName: string;
  currencySymbol: string;
}

export function PaymentReceiptPDF({ data }: { data: ReceiptData }) {
  const fmt = (n: number) => `${data.currencySymbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <Document>
      <Page size="A5" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>{data.appName}</Text>
            <Text style={styles.brandSub}>{data.branchName}</Text>
          </View>
          <View>
            <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>
            <Text style={styles.receiptNo}>#{data.receiptNo}</Text>
          </View>
        </View>

        {/* Paid stamp */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>✓ PAYMENT RECEIVED</Text>
        </View>

        {/* Amount */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount Received</Text>
          <Text style={styles.amountValue}>{fmt(data.receivedAmount)}</Text>
        </View>

        {/* Borrower details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Borrower</Text>
          <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{data.customerName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Customer ID</Text><Text style={styles.value}>{data.customerCode}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{data.customerPhone}</Text></View>
        </View>

        <View style={styles.divider} />

        {/* Loan details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Loan Details</Text>
          <View style={styles.row}><Text style={styles.label}>Loan ID</Text><Text style={styles.value}>{data.loanCode}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Instalment</Text><Text style={styles.value}>{data.instalmentNo} of {data.totalInstalments}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Frequency</Text><Text style={styles.value}>{data.frequency}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Due Amount</Text><Text style={styles.value}>{fmt(data.dueAmount)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Payment Mode</Text><Text style={styles.value}>{data.paymentMode.replace('_', ' ').toUpperCase()}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Outstanding Balance</Text><Text style={{ ...styles.value, color: data.outstandingBalance > 0 ? '#E24B4A' : '#27AE60', fontFamily: 'Helvetica-Bold' }}>{fmt(Math.max(0, data.outstandingBalance))}</Text></View>
        </View>

        <View style={styles.divider} />

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text>Date: {data.date}</Text>
            <Text style={{ marginTop: 3 }}>Collected by: {data.agentName}</Text>
            <Text style={{ marginTop: 6, color: '#9CA3AF' }}>This is a computer-generated receipt.</Text>
          </View>
          <View style={styles.stamp}>
            <Text style={styles.paid}>PAID</Text>
            <Text style={styles.stampText}>{data.appName}</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
