import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { requireApiContext, isApiError } from '@/lib/apiAuth';
import { PaymentReceiptPDF } from '@/lib/receipt';
import { getBranding, getTenantSettings } from '@/lib/tenant';
import { apiError } from '@/lib/utils';

export async function GET(req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const authResult = await requireApiContext();
    if (isApiError(authResult)) return authResult.response;

    const { tenantId, role, userId } = authResult.context;
    const { entryId } = await params;

    // 1. Subscription Check (Developer-level Gate)
    const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (!sub || !sub.receiptPdfAllowed) {
      return apiError('Receipt PDF downloads are not allowed under your subscription plan.', 403);
    }

    // 2. Settings Check (Superadmin-level Gate)
    const settings = await getTenantSettings(tenantId);
    if (settings.receipt_pdf_active !== 'true') {
      return apiError('Receipt PDF downloads are currently disabled by the administrator.', 403);
    }

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

    if (!entry) return apiError('Collection entry not found', 404);

    // Agents can only download their own receipts
    if (role === 'agent' && entry.agentId !== userId) {
      return apiError('Forbidden', 403);
    }

    const branding = await getBranding(tenantId);
    const loan = entry.loan;
    const totalCollected = loan.instalments
      .filter((i) => i.status === 'paid' || i.status === 'partial')
      .reduce((s, i) => s + Number(i.receivedAmount), 0);

    const outstanding = Number(loan.totalPayable || loan.principal) - totalCollected;

    const receiptData = {
      receiptNo: `${loan.loanCode}-${entry.instalment?.instalmentNo || '?'}`,
      date: new Date(entry.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
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
      createElement(PaymentReceiptPDF, { data: receiptData }) as any
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
    return apiError(error.message || 'Internal server error', 500);
  }
}
