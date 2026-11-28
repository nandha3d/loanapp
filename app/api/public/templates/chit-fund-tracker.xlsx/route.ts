import { NextResponse } from 'next/server';
import { buildPublicChitTrackerWorkbookXlsx } from '@/lib/chits/excelTemplates';

/**
 * Public lead-magnet download (no authentication required):
 * 5-tab formula-driven Chit Fund Tracker Workbook compatible with Excel & Google Sheets.
 */
export async function GET() {
  const buf = await buildPublicChitTrackerWorkbookXlsx();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="ZoloFund-Chit-Fund-Tracker.xlsx"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
