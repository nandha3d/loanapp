import { NextRequest, NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ADMIN_API_ROLES, requireApiContext } from '@/lib/apiAuth';
import { requireModule } from '@/lib/moduleGate';
import { getSetting } from '@/lib/tenant';
import { getCurrentLanguage } from '@/lib/i18n';
import { resolvePdfLang } from '@/lib/reports/pdfFonts';
import { buildStatutoryRegisterData } from '@/lib/chits/statutory/builder';
import { StatutoryRegisterPDF } from '@/lib/chits/statutory/pdf';
import { buildStatutoryRegisterExcel } from '@/lib/chits/statutory/excel';
import {
  STATUTORY_REGISTER_TYPES,
  type StatutoryRegisterType,
} from '@/lib/chits/statutory/templates';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { context, response } = await requireApiContext(ADMIN_API_ROLES);
  if (response) return response;

  try {
    await requireModule(context.tenantId, 'chitfunds');
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Module disabled' }, { status: 403 });
  }

  const { id: groupId } = await params;
  const sp = new URL(req.url).searchParams;
  const regParam = (sp.get('register') || 'subscriber-register') as StatutoryRegisterType;
  if (!STATUTORY_REGISTER_TYPES.includes(regParam)) {
    return NextResponse.json({ error: 'Invalid statutory register type' }, { status: 400 });
  }
  const format = sp.get('format')?.toLowerCase() === 'xlsx' ? 'xlsx' : 'pdf';
  const currencySymbol = await getSetting(context.tenantId, 'currency_symbol', '₹');
  const lang = resolvePdfLang(sp.get('lang') ?? (await getCurrentLanguage(context.tenantId)));

  try {
    const dataset = await buildStatutoryRegisterData({
      tenantId: context.tenantId,
      appType: 'chitfunds',
      branchId: context.branchId,
      groupId,
      registerType: regParam,
      currencySymbol,
      lang,
    });

    const baseName = `${dataset.groupSummary.groupCode}-${regParam}-${dataset.meta.stateCode}-${lang}`;

    if (format === 'xlsx') {
      const buf = await buildStatutoryRegisterExcel(dataset);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    const pdfBuf = await renderToBuffer(createElement(StatutoryRegisterPDF, { data: dataset, lang }) as any);
    return new NextResponse(new Uint8Array(pdfBuf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${baseName}.pdf"`,
      },
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed to generate statutory register';
    const status = msg.includes('Enterprise plan') ? 403 : msg.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
