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
  // Lifetime — standalone client license: unlimited, all modules, never billed.
  // Not a buyable/public plan; assigned manually to a specific tenant.
  lifetime: {
    loans: 999999, agents: 999, branches: 999,
    modules: ['microlending', 'autofinance', 'chitfunds', 'goldloan', 'property', 'productfinance'],
    gracePeriodDays: 999999, trialDays: 0,
  },
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
  // Collector — unlimited agents, single branch, one vertical. Counter to
  // Vasool's ₹699 flat plan. Module is chosen at checkout; default here is the
  // micro-lending base for fallback purposes only.
  collector: {
    loans: 500, agents: 999, branches: 1,
    modules: ['microlending'],
    gracePeriodDays: 7, trialDays: 0,
  },
  basic: {
    loans: 500, agents: 15, branches: 2,
    modules: ['microlending', 'autofinance'],
    gracePeriodDays: 7, trialDays: 0,
  },
  business: {
    loans: 1500, agents: 60, branches: 6,
    modules: ['microlending', 'autofinance', 'chitfunds', 'goldloan', 'property', 'productfinance'],
    gracePeriodDays: 14, trialDays: 0,
  },
  enterprise: {
    loans: 999999, agents: 999, branches: 999,
    modules: ['microlending', 'autofinance', 'chitfunds', 'goldloan', 'property', 'productfinance'],
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
  collector:  { amount: 699,  tax: 126,  total: 825 },
  basic:      { amount: 999,  tax: 180,  total: 1179 },
  business:   { amount: 2999, tax: 540,  total: 3539 },
  enterprise: { amount: 7999, tax: 1440, total: 9439 },
};

export const PLAN_LABELS: Record<string, string> = {
  lifetime:   'Lifetime',
  trial:      'Trial',
  free:       'Free',
  collector:  'Collector',
  basic:      'Basic',
  business:   'Business',
  enterprise: 'Enterprise',
};

export const PLAN_COLORS: Record<string, string> = {
  lifetime:   'var(--primary)',
  trial:      'var(--warning)',
  free:       'var(--text-secondary)',
  collector:  'var(--accent)',
  basic:      'var(--info)',
  business:   'var(--success)',
  enterprise: 'var(--primary-dark)',
};

export const PLAN_DESCRIPTIONS: Record<string, string> = {
  lifetime:   'Standalone license — no billing; features set in admin panel',
  trial:      'Get started for free',
  free:       'Perfect for individuals — always free',
  collector:  'Unlimited agents for a single-product collection business',
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
