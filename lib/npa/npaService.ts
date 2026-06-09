import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { getTenantProvisioningSummary } from '@/lib/npa/provisioningCalculator';
import { checkUpgradeEligibility, upgradeNpaToStandard } from '@/lib/npa/npaUpgrade';

const NPA_ROLES = new Set(['admin', 'superadmin']);
const NPA_CATEGORIES = ['sma_0', 'sma_1', 'sma_2', 'sub_standard', 'doubtful_d1', 'doubtful_d2', 'doubtful_d3', 'loss'];

export type NpaActor = {
  tenantId: string;
  userId: string;
  role: string;
  branchId?: string | null;
  appType?: string | null;
};

export class NpaServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'NpaServiceError';
  }
}

export async function assertNpaAccess(actor: NpaActor): Promise<void> {
  if (!NPA_ROLES.has(actor.role)) {
    throw new NpaServiceError('Forbidden', 403);
  }

  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: actor.tenantId },
    select: { npaEnabled: true },
  });

  if (!subscription?.npaEnabled) {
    throw new NpaServiceError('NPA Classification module is not enabled for your subscription.', 403);
  }
}

export async function getNpaSummary(actor: NpaActor, input: { asOfDate?: Date | string | null } = {}) {
  await assertNpaAccess(actor);
  const asOfDate = input.asOfDate ? new Date(input.asOfDate) : new Date();
  const summary = await getTenantProvisioningSummary(actor.tenantId, asOfDate);

  const npaOutstanding =
    summary.sub_standard.outstanding +
    summary.doubtful.outstanding +
    summary.loss.outstanding;
  const grossNpaRatio =
    summary.total.outstanding > 0
      ? (npaOutstanding / summary.total.outstanding) * 100
      : 0;

  return {
    ...summary,
    grossNpaRatio: Math.round(grossNpaRatio * 100) / 100,
    asOfDate: asOfDate.toISOString(),
  };
}

export async function listNpaLoans(
  actor: NpaActor,
  input: { category?: string | null; page?: number | string | null; pageSize?: number | string | null } = {},
) {
  await assertNpaAccess(actor);

  const page = Math.max(1, Number(input.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize || 20) || 20));
  const where: Prisma.LoanWhereInput = {
    tenantId: actor.tenantId,
    deletedAt: null,
  };

  if (input.category) {
    where.npaStatus = input.category;
  } else {
    where.npaStatus = { in: NPA_CATEGORIES };
  }

  const [loans, total] = await prisma.$transaction([
    prisma.loan.findMany({
      where,
      select: {
        id: true,
        loanCode: true,
        npaStatus: true,
        npaSubCategory: true,
        npaDaysOverdue: true,
        npaClassifiedAt: true,
        provisioningAmount: true,
        provisioningRate: true,
        npaUpgradeEligible: true,
        lastNpaReviewDate: true,
        totalPayable: true,
        totalCollected: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { npaDaysOverdue: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.loan.count({ where }),
  ]);

  return {
    data: loans.map((loan) => ({
      ...loan,
      outstandingAmount: Number(loan.totalPayable) - Number(loan.totalCollected),
    })),
    total,
    page,
    pageSize,
  };
}

export async function getNpaHistory(actor: NpaActor, input: { loanId?: string | null }) {
  await assertNpaAccess(actor);
  const loanId = input.loanId;
  if (!loanId) throw new NpaServiceError('loanId query param is required', 400);

  await assertTenantLoan(actor.tenantId, loanId);

  return prisma.npaHistory.findMany({
    where: { loanId, tenantId: actor.tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fromCategory: true,
      toCategory: true,
      daysOverdue: true,
      outstandingAmt: true,
      triggeredBy: true,
      triggeredById: true,
      notes: true,
      provisioningRate: true,
      provisioningAmount: true,
      createdAt: true,
    },
  });
}

export async function getNpaUpgradeEligibility(actor: NpaActor, input: { loanId?: string | null }) {
  await assertNpaAccess(actor);
  const loanId = input.loanId;
  if (!loanId) throw new NpaServiceError('loanId query param is required', 400);

  await assertTenantLoan(actor.tenantId, loanId);
  return checkUpgradeEligibility(loanId);
}

export async function upgradeNpaLoan(
  actor: NpaActor,
  input: { loanId?: string | null; notes?: string | null },
) {
  await assertNpaAccess(actor);
  const loanId = input.loanId;
  if (!loanId) throw new NpaServiceError('loanId is required', 400);

  await assertTenantLoan(actor.tenantId, loanId);
  try {
    await upgradeNpaToStandard(loanId, actor.userId, actor.tenantId, input.notes ?? '');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'NPA upgrade failed';
    throw new NpaServiceError(message, message.startsWith('UPGRADE_NOT_ELIGIBLE') ? 400 : 500);
  }
}

async function assertTenantLoan(tenantId: string, loanId: string): Promise<void> {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, tenantId },
    select: { id: true },
  });
  if (!loan) throw new NpaServiceError('Loan not found', 404);
}
