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
