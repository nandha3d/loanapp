import { isInterestOnly } from './loanCalculator';

export const LOAN_PRECLOSE_REQUEST = 'loan_preclose';
export const AGENT_PRECLOSE_FLAG = 'agent_preclose_requests_enabled';

export function canRequestLoanPreclose(role: string, appType: string, enabled: boolean) {
  return role === 'agent' && appType === 'microlending' && enabled;
}

export function isPrecloseRequestLoan(loan: { status: string; deductionType: string }) {
  return (loan.status === 'active' || loan.status === 'overdue') && !isInterestOnly(loan.deductionType);
}

export function precloseOutstanding(loan: { totalPayable: unknown; totalCollected: unknown }) {
  return Math.round(Math.max(0, Number(loan.totalPayable) - Number(loan.totalCollected)) * 100) / 100;
}

export function isValidPrecloseAmount(amount: unknown, outstanding: number) {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount === outstanding;
}
