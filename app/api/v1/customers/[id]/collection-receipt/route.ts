import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { getBranding } from '@/lib/tenant';
import { CollectionReceiptPDF, type ReceiptLoan, type ReceiptPayment } from '@/lib/collectionReceipt';

const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/**
 * Mobile (v1) collection passbook PDF — same rendering as the web
 * customer collection-receipt route, but Bearer-token authed so the
 * mobile app can fetch it (the web route only accepts a browser session).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(`${toStr}T23:59:59`) : null;

  const customerWhere: any = {
    OR: [{ id }, { customerCode: id }],
    tenantId: ctx.tenantId,
    appType: ctx.appType,
  };
  if (ctx.role === 'agent') {
    Object.assign(customerWhere, buildAgentCustomerAccessWhere({ userId: ctx.userId }));
  } else {
    Object.assign(customerWhere, scopedBranchWhere(ctx));
  }

  const customer = await prisma.customer.findFirst({
    where: customerWhere,
    select: { id: true, name: true, customerCode: true, phone: true, address: true },
  });
  if (!customer) return fail('Customer not found', 404);

  const loanRows = await prisma.loan.findMany({
    where: { tenantId: ctx.tenantId, customerId: customer.id },
    orderBy: { startDate: 'asc' },
    select: {
      loanCode: true,
      principal: true,
      totalPayable: true,
      collectionEntries: {
        select: { submittedAt: true, receivedAmount: true, paymentMode: true, agent: { select: { name: true } } },
        orderBy: { submittedAt: 'asc' },
      },
    },
  });

  const inPeriod = (d: Date) => (!from || d >= from) && (!to || d <= to);

  const loans: ReceiptLoan[] = loanRows.map((loan) => {
    const totalPayable = Number(loan.totalPayable ?? loan.principal);

    const paidByDate = new Map<string, { paid: number; mode: string; by: string }>();
    for (const e of loan.collectionEntries) {
      if (!inPeriod(new Date(e.submittedAt))) continue;
      const k = dayKey(e.submittedAt);
      const cur = paidByDate.get(k) ?? { paid: 0, mode: e.paymentMode, by: e.agent?.name ?? '' };
      cur.paid += Number(e.receivedAmount);
      paidByDate.set(k, cur);
    }

    let cumulativePaid = 0;
    const payments: ReceiptPayment[] = Array.from(paidByDate.keys())
      .sort()
      .map((k) => {
        const g = paidByDate.get(k)!;
        cumulativePaid += g.paid;
        return {
          date: k,
          amount: g.paid,
          mode: g.mode,
          balance: Math.max(0, totalPayable - cumulativePaid),
          collectedBy: g.by,
        };
      });

    return {
      loanCode: loan.loanCode,
      principal: Number(loan.principal),
      totalPayable,
      totalPaid: cumulativePaid,
      payments,
    };
  });

  const branding = await getBranding(ctx.tenantId);
  const periodLabel =
    from || to
      ? `${from ? from.toLocaleDateString('en-IN') : '…'} — ${to ? to.toLocaleDateString('en-IN') : '…'}`
      : undefined;

  const buffer = await renderToBuffer(
    createElement(CollectionReceiptPDF, {
      customer,
      loans,
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
}
