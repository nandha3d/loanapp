import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireBorrowerMobileContext } from '@/lib/api/borrower-mobile';
import { getMyChitMemberships } from '@/lib/chits/customerPortal';

// One-call portal summary for the mobile customer app: which modules this
// customer actually belongs to, plus their chit memberships. The client
// routes on `modules` instead of assuming every customer is a loan borrower.
export async function GET(req: NextRequest) {
  const ctx = await requireBorrowerMobileContext(req);
  if (!ctx) return fail('Unauthorized', 401);

  try {
    const [loanCount, chitMemberships] = await Promise.all([
      prisma.loan.count({
        where: { customerId: ctx.customerId, tenantId: ctx.tenantId, deletedAt: null },
      }),
      getMyChitMemberships(ctx.customerId, ctx.tenantId),
    ]);

    return ok({
      modules: { loans: loanCount, chits: chitMemberships.length },
      chitMemberships,
    });
  } catch (e: any) {
    return fail(e?.message ?? 'Failed to load borrower portal', 500);
  }
}
