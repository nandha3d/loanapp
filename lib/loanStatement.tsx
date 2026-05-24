import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 40,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#F5A623',
    borderBottomStyle: 'solid',
    paddingBottom: 15,
  },
  brandTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#F5A623',
  },
  brandSub: {
    fontSize: 9,
    color: '#4B5563',
    marginTop: 2,
  },
  statementTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    textAlign: 'right',
  },
  statementDate: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 3,
  },
  summaryBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderStyle: 'solid',
  },
  col: {
    width: '48%',
  },
  colTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    paddingBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    color: '#6B7280',
    fontSize: 8.5,
  },
  summaryValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    fontSize: 8.5,
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    padding: 6,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    fontSize: 8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    padding: 6,
    alignItems: 'center',
  },
  tableRowAlternate: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    backgroundColor: '#F9FAFB',
    padding: 6,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 8,
    color: '#374151',
  },
  badgePaid: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    textAlign: 'center',
  },
  badgePartial: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    textAlign: 'center',
  },
  badgeUpcoming: {
    backgroundColor: '#F3F4F6',
    color: '#374151',
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    textAlign: 'center',
  },
  badgeMissed: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    borderTopStyle: 'solid',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: '#9CA3AF',
  },
});

export interface LoanStatementPDFProps {
  loan: any;
  tenantName: string;
  currencySymbol: string;
  branchName: string;
}

export function LoanStatementPDF({ loan, tenantName, currencySymbol = '₹', branchName }: LoanStatementPDFProps) {
  const fmt = (n: number | string | undefined | null) => {
    if (n === undefined || n === null) return `${currencySymbol}0.00`;
    const num = Number(n);
    return `${currencySymbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const fmtDate = (dStr: string | Date | undefined | null) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const totalCollected = (loan.instalments || [])
    .reduce((s: number, i: any) => s + Number(i.receivedAmount || 0), 0);

  const outstanding = Math.max(0, Number(loan.totalPayable || loan.principal) - totalCollected);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>{tenantName}</Text>
            <Text style={styles.brandSub}>{branchName || 'Micro-Lending Statement'}</Text>
          </View>
          <View>
            <Text style={styles.statementTitle}>LOAN ACCOUNT STATEMENT</Text>
            <Text style={styles.statementDate}>Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* Customer & Loan Summary */}
        <View style={styles.summaryBlock}>
          {/* Customer Info */}
          <View style={styles.col}>
            <Text style={styles.colTitle}>Customer Information</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Customer Name:</Text>
              <Text style={styles.summaryValue}>{loan.customer?.name || '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Customer ID:</Text>
              <Text style={styles.summaryValue}>{loan.customer?.customerCode || '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phone Number:</Text>
              <Text style={styles.summaryValue}>{loan.customer?.phone || '—'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Address:</Text>
              <Text style={{ ...styles.summaryValue, width: '60%', textAlign: 'right', fontSize: 8 }}>{loan.customer?.address || '—'}</Text>
            </View>
          </View>

          {/* Loan Info */}
          <View style={styles.col}>
            <Text style={styles.colTitle}>Loan Account Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Loan Code / ID:</Text>
              <Text style={styles.summaryValue}>{loan.loanCode}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Principal / Repayable:</Text>
              <Text style={styles.summaryValue}>{fmt(loan.principal)} / {fmt(loan.totalPayable || loan.principal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Disbursed Amount:</Text>
              <Text style={styles.summaryValue}>{fmt(loan.disbursed)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Repayment Schedule:</Text>
              <Text style={styles.summaryValue}>{loan.totalInstalments} Instalments ({loan.frequency})</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Start / End Date:</Text>
              <Text style={styles.summaryValue}>{fmtDate(loan.startDate)} / {fmtDate(loan.endDate || loan.startDate)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Collected:</Text>
              <Text style={{ ...styles.summaryValue, color: '#166534' }}>{fmt(totalCollected)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Outstanding:</Text>
              <Text style={{ ...styles.summaryValue, color: outstanding > 0 ? '#E24B4A' : '#166534' }}>{fmt(outstanding)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Account Status:</Text>
              <Text style={{ ...styles.summaryValue, textTransform: 'uppercase', color: loan.status === 'active' ? '#1E293B' : loan.status === 'closed' ? '#166534' : '#E24B4A' }}>{loan.status}</Text>
            </View>
          </View>
        </View>

        {/* Repayment Details Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderCell, width: '8%', textAlign: 'center' }}>#</Text>
            <Text style={{ ...styles.tableHeaderCell, width: '20%' }}>Due Date</Text>
            <Text style={{ ...styles.tableHeaderCell, width: '16%', textAlign: 'right' }}>Due Amt</Text>
            <Text style={{ ...styles.tableHeaderCell, width: '16%', textAlign: 'right' }}>Paid Amt</Text>
            <Text style={{ ...styles.tableHeaderCell, width: '20%' }}>Paid Date</Text>
            <Text style={{ ...styles.tableHeaderCell, width: '10%' }}>Mode</Text>
            <Text style={{ ...styles.tableHeaderCell, width: '10%', textAlign: 'center' }}>Status</Text>
          </View>

          {(loan.instalments || []).map((inst: any, idx: number) => {
            const isAlternate = idx % 2 === 1;
            const rowStyle = isAlternate ? styles.tableRowAlternate : styles.tableRow;
            let statusBadge = styles.badgeUpcoming;
            if (inst.status === 'paid') statusBadge = styles.badgePaid;
            else if (inst.status === 'partial') statusBadge = styles.badgePartial;
            else if (inst.status === 'missed') statusBadge = styles.badgeMissed;

            return (
              <View key={inst.id || idx} style={rowStyle}>
                <Text style={{ ...styles.tableCell, width: '8%', textAlign: 'center' }}>{inst.instalmentNo}</Text>
                <Text style={{ ...styles.tableCell, width: '20%' }}>{fmtDate(inst.dueDate)}</Text>
                <Text style={{ ...styles.tableCell, width: '16%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{fmt(inst.dueAmount)}</Text>
                <Text style={{ ...styles.tableCell, width: '16%', textAlign: 'right' }}>{inst.receivedAmount > 0 ? fmt(inst.receivedAmount) : '—'}</Text>
                <Text style={{ ...styles.tableCell, width: '20%' }}>{inst.receivedAt ? fmtDate(inst.receivedAt) : '—'}</Text>
                <Text style={{ ...styles.tableCell, width: '10%', textTransform: 'uppercase', fontSize: 7 }}>{inst.paymentMode || '—'}</Text>
                <View style={{ width: '10%', alignItems: 'center' }}>
                  <Text style={statusBadge}>{inst.status.toUpperCase()}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>This is a computer-generated account statement. Page footer.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
