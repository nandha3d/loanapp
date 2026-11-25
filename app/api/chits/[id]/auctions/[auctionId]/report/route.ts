import { NextRequest, NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireApiContext } from '@/lib/apiAuth';
import { canCollectChits } from '@/lib/chits/access';
import { buildChitPeriodReportData } from '@/lib/chits/periodReport';
import { ChitPeriodReportPDF } from '@/lib/chits/periodReportPdf';
import { STANDARD_CASH_DENOMINATIONS } from '@/lib/chits/payout';
import { getCurrentLanguage } from '@/lib/i18n';
import { requireModule } from '@/lib/moduleGate';
import { resolvePdfLang } from '@/lib/reports/pdfFonts';
import { getBranding, getSetting } from '@/lib/tenant';

function parseDenominations(searchParams: URLSearchParams): Record<number, number> {
  const out: Record<number, number> = {};
  for (const denom of STANDARD_CASH_DENOMINATIONS) {
    const raw = searchParams.get(`d${denom}`);
    if (raw != null) {
      const n = Math.floor(Number(raw));
      if (Number.isFinite(n) && n >= 0) out[denom] = n;
    }
  }
  return out;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const { context, response } = await requireApiContext(['admin', 'superadmin', 'developer']);
  if (response) return response;

  const { tenantId, branchId, role, userId } = context;
  if (!canCollectChits(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    await requireModule(tenantId, 'chitfunds');
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Module disabled' }, { status: 403 });
  }

  const { id: chitGroupId, auctionId } = await params;
  const { searchParams } = new URL(req.url);
  const cashDenominations = parseDenominations(searchParams);

  const [branding, currencySymbol, tenantLang] = await Promise.all([
    getBranding(tenantId),
    getSetting(tenantId, 'currency_symbol', '₹'),
    getCurrentLanguage(tenantId),
  ]);
  const lang = resolvePdfLang(searchParams.get('lang') ?? tenantLang);

  const data = await buildChitPeriodReportData({
    chitGroupId,
    auctionId,
    scope: { tenantId, appType: 'chitfunds', branchId, role, userId },
    tenantName: branding.appName || 'ZoloFund',
    currencySymbol,
    cashDenominations,
    lang,
  });

  if (!data) {
    return NextResponse.json({ error: 'Chit auction not found' }, { status: 404 });
  }

  const buffer = await renderToBuffer(createElement(ChitPeriodReportPDF, { data, lang }) as any);
  const safeName = data.group.name.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  const fileName = `${safeName || 'chit'}-period-${data.auction.periodNumber}-${lang}-report.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
