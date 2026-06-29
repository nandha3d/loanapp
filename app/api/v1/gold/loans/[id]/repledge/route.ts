import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext, scopedBranchWhere } from '@/lib/api/v1-auth';
import { writeAudit } from '@/lib/audit';

// Bank repledge — re-pledge the gold to a bank for liquidity. List + create.
async function findLoan(id: string, ctx: { tenantId: string; appType: string; branchId: string | null; role: string; userId: string }) {
  return prisma.loan.findFirst({
    where: { id, tenantId: ctx.tenantId, appType: ctx.appType, ...scopedBranchWhere(ctx) },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const { id } = await params;
  const loan = await findLoan(id, auth.context);
  if (!loan) return fail('Loan not found', 404);
  const rows = await prisma.bankRepledge.findMany({
    where: { loanId: loan.id },
    orderBy: { bankDate: 'desc' },
  });
  return ok({ repledges: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;
  if (ctx.role === 'agent') return fail('Forbidden', 403);
  const { id } = await params;

  const loan = await findLoan(id, ctx);
  if (!loan) return fail('Loan not found', 404);

  const body = await req.json().catch(() => ({}));
  const bankName = String(body.bankName || '').trim();
  if (!bankName) return fail('bankName required', 400);

  const row = await prisma.bankRepledge.create({
    data: {
      tenantId: ctx.tenantId,
      loanId: loan.id,
      bankName,
      bankDate: body.bankDate ? new Date(body.bankDate) : new Date(),
      referenceNo: body.referenceNo ?? null,
      amountGivenByBank: Number(body.amountGivenByBank) || 0,
      interestRate: body.interestRate != null ? Number(body.interestRate) : null,
      processingFee: Number(body.processingFee) || 0,
      staffName: body.staffName ?? null,
    },
  });
  await writeAudit({
    tenantId: ctx.tenantId, userId: ctx.userId, action: 'gold_repledge',
    entityType: 'loan', entityId: loan.id, newValue: { bankName, amount: row.amountGivenByBank },
  });
  return ok(row);
}
