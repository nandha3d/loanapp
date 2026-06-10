import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { fail } from '@/lib/api/v1-envelope';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import { generateTallyXml, generateTallyLedgersXml } from '@/lib/accounting/tallyExport';

const ALLOWED_ROLES = new Set(['admin', 'superadmin', 'developer', 'accountant']);

/**
 * GET /api/v1/accounting/export/tally
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD          → Vouchers XML
 *   ?type=ledgers                            → Ledger masters XML
 *
 * Import order in TallyPrime: ledgers first, then vouchers.
 */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) return fail('Unauthorized', 401);
  if (!ALLOWED_ROLES.has(actor.role)) return fail('Forbidden', 403);

  if (!(await isPremiumAccountingEnabled(actor.tenantId))) {
    return fail('Premium accounting required', 403);
  }

  const { searchParams } = new URL(req.url);

  if (searchParams.get('type') === 'ledgers') {
    const xml = await generateTallyLedgersXml(actor.tenantId);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tally-ledgers.xml"',
      },
    });
  }

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : defaultFrom;
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return fail('Invalid from/to date', 400);
  }

  const { xml, voucherCount } = await generateTallyXml({
    tenantId: actor.tenantId,
    fromDate: from,
    toDate: to,
    status: searchParams.get('status') ?? 'posted',
  });

  const filename = `tally-vouchers-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.xml`;
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Voucher-Count': String(voucherCount),
    },
  });
}
