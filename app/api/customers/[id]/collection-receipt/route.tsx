import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { requireApiContext, isApiError } from '@/lib/apiAuth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { getBranding } from '@/lib/tenant';
import { apiError } from '@/lib/utils';
import { CollectionReceiptPDF } from '@/lib/collectionReceipt';

/**
 * Customer collection receipt PDF: every payment a customer has made (date,
 * loan, amount, mode of payment, collector), with the total received. Optional
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD to bound the period.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext();
    if (isApiError(authResult)) return authResult.response;
    const { tenantId, role, userId } = authResult.context;
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const from = fromStr ? new Date(fromStr) : null;
    const to = toStr ? new Date(`${toStr}T23:59:59`) : null;

    // Customer by id or code, tenant-scoped. Agents limited to their own.
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ id }, { customerCode: id }],
        tenantId,
        ...(role === 'agent' ? buildAgentCustomerAccessWhere({ userId }) : {}),
      },
      select: { id: true, name: true, customerCode: true, phone: true, address: true },
    });
    if (!customer) return apiError('Customer not found', 404);

    const entryRows = await prisma.collectionEntry.findMany({
      where: {
        tenantId,
        customerId: customer.id,
        ...(from || to ? { submittedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { submittedAt: 'asc' },
      select: {
        submittedAt: true,
        receivedAmount: true,
        dueAmount: true,
        paymentMode: true,
        loan: { select: { loanCode: true } },
        agent: { select: { name: true } },
      },
    });

    const entries = entryRows.map((e) => ({
      submittedAt: e.submittedAt,
      loanCode: e.loan?.loanCode ?? '—',
      dueAmount: Number(e.dueAmount),
      receivedAmount: Number(e.receivedAmount),
      paymentMode: e.paymentMode,
      agentName: e.agent?.name ?? '—',
    }));

    const branding = await getBranding(tenantId);
    const periodLabel =
      from || to
        ? `${from ? from.toLocaleDateString('en-IN') : '…'} — ${to ? to.toLocaleDateString('en-IN') : '…'}`
        : undefined;

    const buffer = await renderToBuffer(
      createElement(CollectionReceiptPDF, {
        customer,
        entries,
        tenantName: branding.appName,
        branchName: branding.appTagline,
        currencySymbol: branding.currencySymbol,
        periodLabel,
      }) as any,
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="collection-${customer.customerCode}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return apiError(e?.message ?? 'Receipt generation failed', 500);
  }
}
