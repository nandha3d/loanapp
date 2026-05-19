export const COLLECTIBLE_LOAN_STATUSES = ['active', 'overdue'] as const;

export function canCollectForLoanStatus(status: string | null | undefined): boolean {
  return COLLECTIBLE_LOAN_STATUSES.includes(status as (typeof COLLECTIBLE_LOAN_STATUSES)[number]);
}

export function getCollectionSubmissionBlockReason(input: {
  loanStatus: string | null | undefined;
  dueAmount: number;
  receivedAmount: number;
}): string | null {
  if (!canCollectForLoanStatus(input.loanStatus)) {
    return 'Loan is closed for collection';
  }

  if (input.receivedAmount >= input.dueAmount) {
    return 'Instalment is already fully collected';
  }

  return null;
}

function normalizeAmount(value: number): string {
  return Number(value).toFixed(2);
}

export function buildCollectionIdempotencyKey(input: {
  tenantId: string;
  agentId: string;
  instalmentId: string;
  receivedAmount: number;
  paymentMode: string;
  collectionDate: Date | string;
}): string {
  const date = input.collectionDate instanceof Date
    ? input.collectionDate.toISOString().slice(0, 10)
    : String(input.collectionDate).slice(0, 10);
  return [
    input.tenantId,
    input.agentId,
    input.instalmentId,
    normalizeAmount(input.receivedAmount),
    input.paymentMode.trim().toLowerCase(),
    date,
  ].join(':');
}
