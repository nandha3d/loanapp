import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { LoanStatementPDF } from '@/lib/loanStatement';
import { getBranding, getTenantSettings } from '@/lib/tenant';

// Borrower-facing loan statement PDF. Shared by the web borrower portal route
// (cookie session) and the mobile borrower route (Bearer JWT) — the loan must
// belong to BOTH the tenant and the requesting customer.
export async function renderBorrowerLoanStatement(params: {
  tenantId: string;
  customerId: string;
  loanId: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  const { tenantId, customerId, loanId } = params;

  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!sub || !sub.receiptPdfAllowed) {
    throw new Error('Statement downloads are not enabled for this account.');
  }
  const settings = await getTenantSettings(tenantId);
  if (settings.receipt_pdf_active !== 'true') {
    throw new Error('Statement downloads are currently disabled.');
  }

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId, customerId },
    include: {
      customer: true,
      instalments: {
        include: { collectionEntry: { select: { id: true } } },
        orderBy: { instalmentNo: 'asc' },
      },
      penalties: true,
      createdBy: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  if (!loan) throw new Error('Loan not found');

  const branding = await getBranding(tenantId);
  const buffer = await renderToBuffer(
    createElement(LoanStatementPDF, {
      loan,
      tenantName: branding.appName,
      currencySymbol: branding.currencySymbol,
      branchName: loan.branch?.name || branding.appTagline,
    }) as any,
  );
  return { buffer: Buffer.from(buffer), filename: `statement-${loan.loanCode}.pdf` };
}
