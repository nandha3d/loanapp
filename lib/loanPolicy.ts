type LoanRole = string | undefined | null;

type LoanNumericInputs = {
  principal: number;
  rate: number;
  tenure: number;
  penaltyRate: number;
};

type LoanDetailWhereInput = {
  loanId: string;
  tenantId: string;
  appType: string;
  branchId?: string | null;
  role?: LoanRole;
  userId?: string | null;
};

export function canCreateLoanForRole(role: LoanRole): boolean {
  return role === 'admin' || role === 'superadmin' || role === 'developer';
}

export function validateLoanNumericInputs(input: LoanNumericInputs): { valid: true } | { valid: false; error: string } {
  const { principal, rate, tenure, penaltyRate } = input;

  if (!Number.isFinite(principal) || principal <= 0) {
    return { valid: false, error: 'Principal must be greater than zero.' };
  }
  if (!Number.isFinite(rate) || rate < 0) {
    return { valid: false, error: 'Deduction or interest rate cannot be negative.' };
  }
  if (!Number.isInteger(tenure) || tenure <= 0) {
    return { valid: false, error: 'Tenure must be a positive whole number.' };
  }
  if (!Number.isFinite(penaltyRate) || penaltyRate < 0) {
    return { valid: false, error: 'Penalty rate cannot be negative.' };
  }

  return { valid: true };
}

export function buildLoanDetailWhere(input: LoanDetailWhereInput) {
  const where: any = {
    loanCode: input.loanId,
    tenantId: input.tenantId,
    appType: input.appType,
  };

  if (input.branchId) {
    where.branchId = input.branchId;
  }

  if (input.role === 'agent') {
    if (!input.userId) {
      where.customer = { id: '__unauthorized_agent__' };
      return where;
    }

    where.customer = {
      OR: [
        { agentId: input.userId },
        { route: { assignedAgentId: input.userId } },
        { route: { routeAgents: { some: { agentId: input.userId } } } },
      ],
    };
  }

  return where;
}
