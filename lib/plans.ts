export type PlanFeature = {
  loans: number;
  agents: number;
  branches: number;
  modules: string[];
  gracePeriodDays: number;
  /** Trial duration in days. 0 = no trial for this plan. */
  trialDays: number;
};

// ── 4 customer-facing plans ───────────────────────────────────────────────────
// `trial` is an internal state (new tenant before they pick a plan), not shown
// in the public pricing page. Customers choose from free/basic/business/enterprise.
// Enterprise gives a 15-day full-feature trial before billing starts.

export const PLAN_FEATURES: Record<string, PlanFeature> = {
  // Internal — assigned on registration before user picks a plan.
  trial: {
    loans: 50, agents: 3, branches: 1,
    modules: ['microlending'],
    gracePeriodDays: 3, trialDays: 0,
  },
  free: {
    loans: 25, agents: 1, branches: 1,
    modules: ['microlending'],
    gracePeriodDays: 3, trialDays: 0,
  },
  basic: {
    loans: 200, agents: 10, branches: 2,
    modules: ['microlending', 'autofinance'],
    gracePeriodDays: 7, trialDays: 0,
  },
  business: {
    loans: 1000, agents: 50, branches: 5,
    modules: ['microlending', 'autofinance', 'chitfunds', 'goldloan'],
    gracePeriodDays: 14, trialDays: 0,
  },
  enterprise: {
    loans: 999999, agents: 999, branches: 999,
    modules: ['microlending', 'autofinance', 'chitfunds', 'goldloan'],
    gracePeriodDays: 30,
    // 15-day full-feature trial. During this window the tenant has enterprise
    // limits but no payment is collected. After 15 days they must subscribe
    // or the plan reverts to free.
    trialDays: 15,
  },
};

/** Monthly pricing in INR (excl. GST). Tax = 18%. */
export const PLAN_PRICING: Record<string, { amount: number; tax: number; total: number }> = {
  trial:      { amount: 0,    tax: 0,    total: 0 },
  free:       { amount: 0,    tax: 0,    total: 0 },
  basic:      { amount: 999,  tax: 180,  total: 1179 },
  business:   { amount: 2999, tax: 540,  total: 3539 },
  enterprise: { amount: 7999, tax: 1440, total: 9439 },
};

export const PLAN_LABELS: Record<string, string> = {
  trial:      'Trial',
  free:       'Free',
  basic:      'Basic',
  business:   'Business',
  enterprise: 'Enterprise',
};

export const PLAN_COLORS: Record<string, string> = {
  trial:      'var(--warning)',
  free:       'var(--text-secondary)',
  basic:      'var(--info)',
  business:   'var(--success)',
  enterprise: 'var(--primary-dark)',
};

export const PLAN_DESCRIPTIONS: Record<string, string> = {
  trial:      'Get started for free',
  free:       'Perfect for individuals — always free',
  basic:      'Small NBFC or personal lender',
  business:   'Growing microfinance operation',
  enterprise: 'Unlimited scale — 15-day free trial',
};

export const MODULE_LABELS: Record<string, string> = {
  microlending: 'Micro Lending',
  autofinance:  'Auto Finance',
  chitfunds:    'Chit Funds',
  goldloan:     'Gold Loan',
};

/** Returns trial end date for a plan, or null if the plan has no trial. */
export function getTrialEndsAt(plan: string): Date | null {
  const days = PLAN_FEATURES[plan]?.trialDays ?? 0;
  if (days <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}
