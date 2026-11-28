import { NextRequest, NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import prisma from '@/lib/db';
import { getBorrowerSession } from '@/lib/borrowerAuth';
import { buildChitPeriodReportData, resolveChitPdfBranding } from '@/lib/chits/periodReport';
import { ChitPeriodReportPDF } from '@/lib/chits/periodReportPdf';
import { resolvePdfLang } from '@/lib/reports/pdfFonts';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> },
) {
  const session = await getBorrowerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, auctionId } = await params;

  const member = await prisma.chitMember.findFirst({
    where: {
      customerId: session.customerId,
      chitGroup: {
        tenantId: session.tenantId,
        appType: 'chitfunds',
        deletedAt: null,
        OR: [{ id }, { groupCode: id }],
      },
    },
    select: { chitGroupId: true },
  });
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const brandCtx = await resolveChitPdfBranding(session.tenantId);
  const lang = resolvePdfLang(searchParams.get('lang') ?? brandCtx.defaultLang);

  const data = await buildChitPeriodReportData({
    chitGroupId: member.chitGroupId,
    auctionId,
    scope: {
      tenantId: session.tenantId,
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

  if (!data) return NextResponse.json({ error: 'Auction report not found' }, { status: 404 });

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
