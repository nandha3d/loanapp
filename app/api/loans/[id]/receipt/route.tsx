import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, renderToStream } from '@react-pdf/renderer';

/**
 * Redirects to the canonical receipt endpoint at /api/receipts/:entryId.
 * The full-featured PDF is generated there using lib/receipt.tsx.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get('entryId');

  if (!entryId) {
    return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/api/receipts/${entryId}`, request.url));
}



// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  section: {
    margin: 10,
    padding: 10,
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '1px solid #eee',
    paddingVertical: 5,
  },
  label: {
    fontSize: 12,
    color: '#666',
  },
  value: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#999',
  }
});

// Create Document Component
const ReceiptDocument = ({ entry, tenant }: { entry: any, tenant: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.section}>
        <Text style={styles.header}>{tenant.name || 'LoanTrack'}</Text>
        <Text style={{ textAlign: 'center', fontSize: 14, marginBottom: 30 }}>Payment Receipt</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>Receipt No:</Text>
          <Text style={styles.value}>{entry.id}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>{new Date(entry.submittedAt).toLocaleDateString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Loan Code:</Text>
          <Text style={styles.value}>{entry.loan?.loanCode || 'N/A'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Customer:</Text>
          <Text style={styles.value}>{entry.loan?.customer?.name || 'N/A'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Amount Paid:</Text>
          <Text style={styles.value}>{Number(entry.receivedAmount).toFixed(2)} INR</Text>
        </View>
      </View>
      <Text style={styles.footer}>Thank you for your payment. This is a computer generated receipt.</Text>
    </Page>
  </Document>
);

// export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
//   const { id } = await params;
//   const session = await auth();
//   if (!session?.user) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

//   const { searchParams } = new URL(request.url);
//   const entryId = searchParams.get('entryId');

//   if (!entryId) {
//     return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
//   }

//   const tenantId = (session.user as any).tenantId;

//   // Retrieve the collection entry and ensure it belongs to the tenant
//   const entry = await prisma.collectionEntry.findUnique({
//     where: { id: entryId, tenantId },
//     include: {
//       loan: {
//         include: { customer: true }
//       },
//       tenant: true,
//     }
//   });

//   if (!entry) {
//     return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
//   }

//   try {
//     const stream = await renderToStream(<ReceiptDocument entry={entry} tenant={entry.tenant} />);
    
//     return new NextResponse(stream as any, {
//       headers: {
//         'Content-Type': 'application/pdf',
//         'Content-Disposition': `inline; filename="receipt_${entry.id}.pdf"`,
//       },
//     });
//   } catch (err) {
//     console.error('PDF Generation error', err);
//     return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
//   }
// }
