/**
 * Affiliate reward calculation — single source of truth.
 *
 * Locked rules:
 *  - Threshold: an affiliate unlocks a reward once 10 referred TENANTS become
 *    PAID subscribers.
 *  - Reward depends on the affiliate's own plan term:
 *      • Yearly  affiliate → 1 year of their own plan free.
 *      • Monthly affiliate → 30% COMMISSION on the referred customers'
 *        subscription revenue, for 5 months.
 *
 * The function also reports our cost so the two paths can be compared (which one
 * the affiliate earns more from / we lose more on).
 */

export const AFFILIATE_THRESHOLD = 10;
export const MONTHLY_COMMISSION_RATE = 0.3; // 30%
export const MONTHLY_COMMISSION_MONTHS = 5;
export const YEARLY_FREE_MONTHS = 12;

export type AffiliateConfig = {
  threshold: number;
  monthlyCommissionRate: number;
  monthlyCommissionMonths: number;
  yearlyRewardFreeMonths: number;
};

export type AffiliateRewardInput = {
  /** The affiliate's own subscription term. */
  affiliatePlanTerm: 'monthly' | 'yearly';
  /** The affiliate's own monthly price (₹). */
  affiliateMonthlyPrice: number;
  /** The affiliate's own yearly price (₹). If 0, derived as 12×monthly. */
  affiliateYearlyPrice?: number;
  /** Number of referred tenants who are PAID subscribers. */
  referredPaidCount: number;
  /** Sum of the referred tenants' MONTHLY subscription prices (₹/month). */
  referredMonthlyRevenue: number;
};

export type AffiliateReward = {
  unlocked: boolean;
  remainingToUnlock: number;
  type: 'free_year' | 'commission_5mo' | 'none';
  /** Cash/credit value the affiliate receives (₹). */
  affiliateValue: number;
  /** What it costs us (₹) — same as affiliateValue here. */
  ourCost: number;
  detail: string;
};

export async function getAffiliateConfig(): Promise<AffiliateConfig> {
  if (typeof window !== 'undefined') {
    return {
      threshold: AFFILIATE_THRESHOLD,
      monthlyCommissionRate: MONTHLY_COMMISSION_RATE,
      monthlyCommissionMonths: MONTHLY_COMMISSION_MONTHS,
      yearlyRewardFreeMonths: YEARLY_FREE_MONTHS,
    };
  }

  try {
    const prisma = (await import('@/lib/db')).default;
    const defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
    if (!defaultTenant) {
      return {
        threshold: AFFILIATE_THRESHOLD,
        monthlyCommissionRate: MONTHLY_COMMISSION_RATE,
        monthlyCommissionMonths: MONTHLY_COMMISSION_MONTHS,
        yearlyRewardFreeMonths: YEARLY_FREE_MONTHS,
      };
    }
    const tenantId = defaultTenant.id;
    const [thresholdSet, rateSet, monthsSet, yearlyMonthsSet] = await Promise.all([
      prisma.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'affiliate_threshold' } } }),
      prisma.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'affiliate_commission_rate' } } }),
      prisma.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'affiliate_commission_months' } } }),
      prisma.appSetting.findUnique({ where: { tenantId_key: { tenantId, key: 'affiliate_yearly_free_months' } } }),
    ]);

    return {
      threshold: thresholdSet ? parseInt(thresholdSet.value, 10) : AFFILIATE_THRESHOLD,
      monthlyCommissionRate: rateSet ? parseFloat(rateSet.value) : MONTHLY_COMMISSION_RATE,
      monthlyCommissionMonths: monthsSet ? parseInt(monthsSet.value, 10) : MONTHLY_COMMISSION_MONTHS,
      yearlyRewardFreeMonths: yearlyMonthsSet ? parseInt(yearlyMonthsSet.value, 10) : YEARLY_FREE_MONTHS,
    };
  } catch (error) {
    console.error('Error fetching affiliate config from database:', error);
    return {
      threshold: AFFILIATE_THRESHOLD,
      monthlyCommissionRate: MONTHLY_COMMISSION_RATE,
      monthlyCommissionMonths: MONTHLY_COMMISSION_MONTHS,
      yearlyRewardFreeMonths: YEARLY_FREE_MONTHS,
    };
  }
}

export function computeAffiliateReward(
  input: AffiliateRewardInput,
  config?: AffiliateConfig
): AffiliateReward {
  const threshold = config?.threshold ?? AFFILIATE_THRESHOLD;
  const commissionRate = config?.monthlyCommissionRate ?? MONTHLY_COMMISSION_RATE;
  const commissionMonths = config?.monthlyCommissionMonths ?? MONTHLY_COMMISSION_MONTHS;
  const freeMonths = config?.yearlyRewardFreeMonths ?? YEARLY_FREE_MONTHS;

  const {
    affiliatePlanTerm,
    affiliateMonthlyPrice,
    referredPaidCount,
    referredMonthlyRevenue,
  } = input;

  const yearly = input.affiliateYearlyPrice && input.affiliateYearlyPrice > 0
    ? input.affiliateYearlyPrice
    : affiliateMonthlyPrice * freeMonths;

  if (referredPaidCount < threshold) {
    return {
      unlocked: false,
      remainingToUnlock: threshold - referredPaidCount,
      type: 'none',
      affiliateValue: 0,
      ourCost: 0,
      detail: `${referredPaidCount}/${threshold} paid referrals`,
    };
  }

  if (affiliatePlanTerm === 'yearly') {
    return {
      unlocked: true,
      remainingToUnlock: 0,
      type: 'free_year',
      affiliateValue: round2(yearly),
      ourCost: round2(yearly),
      detail: `${freeMonths} months free (${freeMonths === 12 ? '1 year' : `${freeMonths}mo`} free)`,
    };
  }

  // Monthly: commission rate of referred monthly revenue, for N months.
  const perMonth = referredMonthlyRevenue * commissionRate;
  const total = perMonth * commissionMonths;
  return {
    unlocked: true,
    remainingToUnlock: 0,
    type: 'commission_5mo',
    affiliateValue: round2(total),
    ourCost: round2(total),
    detail: `${commissionRate * 100}% × ${commissionMonths} months on ₹${round2(referredMonthlyRevenue)}/mo referred revenue`,
  };
}

/**
 * Compare the two reward paths for the same referral set, to answer
 * "which does the affiliate earn more from / do we lose more on".
 */
export function compareAffiliatePaths(
  args: {
    affiliateMonthlyPrice: number;
    affiliateYearlyPrice?: number;
    referredPaidCount: number;
    referredMonthlyRevenue: number;
  },
  config?: AffiliateConfig
) {
  const yearlyReward = computeAffiliateReward({ ...args, affiliatePlanTerm: 'yearly' }, config);
  const monthlyReward = computeAffiliateReward({ ...args, affiliatePlanTerm: 'monthly' }, config);
  const costlier =
    monthlyReward.ourCost === yearlyReward.ourCost
      ? 'equal'
      : monthlyReward.ourCost > yearlyReward.ourCost
        ? 'monthly'
        : 'yearly';
  return { yearlyReward, monthlyReward, costlier };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
