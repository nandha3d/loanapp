import { NextRequest, NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { canCollectChits } from '@/lib/chits/access';
import { buildChitPeriodReportData } from '@/lib/chits/periodReport';
import { ChitPeriodReportPDF } from '@/lib/chits/periodReportPdf';
import { getBranding, getSetting } from '@/lib/tenant';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (!canCollectChits(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: chitGroupId, auctionId } = await params;
  const [branding, currencySymbol] = await Promise.all([
    getBranding(ctx.tenantId),
    getSetting(ctx.tenantId, 'currency_symbol', '₹'),
  ]);

  const data = await buildChitPeriodReportData({
    chitGroupId,
    auctionId,
    scope: {
      tenantId: ctx.tenantId,
      appType: 'chitfunds',
      branchId: ctx.branchId,
      role: ctx.role,
      userId: ctx.userId,
    },
    tenantName: branding.appName || 'ZoloFund',
    currencySymbol,
  });

  if (!data) {
    return NextResponse.json({ error: 'Chit auction not found' }, { status: 404 });
  }

  const buffer = await renderToBuffer(createElement(ChitPeriodReportPDF, { data }) as any);
  const safeName = data.group.name.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  const fileName = `${safeName || 'chit'}-period-${data.auction.periodNumber}-report.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
