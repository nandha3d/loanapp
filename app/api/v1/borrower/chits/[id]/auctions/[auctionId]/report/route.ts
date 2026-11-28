import { NextRequest, NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import prisma from '@/lib/db';
import { fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { buildChitPeriodReportData, resolveChitPdfBranding } from '@/lib/chits/periodReport';
import { ChitPeriodReportPDF } from '@/lib/chits/periodReportPdf';
import { resolvePdfLang } from '@/lib/reports/pdfFonts';

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
  const brandCtx = await resolveChitPdfBranding(borrower.tenantId);
  const lang = resolvePdfLang(searchParams.get('lang') ?? brandCtx.defaultLang);

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
    tenantName: brandCtx.tenantName,
    currencySymbol: brandCtx.currencySymbol,
    lang,
    theme: brandCtx.theme,
    logoDataUri: brandCtx.logoDataUri,
    companyAddress: brandCtx.companyAddress,
    companyPhone: brandCtx.companyPhone,
    companyEmail: brandCtx.companyEmail,
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
