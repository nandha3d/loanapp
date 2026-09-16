import { cache } from 'react';
import prisma from '@/lib/db';
import { withStandardVerticalBases, type VerticalBaseCatalogItem } from '@/lib/pricing';
import { PLAN_FEATURES, PLAN_PRICING, PLAN_DESCRIPTIONS, PLAN_LABELS } from '@/lib/plans';

/**
 * Single DB-driven source of truth for pricing.
 *
 * Both the public pricing API (`/api/pricing`) and the marketing pricing page
 * read through here so prices/limits are never hardcoded in a page/route — the
 * catalog tables (seeded by `prisma/seed-pricing.ts`, editable in the admin
 * billing panel) are authoritative. `lib/plans.ts` constants are used ONLY as a
 * last-resort fallback when the DB is unreachable, per the never-hardcode rule.
 */

export type PublicPlan = {
  plan: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  maxBranches: number;
  maxAgents: number;
  maxActiveLoans: number;
  trialDays: number;
  features: string[];
  sortOrder: number;
};

export type PublicPricing = {
  plans: PublicPlan[];
  modules: VerticalBaseCatalogItem[];
  addons: Array<{
    id: string;
    addon: string;
    displayName: string;
    description: string | null;
    monthlyPrice: number;
    isActive: boolean;
    sortOrder: number;
  }>;
};

// Plans surfaced on the public pricing page. Internal states (`trial`,
// `lifetime`) are intentionally excluded — they are never catalog rows.
const PUBLIC_PLAN_ORDER = ['free', 'collector', 'basic', 'business', 'enterprise'];

/** Fallback built from lib/plans.ts when the catalog cannot be read. */
function fallbackPricing(): PublicPricing {
  const plans: PublicPlan[] = PUBLIC_PLAN_ORDER.map((plan, i) => {
    const f = PLAN_FEATURES[plan];
    const p = PLAN_PRICING[plan];
    if (!f) return null;
    return {
      plan,
      displayName: PLAN_LABELS[plan] ?? plan,
      description: PLAN_DESCRIPTIONS[plan] ?? null,
      monthlyPrice: p?.amount ?? 0,
      maxBranches: f.branches,
      maxAgents: f.agents,
      maxActiveLoans: f.loans,
      trialDays: f.trialDays,
      features: [],
      sortOrder: i,
    };
  }).filter(Boolean) as PublicPlan[];
  return { plans, modules: withStandardVerticalBases([]), addons: [] };
}

/**
 * Catalog-driven public pricing, request-memoized. Falls back to lib/plans.ts
 * only if the DB query fails, so the marketing page never renders blank.
 */
export const getPublicPricing = cache(async (): Promise<PublicPricing> => {
  try {
    const [plans, modules, addons] = await Promise.all([
      prisma.subscriptionPlanCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.modulePriceCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.addonCatalog.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const formattedPlans: PublicPlan[] = plans.map((p) => {
      let features: string[] = [];
      try {
        const parsed = JSON.parse(p.features);
        if (Array.isArray(parsed)) features = parsed.map((x) => String(x));
      } catch {
        features = [];
      }
      return {
        plan: p.plan,
        displayName: p.displayName,
        description: p.description,
        monthlyPrice: p.monthlyPrice,
        maxBranches: p.maxBranches,
        maxAgents: p.maxAgents,
        maxActiveLoans: p.maxActiveLoans,
        trialDays: p.trialDays,
        features,
        sortOrder: p.sortOrder,
      };
    });

    return {
      plans: formattedPlans,
      modules: withStandardVerticalBases(modules),
      addons,
    };
  } catch (err) {
    console.error('[PLAN_CATALOG] falling back to lib/plans.ts:', err);
    return fallbackPricing();
  }
});

export type PlanLimits = {
  maxActiveLoans: number;
  maxAgents: number;
  maxBranches: number;
  enabledModules: string[];
  gracePeriodDays: number;
  trialDays: number;
};

/**
 * Resolve runtime limits for a plan, catalog-first.
 *
 * Numeric limits (loans/agents/branches) and trialDays come from
 * `SubscriptionPlanCatalog`. `enabledModules` and `gracePeriodDays` are NOT yet
 * catalog columns, so they fall back to `PLAN_FEATURES` until the gated
 * migration in docs/parity/migrations adds those columns. Once added, switch
 * the two TODO lines below to read from the catalog row.
 */
export async function getPlanLimits(plan: string): Promise<PlanLimits> {
  const fallback = PLAN_FEATURES[plan] ?? PLAN_FEATURES['free'];
  try {
    const row = await prisma.subscriptionPlanCatalog.findUnique({ where: { plan } });
    if (row) {
      return {
        maxActiveLoans: row.maxActiveLoans,
        maxAgents: row.maxAgents,
        maxBranches: row.maxBranches,
        // TODO(gated-migration): read row.enabledModules once the column exists.
        enabledModules: fallback.modules,
        // TODO(gated-migration): read row.gracePeriodDays once the column exists.
        gracePeriodDays: fallback.gracePeriodDays,
        trialDays: row.trialDays,
      };
    }
  } catch (err) {
    console.error('[PLAN_CATALOG] getPlanLimits fallback:', err);
  }
  return {
    maxActiveLoans: fallback.loans,
    maxAgents: fallback.agents,
    maxBranches: fallback.branches,
    enabledModules: fallback.modules,
    gracePeriodDays: fallback.gracePeriodDays,
    trialDays: fallback.trialDays,
  };
}
