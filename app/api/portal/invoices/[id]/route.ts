import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDefaultTenantId } from '@/lib/tenant';
import prisma from '@/lib/db';
import { formatDate } from '@/lib/utils';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', color: '#111827' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  muted: { fontSize: 10, color: '#6b7280', marginBottom: 18 },
  section: { marginBottom: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingVertical: 8 },
  label: { fontSize: 11 },
  value: { fontSize: 11, textAlign: 'right' },
  total: { fontSize: 16, fontWeight: 'bold', marginTop: 8, textAlign: 'right' },
});

function InvoiceDocument({ invoice }: { invoice: any }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, 'INVOICE'),
      React.createElement(Text, { style: styles.muted }, `Invoice #: ${invoice.id} | Date: ${formatDate(invoice.createdAt)}`),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.label }, 'Billed To'),
        React.createElement(Text, { style: styles.value }, `${invoice.tenant.name} (${invoice.tenant.slug}.loantrack.app)`),
      ),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, 'LoanTrack Subscription - Monthly'),
        React.createElement(Text, { style: styles.value }, `${Number(invoice.amount).toFixed(2)} INR`),
      ),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(Text, { style: styles.label }, 'Tax'),
        React.createElement(Text, { style: styles.value }, `${Number(invoice.tax).toFixed(2)} INR`),
      ),
      React.createElement(Text, { style: styles.total }, `Total: ${Number(invoice.total).toFixed(2)} INR`),
    ),
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const tenantId = await getDefaultTenantId();

  const invoice = await prisma.billingInvoice.findFirst({
    where: { id, tenantId },
    include: { tenant: true },
  });

  if (!invoice) {
    return new NextResponse('Invoice not found', { status: 404 });
  }

  const stream = await renderToStream(React.createElement(InvoiceDocument, { invoice }) as any);
  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice_${invoice.id}.pdf"`,
    },
  });
}
