import { NextResponse } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream } from '@react-pdf/renderer';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#111827' },
  title: { fontSize: 20, marginBottom: 6, fontWeight: 'bold' },
  subtitle: { fontSize: 11, color: '#4b5563', marginBottom: 18 },
  row: { flexDirection: 'row', borderBottom: '1px solid #e5e7eb', paddingVertical: 6 },
  header: { backgroundColor: '#f3f4f6', fontWeight: 'bold' },
  colNo: { width: '10%' },
  colDate: { width: '25%' },
  colAmount: { width: '22%', textAlign: 'right' },
  colStatus: { width: '21%', textAlign: 'right' },
  summary: { marginBottom: 16, padding: 10, backgroundColor: '#f9fafb' },
});

function money(value: unknown) {
  return `${Number(value || 0).toFixed(2)} INR`;
}

const StatementDocument = ({ loan }: { loan: any }) => {
  const totalPaid = loan.instalments.reduce((sum: number, inst: any) => sum + Number(inst.receivedAmount), 0);
  const totalDue = Number(loan.totalPayable);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Loan Statement</Text>
        <Text style={styles.subtitle}>{loan.loanCode} - {loan.customer.name}</Text>
        <View style={styles.summary}>
          <Text>Total Payable: {money(totalDue)}</Text>
          <Text>Total Paid: {money(totalPaid)}</Text>
          <Text>Balance: {money(totalDue - totalPaid)}</Text>
        </View>
        <View style={[styles.row, styles.header]}>
          <Text style={styles.colNo}>No.</Text>
          <Text style={styles.colDate}>Due Date</Text>
          <Text style={styles.colAmount}>Due</Text>
          <Text style={styles.colAmount}>Paid</Text>
          <Text style={styles.colStatus}>Status</Text>
        </View>
        {loan.instalments.map((inst: any) => (
          <View key={inst.id} style={styles.row}>
            <Text style={styles.colNo}>{inst.instalmentNo}</Text>
            <Text style={styles.colDate}>{new Date(inst.dueDate).toLocaleDateString()}</Text>
            <Text style={styles.colAmount}>{money(inst.dueAmount)}</Text>
            <Text style={styles.colAmount}>{money(inst.receivedAmount)}</Text>
            <Text style={styles.colStatus}>{inst.status}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
};

export async function GET(request: Request) {
  const session = await getBorrowerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetLoanId = url.searchParams.get('loanId') || session.loanId;

  const loan = await prisma.loan.findFirst({
    where: { id: targetLoanId, tenantId: session.tenantId, customerId: session.customerId },
    include: {
      customer: true,
      instalments: { orderBy: { instalmentNo: 'asc' } },
    },
  });

  if (!loan) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  }

  const stream = await renderToStream(<StatementDocument loan={loan} />);
  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="loan_statement_${loan.loanCode}.pdf"`,
    },
  });
}
