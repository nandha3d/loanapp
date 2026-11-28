import { NextResponse } from 'next/server';
import { requireApiContext, ADMIN_API_ROLES } from '@/lib/apiAuth';
import { buildRunningChitMigrationTemplateXlsx } from '@/lib/chits/excelTemplates';

export async function GET() {
  const { response } = await requireApiContext(ADMIN_API_ROLES);
  if (response) return response;

  const buf = await buildRunningChitMigrationTemplateXlsx();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="running-chit-migration-template.xlsx"',
    },
  });
}
