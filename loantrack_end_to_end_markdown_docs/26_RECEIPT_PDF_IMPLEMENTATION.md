# Feature 2 — Payment Receipt PDF

> Uses `@react-pdf/renderer` (already installed). Generates a branded A5 receipt for every collection entry. Downloadable by admin and agent. Served via API route.

---

## TASK 1 — Create `lib/receipt.tsx`

```tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

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
    borderBottom: '2 solid #F5A623',
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
    borderBottom: '0.5 solid #E5E7EB',
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
    borderTop: '0.5 solid #E5E7EB',
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
    border: '1 solid #E5E7EB',
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
```

---

## TASK 2 — Create `app/api/receipts/[entryId]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { PaymentReceiptPDF } from '@/lib/receipt';
import { getBranding } from '@/lib/tenant';

export async function GET(req: NextRequest, { params }: { params: { entryId: string } }) {
  const ctx = await requireApiContext(req);
  if (!ctx.success) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { tenantId, role } = ctx;
  const { entryId } = params;

  // Fetch collection entry with all needed data
  const entry = await prisma.collectionEntry.findFirst({
    where: { id: entryId, tenantId },
    include: {
      customer: true,
      loan: {
        include: {
          instalments: {
            orderBy: { instalmentNo: 'asc' },
          },
        },
      },
      agent: { select: { name: true } },
      instalment: true,
    },
  });

  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  // Agents can only download their own receipts
  if (role === 'agent' && entry.agentId !== ctx.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const branding = await getBranding(tenantId);
  const loan = entry.loan;
  const totalCollected = loan.instalments
    .filter(i => i.status === 'paid' || i.status === 'partial')
    .reduce((s, i) => s + Number(i.receivedAmount), 0);

  const outstanding = Number(loan.principal) - totalCollected;

  const receiptData = {
    receiptNo: `${loan.loanCode}-${entry.instalment?.instalmentNo || '?'}`,
    date: new Date(entry.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    customerName:    entry.customer.name,
    customerCode:    entry.customer.customerCode,
    customerPhone:   entry.customer.phone,
    loanCode:        loan.loanCode,
    frequency:       loan.frequency,
    instalmentNo:    entry.instalment?.instalmentNo ?? 0,
    totalInstalments:loan.totalInstalments,
    dueAmount:       Number(entry.dueAmount),
    receivedAmount:  Number(entry.receivedAmount),
    outstandingBalance: Math.max(0, outstanding),
    paymentMode:     entry.paymentMode,
    agentName:       entry.agent?.name ?? 'Agent',
    appName:         branding.appName,
    branchName:      branding.appTagline,
    currencySymbol:  branding.currencySymbol,
  };

  const buffer = await renderToBuffer(
    createElement(PaymentReceiptPDF, { data: receiptData })
  );

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${receiptData.receiptNo}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
```

---

## TASK 3 — Add receipt download button in `CollectionClient.tsx`

In the collection entry success state or in the entries list, add a download link:

```tsx
// After a successful collection entry, or in the entries list row:
<a
  href={`/api/receipts/${entry.id}`}
  target="_blank"
  rel="noopener noreferrer"
  className="btn btn-ghost btn-sm"
  title="Download Receipt"
>
  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>receipt_long</span>
  Receipt
</a>
```

---

## TASK 4 — Add receipt download in `LoanDetailClient.tsx`

In the ACTIVITY TRACKER table, for each paid instalment row, add:

```tsx
{instalment.collectionEntry?.id && (
  <a
    href={`/api/receipts/${instalment.collectionEntry.id}`}
    target="_blank"
    rel="noopener noreferrer"
    className="btn btn-ghost btn-sm"
    style={{ fontSize: '12px' }}
  >
    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
    PDF
  </a>
)}
```

For this to work, include `collectionEntry: { select: { id: true } }` in the instalment include in `LoanDetailClient`'s data fetch.

---

## TASK 5 — Loan statement PDF (full passbook)

**Create:** `app/api/loans/[id]/statement/route.ts`

This generates a full loan statement — all instalments, payments, penalties.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { LoanStatementPDF } from '@/lib/loanStatement'; // see below

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireApiContext(req);
  if (!ctx.success) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const loan = await prisma.loan.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
    include: {
      customer: true,
      instalments: { orderBy: { instalmentNo: 'asc' } },
      penalties: true,
      createdBy: { select: { name: true } },
    },
  });

  if (!loan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const buffer = await renderToBuffer(
    createElement(LoanStatementPDF, { loan, tenantName: ctx.tenantId })
  );

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="statement-${loan.loanCode}.pdf"`,
    },
  });
}
```

Create `lib/loanStatement.tsx` with a `LoanStatementPDF` component following the same pattern as `lib/receipt.tsx` but with a full instalment table, penalty summary, and loan summary header.
