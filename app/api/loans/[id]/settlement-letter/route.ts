import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import prisma from '@/lib/db';
import { ADMIN_API_ROLES, isApiError, requireApiContext } from '@/lib/apiAuth';
import { calculateForeclosure } from '@/lib/foreclosure';
import { SettlementLetterPDF } from '@/lib/settlementLetter';
import { getBranding } from '@/lib/tenant';
import { apiError } from '@/lib/utils';
import { auth } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if (isApiError(authResult)) return authResult.response;

    const { tenantId } = authResult.context;
    const { id } = await params;

    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { foreclosureEnabled: true },
    });

    if (!subscription?.foreclosureEnabled) {
      return apiError('Preclose & Early Settlement add-on is not active under your plan subscription.', 403);
    }

    const { searchParams } = new URL(req.url);
    const discount = Math.max(0, Number(searchParams.get('discount') || '0'));
    const calculation = await calculateForeclosure(id, tenantId, Number.isFinite(discount) ? discount : 0);

    if (!calculation.canForeclose) {
      return apiError(calculation.reason || 'Cannot generate settlement letter for this loan.', 400);
    }

    const branding = await getBranding(tenantId);
    const session = await auth();
    const adminName = (session?.user as any)?.name || 'Authorised Signatory';

    const buffer = await renderToBuffer(
      createElement(SettlementLetterPDF, {
        calc: calculation,
        appName: branding.appName,
        branchName: branding.appTagline || '',
        adminName,
        currencySymbol: branding.currencySymbol || '₹',
      }) as any
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="settlement-${calculation.loanCode}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    const message = error.message || 'Failed to generate settlement letter';
    return apiError(message, message === 'Loan not found' ? 404 : 500);
  }
}
