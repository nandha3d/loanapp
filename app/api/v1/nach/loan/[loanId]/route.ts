import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/api/dualAuth';
import { getMandateForLoan } from '@/lib/nach';
import prisma from '@/lib/db';

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

  // Verify loan belongs to tenant
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId: user.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const mandate = await getMandateForLoan(loanId);
  return NextResponse.json({ ok: true, data: mandate ?? null });
}
