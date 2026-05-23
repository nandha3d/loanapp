import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { requireApiContext, isApiError } from '@/lib/apiAuth';
import { LoanStatementPDF } from '@/lib/loanStatement';
import { getBranding, getTenantSettings } from '@/lib/tenant';
import { apiError } from '@/lib/utils';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext();
    if (isApiError(authResult)) return authResult.response;

    const { tenantId } = authResult.context;
    const { id } = await params;

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

    const loan = await prisma.loan.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        instalments: {
          include: {
            collectionEntry: { select: { id: true } },
          },
          orderBy: { instalmentNo: 'asc' },
        },
        penalties: true,
        createdBy: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });

    if (!loan) return apiError('Loan not found', 404);

    const branding = await getBranding(tenantId);

    const buffer = await renderToBuffer(
      createElement(LoanStatementPDF, {
        loan,
        tenantName: branding.appName,
        currencySymbol: branding.currencySymbol,
        branchName: loan.branch?.name || branding.appTagline,
      }) as any
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="statement-${loan.loanCode}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error: any) {
    return apiError(error.message || 'Internal server error', 500);
  }
}
