import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { requireApiContext, ADMIN_API_ROLES } from '@/lib/apiAuth';
import { getReportDefinitionForAppType } from '@/lib/reports/catalog';
import type { AppType } from '@/lib/appConfig';
import { toCSV } from '@/lib/reports/csv';
import { toWorkbook } from '@/lib/reports/excel';
import { TableReportPDF } from '@/lib/reports/pdf';
import { getDictionary } from '@/lib/i18n';
import { getBranding, getSetting } from '@/lib/tenant';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const authResult = await requireApiContext(ADMIN_API_ROLES);
    if ('response' in authResult && authResult.response) return authResult.response;
    const context = 'context' in authResult ? authResult.context : (authResult as any);

    const { slug } = await params;
    const definition = getReportDefinitionForAppType(context.appType as AppType, slug);

    if (!definition) {
      return new NextResponse(`Report builder for slug '${slug}' not found`, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';

    const defaultFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = new Date().toISOString().slice(0, 10);

    const from = searchParams.get('from') || defaultFrom;
    const to = searchParams.get('to') || defaultTo;
    const branchId = searchParams.get('branchId') || context.branchId;
    const agentId = searchParams.get('agentId') || undefined;
    const routeId = searchParams.get('routeId') || undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const loanType = searchParams.get('loanType') || undefined;
    const status = searchParams.get('status') || undefined;
    const frequency = searchParams.get('frequency') || undefined;
    const minAmount = searchParams.get('minAmount') ? Number(searchParams.get('minAmount')) : undefined;
    const maxAmount = searchParams.get('maxAmount') ? Number(searchParams.get('maxAmount')) : undefined;
    const paymentMode = searchParams.get('paymentMode') || undefined;
    const paymentStatus = searchParams.get('paymentStatus') || undefined;
    const loanId = searchParams.get('loanId') || undefined;
    const groupId = searchParams.get('groupId') || undefined;

    const payload = await definition.builder({
      tenantId: context.tenantId,
      appType: context.appType,
      from,
      to,
      branchId,
      agentId,
      routeId,
      customerId,
      loanType,
      status,
      frequency,
      minAmount,
      maxAmount,
      paymentMode,
      paymentStatus,
      loanId,
      groupId,
    });

    const dict = await getDictionary(context.tenantId);
    const branding = await getBranding(context.tenantId);
    const currencySymbol = await getSetting(context.tenantId, 'currency_symbol', '₹');

    // Populate metadata for export files
    payload.meta = {
      from,
      to,
      branchName: branding.appTagline || 'All Branches',
      appName: branding.appName || 'LoanTrack',
      currencySymbol,
    };

    if (format === 'csv') {
      const csvStr = toCSV(payload, dict);
      return new NextResponse(csvStr, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${slug}-${from}-to-${to}.csv"`,
        },
      });
    }

    if (format === 'excel') {
      const excelBuffer = await toWorkbook(payload, dict);
      return new NextResponse(new Uint8Array(excelBuffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${slug}-${from}-to-${to}.xlsx"`,
        },
      });
    }

    if (format === 'pdf') {
      const pdfBuffer = await renderToBuffer(
        createElement(TableReportPDF, { payload, dict }) as any
      );
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${slug}-${from}-to-${to}.pdf"`,
        },
      });
    }

    return new NextResponse('Invalid format', { status: 400 });
  } catch (error: any) {
    return new NextResponse(error.message || 'Server Error', { status: 500 });
  }
}
