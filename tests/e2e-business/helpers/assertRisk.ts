import assert from 'node:assert/strict';
import { money, assertMoneyEqual } from './assertMoney';
import { getPrisma } from './testDb';

export async function makeFirstInstalmentsOverdue(loanId: string, daysAgo: number, count = 1) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() - daysAgo);
  dueDate.setHours(0, 0, 0, 0);
  const instalments = await getPrisma().instalment.findMany({
    where: { loanId },
    orderBy: { instalmentNo: 'asc' },
    take: count,
  });
  await getPrisma().instalment.updateMany({
    where: { id: { in: instalments.map((instalment) => instalment.id) } },
    data: { dueDate, status: 'upcoming', receivedAmount: 0 },
  });
  return instalments.map((instalment) => instalment.id);
}

export async function activePenaltyTotal(loanId: string) {
  const penalties = await getPrisma().penalty.findMany({
    where: { loanId, status: { in: ['pending', 'partial'] } },
  });
  return penalties.reduce((sum, penalty) => sum + money(penalty.grossPenalty) - money(penalty.settledAmount) - money(penalty.waivedAmount), 0);
}

export async function assertPenaltyNetDue(loanId: string, expected: number, label: string) {
  assertMoneyEqual(await activePenaltyTotal(loanId), expected, label);
}

export async function assertLoanNotActiveCollectible(loanId: string) {
  const loan = await getPrisma().loan.findUnique({ where: { id: loanId }, select: { status: true } });
  assert.ok(loan, 'loan exists');
  assert.notEqual(['active', 'overdue'].includes(loan.status), true, 'loan should not be active collectible');
}

export function assertBucket(actual: string | null | undefined, expected: string, label: string) {
  assert.equal(actual, expected, label);
}
