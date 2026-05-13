import prisma from './db';

const ACTIVE_PENALTY_STATUSES = ['pending', 'partial'];

type PenaltySyncScope = {
  tenantId?: string;
  appType?: string;
  branchId?: string;
  routeId?: string;
  loanId?: string;
};

type PenaltySyncResult = {
  loansChecked: number;
  penaltiesCreated: number;
  penaltiesUpdated: number;
};

export async function ensurePendingPenaltiesForMissedLoans(
  scope: PenaltySyncScope
): Promise<PenaltySyncResult> {
  const loanWhere: any = {
    status: { in: ['active', 'overdue'] },
    instalments: { some: { status: 'missed' } },
  };

  if (scope.tenantId) loanWhere.tenantId = scope.tenantId;
  if (scope.appType) loanWhere.appType = scope.appType;
  if (scope.branchId) loanWhere.branchId = scope.branchId;
  if (scope.loanId) loanWhere.id = scope.loanId;
  if (scope.routeId) loanWhere.customer = { routeId: scope.routeId };

  const loans = await prisma.loan.findMany({
    where: loanWhere,
    select: {
      id: true,
      customerId: true,
      penaltyRate: true,
      instalments: {
        where: { status: 'missed' },
        select: { id: true },
      },
      penalties: {
        select: {
          id: true,
          missedDays: true,
          grossPenalty: true,
          settledAmount: true,
          waivedAmount: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  let penaltiesCreated = 0;
  let penaltiesUpdated = 0;

  for (const loan of loans) {
    const missedDays = loan.instalments.length;
    const liveGrossPenalty = missedDays * Number(loan.penaltyRate);
    if (missedDays === 0 || liveGrossPenalty <= 0) continue;

    const recordedGross = loan.penalties.reduce(
      (sum, penalty) => sum + Number(penalty.grossPenalty),
      0
    );
    const resolvedTotal = loan.penalties.reduce(
      (sum, penalty) =>
        sum + Number(penalty.settledAmount) + Number(penalty.waivedAmount),
      0
    );
    const activePenalty = loan.penalties.find((penalty) =>
      ACTIVE_PENALTY_STATUSES.includes(penalty.status)
    );
    const outstandingPenalty =
      Math.max(recordedGross, liveGrossPenalty) - resolvedTotal;

    if (outstandingPenalty <= 0) continue;

    if (activePenalty) {
      const grossShortfall = Math.max(0, liveGrossPenalty - recordedGross);
      const nextGrossPenalty =
        Number(activePenalty.grossPenalty) + grossShortfall;
      const shouldUpdate =
        grossShortfall > 0 || activePenalty.missedDays !== missedDays;

      if (shouldUpdate) {
        await prisma.penalty.update({
          where: { id: activePenalty.id },
          data: {
            grossPenalty: nextGrossPenalty,
            missedDays,
          },
        });
        penaltiesUpdated++;
      }
      continue;
    }

    await prisma.penalty.create({
      data: {
        loanId: loan.id,
        customerId: loan.customerId,
        missedDays,
        grossPenalty: outstandingPenalty,
        status: 'pending',
      },
    });
    penaltiesCreated++;
  }

  return {
    loansChecked: loans.length,
    penaltiesCreated,
    penaltiesUpdated,
  };
}
