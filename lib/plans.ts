export type PlanFeature = {
  loans: number;
  agents: number;
  modules: string[];
  gracePeriodDays: number;
};

export const PLAN_FEATURES: Record<string, PlanFeature> = {
  trial: { loans: 50, agents: 3, modules: ['microlending'], gracePeriodDays: 3 },
  basic: { loans: 200, agents: 10, modules: ['microlending', 'autofinance'], gracePeriodDays: 7 },
  pro: { loans: 1000, agents: 50, modules: ['microlending', 'autofinance', 'chitfunds'], gracePeriodDays: 14 },
  enterprise: { loans: 999999, agents: 999, modules: ['microlending', 'autofinance', 'chitfunds'], gracePeriodDays: 30 },
};

/** Monthly pricing in INR (excl. tax). Tax is 18% GST. */
export const PLAN_PRICING: Record<string, { amount: number; tax: number; total: number }> = {
  trial: { amount: 0, tax: 0, total: 0 },
  basic: { amount: 999, tax: 180, total: 1179 },
  pro: { amount: 2999, tax: 540, total: 3539 },
  enterprise: { amount: 7999, tax: 1440, total: 9439 },
};

export const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const PLAN_COLORS: Record<string, string> = {
  trial: 'var(--warning)',
  basic: 'var(--info)',
  pro: 'var(--success)',
  enterprise: 'var(--primary-dark)',
};

export const MODULE_LABELS: Record<string, string> = {
  microlending: 'Micro Lending',
  autofinance: 'Auto Finance',
  chitfunds: 'Chit Funds',
};
