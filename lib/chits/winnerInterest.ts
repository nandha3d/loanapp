import { roundMoney } from './calculations';
import type { ChitWinnerInterestType } from './types';

export type WinnerInterestConfig = {
  winnerInterestType?: string | null;
  winnerInterestValue?: number | string | null;
  winnerInterestPeriods?: number | null;
  chitValue: number;
  totalMembers: number;
};

export function winnerInterestPerPeriod(config: WinnerInterestConfig): number {
  const type = (config.winnerInterestType ?? 'NONE') as ChitWinnerInterestType;
  const value = Number(config.winnerInterestValue ?? 0);
  if (type === 'NONE' || value <= 0) return 0;
  if (type === 'FIXED') return roundMoney(value);
  if (type === 'PERCENT') return roundMoney((config.chitValue * value) / 100);
  return 0;
}

export function winnerInterestWindow(config: WinnerInterestConfig, wonPeriodNumber: number) {
  const periods = Math.max(0, Math.trunc(Number(config.winnerInterestPeriods ?? 0)));
  if (periods <= 0) return { fromPeriod: wonPeriodNumber + 1, toPeriod: wonPeriodNumber, periods: 0 };
  const fromPeriod = wonPeriodNumber + 1;
  const toPeriod = Math.min(config.totalMembers, wonPeriodNumber + periods);
  return { fromPeriod, toPeriod, periods: Math.max(0, toPeriod - fromPeriod + 1) };
}

export async function applyWinnerInterest(tx: any, params: {
  chitGroupId: string;
  winnerMemberId: string;
  wonPeriodNumber: number;
  group: WinnerInterestConfig;
}) {
  const amount = winnerInterestPerPeriod(params.group);
  const window = winnerInterestWindow(params.group, params.wonPeriodNumber);
  if (amount <= 0 || window.periods <= 0) {
    return { amount: 0, updated: 0, ...window };
  }

  const result = await tx.chitSubscription.updateMany({
    where: {
      memberId: params.winnerMemberId,
      periodNumber: { gte: window.fromPeriod, lte: window.toPeriod },
      status: { not: 'paid' },
      member: { chitGroupId: params.chitGroupId },
    },
    data: {
      interestAmount: { increment: amount },
      dueAmount: { increment: amount },
    },
  });

  return { amount, updated: result.count ?? 0, ...window };
}
