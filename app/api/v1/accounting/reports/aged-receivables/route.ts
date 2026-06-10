import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { ok, fail } from '@/lib/api/v1-envelope';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import { getAgedReceivables } from '@/lib/accounting/agedReceivables';

const ALLOWED_ROLES = new Set(['admin', 'superadmin', 'developer', 'accountant']);

/**
 * GET /api/v1/accounting/reports/aged-receivables
 *   ?asOf=YYYY-MM-DD   — report date (default today)
 *   ?branchId=...      — optional branch filter
 *   ?format=csv        — CSV download instead of JSON
 */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) return fail('Unauthorized', 401);
  if (!ALLOWED_ROLES.has(actor.role)) return fail('Forbidden', 403);

  if (!(await isPremiumAccountingEnabled(actor.tenantId))) {
    return fail('Premium accounting required', 403);
  }

  const { searchParams } = new URL(req.url);
  const asOfStr = searchParams.get('asOf');
  const asOfDate = asOfStr ? new Date(asOfStr) : new Date();
  if (Number.isNaN(asOfDate.getTime())) return fail('Invalid asOf date', 400);

  const result = await getAgedReceivables({
    tenantId: actor.tenantId,
    asOfDate,
    branchId: searchParams.get('branchId'),
  });

  if (searchParams.get('format') === 'csv') {
    const csv = [
      'Customer,Loan Code,Due Date,Days Overdue,Outstanding,Bucket',
      ...result.rows.map((r) =>
        `"${r.customerName.replace(/"/g, '""')}","${r.loanCode}",` +
        `${r.dueDate.toISOString().slice(0, 10)},${r.daysOverdue},` +
        `${r.outstanding.toFixed(2)},${r.bucket}`,
      ),
    ].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="aged-receivables-${asOfDate.toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return ok(result);
}
