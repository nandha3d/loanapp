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

type AgentCustomerAccessInput = {
  userId?: string | null;
};

type CustomerAgentScope = {
  agentId?: string | null;
  routeId?: string | null;
};

export function canCreateLoanForRole(role: LoanRole): boolean {
  return role === 'agent' || role === 'admin' || role === 'superadmin' || role === 'developer';
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

export function buildAgentCustomerAccessWhere(input: AgentCustomerAccessInput) {
  if (!input.userId) return { id: '__unauthorized_agent__' };

  return {
    OR: [
      { agentId: input.userId },
      { route: { assignedAgentId: input.userId } },
      { route: { routeAgents: { some: { agentId: input.userId } } } },
    ],
  };
}

export function canAgentAccessCustomer(
  customer: CustomerAgentScope,
  agentRouteIds: string[],
  userId?: string | null,
): boolean {
  if (!userId) return false;
  if (customer.agentId === userId) return true;
  return Boolean(customer.routeId && agentRouteIds.includes(customer.routeId));
}

export function buildLoanDetailWhere(input: LoanDetailWhereInput) {
  const where: Record<string, unknown> = {
    loanCode: input.loanId,
    tenantId: input.tenantId,
    appType: input.appType,
  };

  const seesAllBranches = input.role === 'superadmin' || input.role === 'developer';
  if (input.branchId && !seesAllBranches) {
    where.branchId = input.branchId;
  }

  if (input.role === 'agent') {
    where.customer = buildAgentCustomerAccessWhere({ userId: input.userId });
  }

  return where;
}
