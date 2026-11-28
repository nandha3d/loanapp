import { NextRequest, NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import prisma from '@/lib/db';
import { fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { buildChitPeriodReportData } from '@/lib/chits/periodReport';
import { ChitPeriodReportPDF } from '@/lib/chits/periodReportPdf';
import { getCurrentLanguage } from '@/lib/i18n';
import { resolvePdfLang } from '@/lib/reports/pdfFonts';
import { getBranding, getSetting } from '@/lib/tenant';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);
  const { id, auctionId } = await params;

  const member = await prisma.chitMember.findFirst({
    where: {
      customerId: borrower.customerId,
      chitGroup: {
        tenantId: borrower.tenantId,
        appType: 'chitfunds',
        deletedAt: null,
        OR: [{ id }, { groupCode: id }],
      },
    },
    select: { chitGroupId: true },
  });
  if (!member) return fail('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const [branding, currencySymbol, tenantLang] = await Promise.all([
    getBranding(borrower.tenantId),
    getSetting(borrower.tenantId, 'currency_symbol', '₹'),
    getCurrentLanguage(borrower.tenantId),
  ]);
  const lang = resolvePdfLang(searchParams.get('lang') ?? tenantLang);

  const data = await buildChitPeriodReportData({
    chitGroupId: member.chitGroupId,
    auctionId,
    scope: {
      tenantId: borrower.tenantId,
      appType: 'chitfunds',
      branchId: null,
      role: 'superadmin',
      userId: null,
    },
    tenantName: branding.appName || 'ZoloFund',
    currencySymbol,
    lang,
  });
  if (!data) return fail('Auction report not found', 404);

  const buffer = await renderToBuffer(createElement(ChitPeriodReportPDF, { data, lang }) as any);
  const safeName = data.group.name.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  const isInline = searchParams.get('inline') === '1' || searchParams.get('preview') === '1';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${safeName || 'chit'}-period-${data.auction.periodNumber}-${lang}-report.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
