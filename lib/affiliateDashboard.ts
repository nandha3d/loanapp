import prisma from '@/lib/db';
import { computeAffiliateReward, compareAffiliatePaths, getAffiliateConfig } from '@/lib/affiliate';
import { normalizeBillingCycle } from '@/lib/razorpay';

/**
 * The signed-in owner's own affiliate dashboard: referral code, progress to the
 * reward threshold, the reward they would earn, referred tenants and granted
 * rewards. Everything is worked out here so clients only render it (STABLE-8).
 *
 * The affiliate record is the caller's own (keyed by userId); it is created on
 * first view, exactly as the web Affiliate page does.
 */
export async function getAffiliateDashboard(userId: string, tenantId: string) {
  let affiliate = await prisma.affiliate.findUnique({ where: { userId } });

  if (!affiliate) {
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    let code = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      code = 'aff-' + Math.random().toString(36).substring(2, 10).toLowerCase();
      if (!(await prisma.affiliate.findUnique({ where: { code } }))) break;
    }
    affiliate = await prisma.affiliate.create({
      data: {
        code,
        name: user?.name || 'Affiliate',
        email: user?.email,
        phone: user?.phone,
        userId,
        tenantId,
        status: 'active',
      },
    });
  }

  const [config, referrals, grantedRewards, sub] = await Promise.all([
    getAffiliateConfig(),
    prisma.referral.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: 'desc' } }),
    prisma.affiliateReward.findMany({ where: { affiliateId: affiliate.id }, orderBy: { createdAt: 'desc' } }),
    prisma.tenantSubscription.findUnique({ where: { tenantId } }),
  ]);

  const paid = referrals.filter((r) => r.status === 'subscribed');
  const referredPaidCount = paid.length;
  const referredMonthlyRevenue = paid.reduce((sum, r) => sum + (r.monthlyPrice ? Number(r.monthlyPrice) : 0), 0);

  // The affiliate's own plan, priced from the developer catalog (not a literal).
  const catalog = sub
    ? await prisma.subscriptionPlanCatalog.findUnique({ where: { plan: sub.plan } }).catch(() => null)
    : null;
  const affiliateMonthlyPrice = catalog?.monthlyPrice ?? sub?.basePlanPrice ?? 0;
  const affiliateYearlyPrice = (catalog?.yearlyPrice ?? 0) > 0 ? (catalog?.yearlyPrice ?? 0) : 0;
  const rewardInput = {
    affiliatePlanTerm: normalizeBillingCycle(sub?.billingCycle),
    affiliateMonthlyPrice,
    affiliateYearlyPrice,
    referredPaidCount,
    referredMonthlyRevenue,
  };
  const current = computeAffiliateReward(rewardInput, config);
  const comparison = compareAffiliatePaths(rewardInput, config);

  return {
    affiliate: {
      id: affiliate.id,
      code: affiliate.code,
      name: affiliate.name,
      email: affiliate.email,
      phone: affiliate.phone,
      status: affiliate.status,
    },
    // Clients prefix their own web origin.
    referralPath: `/r/${affiliate.code}`,
    config,
    stats: {
      totalReferrals: referrals.length,
      referredPaidCount,
      referredMonthlyRevenue,
      remainingToUnlock: current.remainingToUnlock,
      unlocked: current.unlocked,
      progressPercent:
        config.threshold > 0 ? Math.min(Math.round((referredPaidCount / config.threshold) * 100), 100) : 100,
    },
    rewards: {
      current,
      comparison,
      granted: grantedRewards.map((r) => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        grantedAt: r.grantedAt ? r.grantedAt.toISOString() : null,
      })),
    },
    referrals: referrals.map((r) => ({
      id: r.id,
      referredEmail: r.referredEmail || null,
      status: r.status,
      planTerm: r.planTerm || null,
      monthlyPrice: r.monthlyPrice ? Number(r.monthlyPrice) : 0,
      subscribedAt: r.subscribedAt ? r.subscribedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
