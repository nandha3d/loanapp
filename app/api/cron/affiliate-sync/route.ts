import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@/lib/db';
import { getAffiliateConfig, computeAffiliateReward } from '@/lib/affiliate';
import { apiSuccess, apiError } from '@/lib/utils';

export async function GET(request: Request) {
  // Same CRON_SECRET gate every other cron uses — this endpoint writes
  // AffiliateReward records and mutates referral statuses, so it must not be
  // publicly callable.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || '';
  const expectedToken = Buffer.from(cronSecret);
  const providedTokenStr = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const providedToken = Buffer.from(providedTokenStr);
  if (
    !cronSecret ||
    expectedToken.length !== providedToken.length ||
    !crypto.timingSafeEqual(expectedToken, providedToken)
  ) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Dynamic config settings
    const config = await getAffiliateConfig();
    const threshold = config.threshold;

    // 1. Fetch referrals with status "signup" who have a referredTenantId
    const pendingReferrals = await prisma.referral.findMany({
      where: {
        status: 'signup',
        referredTenantId: { not: null },
      },
    });

    let conversions = 0;

    for (const ref of pendingReferrals) {
      if (!ref.referredTenantId) continue;

      // Fetch referred tenant's subscription status
      const sub = await prisma.tenantSubscription.findUnique({
        where: { tenantId: ref.referredTenantId },
      });

      // If the referred tenant is active and not on a "trial" plan, they converted to a paid subscriber!
      if (sub && sub.status === 'active' && sub.plan !== 'trial') {
        const monthlyPrice = sub.totalMonthlyPrice ? Number(sub.totalMonthlyPrice) : 1000;
        
        // Check if billing period represents monthly or yearly
        // (Typically based on plan terms, let's look up if current period end is ~1 year away, or default to monthly)
        let planTerm: 'monthly' | 'yearly' = 'monthly';
        if (sub.currentPeriodEnd && sub.createdAt) {
          const durationDays = (sub.currentPeriodEnd.getTime() - sub.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (durationDays > 300) planTerm = 'yearly';
        }

        // Update referral record
        await prisma.referral.update({
          where: { id: ref.id },
          data: {
            status: 'subscribed',
            planTerm,
            monthlyPrice,
            subscribedAt: new Date(),
          },
        });

        conversions++;
      }
    }

    // 2. Scan all affiliates to check if new cohorts unlocked
    const affiliates = await prisma.affiliate.findMany({
      where: { status: 'active' },
    });

    let rewardsGenerated = 0;

    for (const affiliate of affiliates) {
      // Count paid referred tenants
      const paidCount = await prisma.referral.count({
        where: {
          affiliateId: affiliate.id,
          status: 'subscribed',
        },
      });

      // Cohort-based rewards check
      const expectedRewardsCount = Math.floor(paidCount / threshold);
      const actualRewardsCount = await prisma.affiliateReward.count({
        where: { affiliateId: affiliate.id },
      });

      if (expectedRewardsCount > actualRewardsCount) {
        const rewardsToCreate = expectedRewardsCount - actualRewardsCount;

        // Fetch affiliate's own subscription price and plan term to calculate reward amount
        let affiliatePlanTerm: 'monthly' | 'yearly' = 'monthly';
        let affiliateMonthlyPrice = 1000;
        
        if (affiliate.tenantId) {
          const ownSub = await prisma.tenantSubscription.findUnique({
            where: { tenantId: affiliate.tenantId },
          });
          if (ownSub) {
            affiliatePlanTerm = ownSub.plan === 'yearly' ? 'yearly' : 'monthly';
            affiliateMonthlyPrice = ownSub.totalMonthlyPrice ? Number(ownSub.totalMonthlyPrice) : 1000;
          }
        }

        // Find referred monthly revenue for their paid subscribers
        const paidRefs = await prisma.referral.findMany({
          where: {
            affiliateId: affiliate.id,
            status: 'subscribed',
          },
        });

        const referredMonthlyRevenue = paidRefs.reduce((sum, r) => sum + (r.monthlyPrice ? Number(r.monthlyPrice) : 0), 0);

        for (let i = 0; i < rewardsToCreate; i++) {
          const rewardCalc = computeAffiliateReward({
            affiliatePlanTerm,
            affiliateMonthlyPrice,
            referredPaidCount: paidCount,
            referredMonthlyRevenue,
          }, config);

          // Create AffiliateReward in DB
          await prisma.affiliateReward.create({
            data: {
              affiliateId: affiliate.id,
              type: rewardCalc.type === 'free_year' ? 'free_year' : 'commission_5mo',
              amount: rewardCalc.affiliateValue,
              status: 'pending',
            },
          });

          rewardsGenerated++;
        }
      }
    }

    return apiSuccess({
      message: 'Affiliate system status synchronized successfully.',
      conversionsDetected: conversions,
      rewardsGenerated,
    });
  } catch (error: any) {
    console.error('[API_CRON_AFFILIATE_SYNC]', error);
    return apiError(error.message, 500);
  }
}
