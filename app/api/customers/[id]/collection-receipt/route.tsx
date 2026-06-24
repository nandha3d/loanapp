import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { requireApiContext, isApiError } from '@/lib/apiAuth';
import { buildAgentCustomerAccessWhere } from '@/lib/loanPolicy';
import { getBranding } from '@/lib/tenant';
import { apiError } from '@/lib/utils';
import { CollectionReceiptPDF, type ReceiptLoan, type ReceiptLedgerRow } from '@/lib/collectionReceipt';

const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/**
 * Customer collection receipt PDF — a day-wise passbook per loan. Each row is a
 * date: what was due, what was ACTUALLY paid that day (payments grouped by date,
 * never back-distributed across instalments; 0 on unpaid days) and the running
 * balance. Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD to bound the period.
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

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ id }, { customerCode: id }],
        tenantId,
        ...(role === 'agent' ? buildAgentCustomerAccessWhere({ userId }) : {}),
      },
      select: { id: true, name: true, customerCode: true, phone: true, address: true },
    });
    if (!customer) return apiError('Customer not found', 404);

    const loanRows = await prisma.loan.findMany({
      where: { tenantId, customerId: customer.id },
      orderBy: { startDate: 'asc' },
      select: {
        loanCode: true,
        principal: true,
        totalPayable: true,
        instalments: { select: { dueDate: true, dueAmount: true }, orderBy: { dueDate: 'asc' } },
        collectionEntries: {
          select: { submittedAt: true, receivedAmount: true, paymentMode: true, agent: { select: { name: true } } },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    const inPeriod = (d: Date) => (!from || d >= from) && (!to || d <= to);

    const loans: ReceiptLoan[] = loanRows.map((loan) => {
      const totalPayable = Number(loan.totalPayable ?? loan.principal);

      // Actual payments grouped by calendar date (NOT split per instalment).
      const paidByDate = new Map<string, { paid: number; mode: string; by: string }>();
      for (const e of loan.collectionEntries) {
        if (!inPeriod(new Date(e.submittedAt))) continue;
        const k = dayKey(e.submittedAt);
        const cur = paidByDate.get(k) ?? { paid: 0, mode: e.paymentMode, by: e.agent?.name ?? '' };
        cur.paid += Number(e.receivedAmount);
        paidByDate.set(k, cur);
      }

      // Due amounts by scheduled date.
      const dueByDate = new Map<string, number>();
      for (const i of loan.instalments) {
        const k = dayKey(i.dueDate);
        dueByDate.set(k, (dueByDate.get(k) ?? 0) + Number(i.dueAmount));
      }

      // One row per date — union of schedule dates and actual payment dates.
      const allKeys = Array.from(new Set([...dueByDate.keys(), ...paidByDate.keys()])).sort();
      let cumulativePaid = 0;
      const rows: ReceiptLedgerRow[] = allKeys.map((k) => {
        const paid = paidByDate.get(k)?.paid ?? 0;
        cumulativePaid += paid;
        return {
          date: k,
          due: dueByDate.get(k) ?? 0,
          paid,
          balance: Math.max(0, totalPayable - cumulativePaid),
          mode: paidByDate.get(k)?.mode ?? '',
          collectedBy: paidByDate.get(k)?.by ?? '',
        };
      });

      return {
        loanCode: loan.loanCode,
        principal: Number(loan.principal),
        totalPayable,
        totalPaid: cumulativePaid,
        rows,
      };
    });

    const branding = await getBranding(tenantId);
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
  } catch (e: any) {
    return apiError(e?.message ?? 'Receipt generation failed', 500);
  }
}
