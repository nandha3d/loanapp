import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { getMyChitContributionsGrouped, getMyChitReceipts } from '@/lib/chits/customerPortal';

// Current/overdue/upcoming/history grouped contributions for the mobile
// borrower app — mirrors app/borrower/chits/page.tsx's web grouping (doc 22b).
export async function GET(req: NextRequest) {
  const borrower = await requireBorrowerMobileContext(req);
  if (!borrower) return fail('Unauthorized', 401);

  const [groups, receipts] = await Promise.all([
    getMyChitContributionsGrouped(borrower.customerId, borrower.tenantId),
    getMyChitReceipts(borrower.customerId, borrower.tenantId),
  ]);
  return ok({ groups, receipts });
}
