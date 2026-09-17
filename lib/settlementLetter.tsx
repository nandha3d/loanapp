import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ForeclosureCalculation } from './foreclosure';

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 44,
    backgroundColor: '#FFFFFF',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#D97706',
  },
  subtitle: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 3,
  },
  docTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    color: '#1F2937',
  },
  ref: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 2,
  },
  section: {
    marginBottom: 14,
  },
  sHead: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
  },
  label: {
    fontSize: 9,
    color: '#4B5563',
    width: '55%',
  },
  value: {
    fontSize: 9,
    color: '#111827',
    width: '43%',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    marginTop: 4,
    borderRadius: 4,
  },
  totalLbl: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#92400E',
  },
  totalVal: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#B45309',
  },
  para: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
    marginBottom: 6,
  },
  sigBox: {
    marginTop: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sigLine: {
    borderTopWidth: 1,
    borderTopColor: '#9CA3AF',
    borderTopStyle: 'solid',
    width: 150,
    paddingTop: 4,
  },
  sigLabel: {
    fontSize: 8,
    color: '#6B7280',
  },
  footer: {
    marginTop: 28,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
  footerTxt: {
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

function fmt(n: number, symbol = '₹') {
  return `${symbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export function SettlementLetterPDF({
  calc,
  appName,
  branchName,
  adminName,
  currencySymbol = '₹',
}: {
  calc: ForeclosureCalculation;
  appName: string;
  branchName: string;
  adminName: string;
  currencySymbol?: string;
}) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const refNo = `SETTLE/${calc.loanCode}/${new Date().getFullYear()}`;

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.title}>{appName}</Text>
            {branchName ? <Text style={S.subtitle}>{branchName}</Text> : null}
          </View>
          <View>
            <Text style={S.docTitle}>LOAN SETTLEMENT LETTER</Text>
            <Text style={S.ref}>Ref: {refNo}</Text>
            <Text style={S.ref}>Date: {today}</Text>
          </View>
        </View>

        {/* Addressee */}
        <View style={S.section}>
          <Text style={S.para}>To,</Text>
          <Text style={{ ...S.para, fontFamily: 'Helvetica-Bold' }}>{calc.customerName}</Text>
          <Text style={S.para}>Customer ID: {calc.customerCode}</Text>
          {calc.customerPhone ? <Text style={S.para}>Phone: {calc.customerPhone}</Text> : null}
        </View>

        {/* Body */}
        <View style={S.section}>
          <Text style={S.para}>
            Dear {calc.customerName},
          </Text>
          <Text style={S.para}>
            This letter confirms that upon receipt of the settlement amount detailed below, your
            loan account <Text style={{ fontFamily: 'Helvetica-Bold' }}>{calc.loanCode}</Text> will
            be marked as fully settled and closed as on {today}.
          </Text>
          <Text style={S.para}>
            The following amounts have been computed for early settlement:
          </Text>
        </View>

        {/* Calculation table */}
        <View style={S.section}>
          <Text style={S.sHead}>Settlement Calculation</Text>
          <View style={S.row}>
            <Text style={S.label}>Original principal amount</Text>
            <Text style={S.value}>{fmt(calc.originalPrincipal, currencySymbol)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Amount collected to date ({calc.paidInstalments} instalments)</Text>
            <Text style={S.value}>{fmt(calc.totalCollected, currencySymbol)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Principal outstanding</Text>
            <Text style={{ ...S.value, fontFamily: 'Helvetica-Bold' }}>{fmt(calc.principalOutstanding, currencySymbol)}</Text>
          </View>
          <View style={S.row}>
            <Text style={S.label}>Penalty charges ({calc.missedInstalments} missed payments)</Text>
            <Text style={S.value}>{fmt(calc.netPenaltyDue, currencySymbol)}</Text>
          </View>
          {calc.discount > 0 ? (
            <View style={S.row}>
              <Text style={S.label}>Settlement discount / rebate applied</Text>
              <Text style={{ ...S.value, color: '#059669', fontFamily: 'Helvetica-Bold' }}>− {fmt(calc.discount, currencySymbol)}</Text>
            </View>
          ) : null}
          <View style={S.totalRow}>
            <Text style={S.totalLbl}>Total Settlement Amount</Text>
            <Text style={S.totalVal}>{fmt(calc.totalSettlementAmount, currencySymbol)}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={S.section}>
          <Text style={S.sHead}>Terms &amp; Conditions</Text>
          <Text style={S.para}>
            1. This settlement offer is valid for 7 business days from the date of issuance.
          </Text>
          <Text style={S.para}>
            2. Upon payment of {fmt(calc.totalSettlementAmount, currencySymbol)}, all remaining
            {' '}{calc.remainingInstalments} upcoming instalment(s) will be waived and the loan account will be closed.
          </Text>
          <Text style={S.para}>
            3. Any active security cheques or collaterals deposited with the lender will be released and returned upon full settlement.
          </Text>
          <Text style={S.para}>
            4. This letter serves as an official settlement summary. Final No Due Certificate (NDC) is issued upon transaction reconciliation.
          </Text>
        </View>

        {/* Signatures */}
        <View style={S.sigBox}>
          <View>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Authorised Signatory</Text>
            <Text style={{ ...S.sigLabel, marginTop: 2 }}>{adminName}</Text>
            <Text style={{ ...S.sigLabel, marginTop: 1 }}>{appName}</Text>
          </View>
          <View>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Borrower Acknowledgement</Text>
            <Text style={{ ...S.sigLabel, marginTop: 2 }}>{calc.customerName}</Text>
            <Text style={{ ...S.sigLabel, marginTop: 1 }}>Date: _______________</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerTxt}>
            This is a system-generated settlement letter issued by {appName}. Ref: {refNo}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
