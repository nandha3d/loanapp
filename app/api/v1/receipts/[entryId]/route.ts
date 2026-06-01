import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { PaymentReceiptPDF } from '@/lib/receipt';
import { getBranding, getTenantSettings } from '@/lib/tenant';

/**
 * Bearer-auth mirror of `/api/receipts/[entryId]` for the mobile app.
 * Same subscription + settings gates and agent-ownership check.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const { tenantId, role, userId } = auth.context;
  const { entryId } = await params;

  try {
    // 1. Subscription gate (developer-level)
    const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (!sub || !sub.receiptPdfAllowed) {
      return new Response('Receipt PDF downloads are not allowed under your subscription plan.', {
        status: 403,
      });
    }

    // 2. Settings gate (admin-level)
    const settings = await getTenantSettings(tenantId);
    if (settings.receipt_pdf_active !== 'true') {
      return new Response('Receipt PDF downloads are currently disabled by the administrator.', {
        status: 403,
      });
    }

    const entry = await prisma.collectionEntry.findFirst({
      where: { id: entryId, tenantId },
      include: {
        customer: true,
        loan: { include: { instalments: { orderBy: { instalmentNo: 'asc' } } } },
        agent: { select: { name: true } },
        instalment: true,
      },
    });

    if (!entry) return new Response('Collection entry not found', { status: 404 });

    // Agents only their own receipts
    if (role === 'agent' && entry.agentId !== userId) {
      return new Response('Forbidden', { status: 403 });
    }

    const branding = await getBranding(tenantId);
    const loan = entry.loan;
    const totalCollected = loan.instalments
      .filter((i) => i.status === 'paid' || i.status === 'partial')
      .reduce((s, i) => s + Number(i.receivedAmount), 0);
    const outstanding = Number(loan.totalPayable || loan.principal) - totalCollected;

    const receiptData = {
      receiptNo: `${loan.loanCode}-${entry.instalment?.instalmentNo || '?'}`,
      date: new Date(entry.submittedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      customerName: entry.customer.name,
      customerCode: entry.customer.customerCode,
      customerPhone: entry.customer.phone,
      loanCode: loan.loanCode,
      frequency: loan.frequency,
      instalmentNo: entry.instalment?.instalmentNo ?? 0,
      totalInstalments: loan.totalInstalments,
      dueAmount: Number(entry.dueAmount),
      receivedAmount: Number(entry.receivedAmount),
      outstandingBalance: Math.max(0, outstanding),
      paymentMode: entry.paymentMode,
      agentName: entry.agent?.name ?? 'Agent',
      appName: branding.appName,
      branchName: branding.appTagline,
      currencySymbol: branding.currencySymbol,
    };

    const buffer = await renderToBuffer(
      createElement(PaymentReceiptPDF, { data: receiptData }) as any,
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${receiptData.receiptNo}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: any) {
    return new Response(error?.message || 'Internal server error', { status: 500 });
  }
}
