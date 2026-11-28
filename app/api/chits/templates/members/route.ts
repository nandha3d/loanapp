import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext, AUTHENTICATED_API_ROLES } from '@/lib/apiAuth';
import {
  buildChitMembersTemplateCsv,
  buildChitMembersTemplateXlsx,
} from '@/lib/chits/excelTemplates';

export async function GET(req: NextRequest) {
  const { response } = await requireApiContext(AUTHENTICATED_API_ROLES);
  if (response) return response;

  const format = new URL(req.url).searchParams.get('format')?.toLowerCase() === 'csv' ? 'csv' : 'xlsx';
  if (format === 'csv') {
    const csv = buildChitMembersTemplateCsv();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="chit-members-template.csv"',
      },
    });
  }

  const buf = await buildChitMembersTemplateXlsx();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="chit-members-template.xlsx"',
    },
  });
}
