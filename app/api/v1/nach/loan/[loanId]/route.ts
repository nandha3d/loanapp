import { isFeatureEnabled } from '@/lib/featureGate';
import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { getMandateForLoan } from '@/lib/nach';
import prisma from '@/lib/db';
import { loanAccessWhere } from '@/lib/loanPolicy';

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'developer', 'agent']);

/** GET /api/v1/nach/loan/[loanId] — get mandate for a specific loan */
export async function GET(req: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  const user = await resolveActor(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { loanId } = await params;

  // Verify caller can see the loan (tenant, module, branch / agent linkage)
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, ...loanAccessWhere(user), deletedAt: null },
    select: { id: true },
  });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  // Not a 403: clients render a locked state from `isSubscribed: false`. eNACH is
  // a plan feature, so without it no mandate is exposed (the write routes 403).
  const nachEnabled = await isFeatureEnabled(user.tenantId, 'nachEnabled');
  const mandate = nachEnabled ? await getMandateForLoan(loanId) : null;
  return NextResponse.json({ ok: true, data: mandate ?? null, isSubscribed: nachEnabled, enabled: nachEnabled });
}
