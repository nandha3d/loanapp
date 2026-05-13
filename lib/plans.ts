export type PlanFeature = {
  loans: number;
  agents: number;
  modules: string[];
};

export const PLAN_FEATURES: Record<string, PlanFeature> = {
  trial: { loans: 50, agents: 3, modules: ['microlending'] },
  basic: { loans: 200, agents: 10, modules: ['microlending', 'autofinance'] },
  pro: { loans: 1000, agents: 50, modules: ['microlending', 'autofinance', 'chitfunds'] },
  enterprise: { loans: 999999, agents: 999, modules: ['microlending', 'autofinance', 'chitfunds'] },
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
