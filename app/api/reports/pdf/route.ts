import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { requireApiContext } from '@/lib/apiAuth';
import { CollectionReportPDF } from '@/lib/reports/pdf';
import { getBranding, getSetting } from '@/lib/tenant';
import { buildReportData } from '@/lib/reports/data';

export async function GET(req: NextRequest) {
  const { context, response } = await requireApiContext(['admin', 'superadmin', 'developer']);
  if (response) return response;

  const { tenantId, appType, branchId } = context;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to   = searchParams.get('to')   || new Date().toISOString().slice(0, 10);

  const reportData = await buildReportData({
    tenantId,
    appType,
    from,
    to,
    branchId,
  });

  const branding   = await getBranding(tenantId);
  const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');

  const buffer = await renderToBuffer(createElement(CollectionReportPDF, {
    data: {
      ...reportData,
      from, to,
      appName:    branding.appName,
      branchName: branding.appTagline,
      currencySymbol,
    },
  }) as any);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="report-${from}-to-${to}.pdf"`,
    },
  });
}
