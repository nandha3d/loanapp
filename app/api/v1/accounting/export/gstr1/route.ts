import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { ok, fail } from '@/lib/api/v1-envelope';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import { generateGstr1Csv, getGstr1Rows } from '@/lib/accounting/gstExport';

const ALLOWED_ROLES = new Set(['admin', 'superadmin', 'developer', 'accountant']);

/**
 * GET /api/v1/accounting/export/gstr1?month=6&year=2026
 *   default: current month. `?format=json` returns rows for preview;
 *   otherwise downloads the GSTR-1 CSV.
 */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) return fail('Unauthorized', 401);
  if (!ALLOWED_ROLES.has(actor.role)) return fail('Forbidden', 403);

  if (!(await isPremiumAccountingEnabled(actor.tenantId))) {
    return fail('Premium accounting required', 403);
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = Math.min(12, Math.max(1, parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10) || now.getMonth() + 1));
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()), 10) || now.getFullYear();

  if (searchParams.get('format') === 'json') {
    return ok(await getGstr1Rows({ tenantId: actor.tenantId, month, year }));
  }

  const csv = await generateGstr1Csv({ tenantId: actor.tenantId, month, year });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="GSTR1-${year}-${String(month).padStart(2, '0')}.csv"`,
    },
  });
}
