import { yearlySavingsPercent } from '@/lib/pricing';
import { parseFeatureKeys } from '@/lib/planFeatures';
import { normalizeRazorpayPlanId } from '@/lib/razorpay';

/** The columns of SubscriptionPlanCatalog this view reads. */
export type PlanCatalogRow = {
  plan: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number | null;
  razorpayYearlyPlanId: string | null;
  maxBranches: number;
  maxAgents: number;
  maxActiveLoans: number;
  features: string;
  includedFeatures: string | null;
  sortOrder: number;
};

/** Same sentinels the plan limits are stored with (lib/plans.ts, lib/profile.ts). */
export const UNLIMITED_BRANCHES_AGENTS = 999;
export const UNLIMITED_LOANS = 999999;

export type PlanCatalogCard = {
  plan: string;
  displayName: string;
  description: string | null;
  /** Developer-set price (Developer → Billing → Pricing). 0 = free plan. */
  monthlyPrice: number;
  /** Non-null only when yearly billing can actually be charged (price AND Razorpay yearly plan set). */
  yearlyPrice: number | null;
  yearlySavingsPercent: number;
  maxBranches: number;
  maxAgents: number;
  maxActiveLoans: number;
  /** Server-decided, so clients never compare a limit against a magic number. */
  unlimited: { branches: boolean; agents: boolean; activeLoans: boolean };
  /** Free-text bullet list the developer typed for the plan. */
  features: string[];
  /** Feature keys (lib/planFeatures.ts) the plan bundles. */
  includedFeatures: string[];
  /** Display name of the next-cheaper paid plan, so higher plans read "includes everything in X". */
  includesPlan: string | null;
  isCurrent: boolean;
};

function parseBullets(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return raw ? [raw] : [];
  }
}

/**
 * Plans a tenant can choose from, as the subscription screen renders them. Every
 * figure comes from the developer-managed catalog; clients only display this
 * (STABLE-8). Mirrors the web subscription page's plan cards.
 */
export function buildPlanCatalogView(
  catalog: readonly PlanCatalogRow[],
  currentPlan: string | null | undefined,
): PlanCatalogCard[] {
  const current = (currentPlan ?? '').toLowerCase();
  const paidByPrice = catalog.filter((p) => p.monthlyPrice > 0).sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  return [...catalog]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cp) => {
      const i = paidByPrice.findIndex((p) => p.plan === cp.plan);
      const yearlyOffered = (cp.yearlyPrice ?? 0) > 0 && normalizeRazorpayPlanId(cp.razorpayYearlyPlanId) !== null;
      return {
        plan: cp.plan,
        displayName: cp.displayName,
        description: cp.description,
        monthlyPrice: cp.monthlyPrice,
        yearlyPrice: yearlyOffered ? cp.yearlyPrice : null,
        yearlySavingsPercent: yearlySavingsPercent(cp.monthlyPrice, cp.yearlyPrice ?? 0),
        maxBranches: cp.maxBranches,
        maxAgents: cp.maxAgents,
        maxActiveLoans: cp.maxActiveLoans,
        unlimited: {
          branches: cp.maxBranches >= UNLIMITED_BRANCHES_AGENTS,
          agents: cp.maxAgents >= UNLIMITED_BRANCHES_AGENTS,
          activeLoans: cp.maxActiveLoans >= UNLIMITED_LOANS,
        },
        features: parseBullets(cp.features),
        includedFeatures: parseFeatureKeys(cp.includedFeatures),
        includesPlan: i > 0 ? paidByPrice[i - 1].displayName : null,
        isCurrent: cp.plan.toLowerCase() === current,
      };
    });
}
