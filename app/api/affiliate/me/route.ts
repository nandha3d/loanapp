import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiContext } from '@/lib/apiAuth';
import { apiError, apiSuccess } from '@/lib/utils';
import { getAffiliateConfig, computeAffiliateReward, compareAffiliatePaths } from '@/lib/affiliate';

export async function GET() {
  try {
    const authResult = await requireApiContext(['superadmin', 'admin', 'developer']);
    if ('response' in authResult && authResult.response) return authResult.response;
    const { context } = authResult as { context: any };

    // Fetch or auto-create the superadmin's affiliate record
    let affiliate = await prisma.affiliate.findUnique({
      where: { userId: context.userId },
    });

    if (!affiliate) {
      // Find the user details
      const user = await prisma.user.findUnique({
        where: { id: context.userId },
      });

      // Generate a short, unique code
      let code = '';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        code = 'aff-' + Math.random().toString(36).substring(2, 10).toLowerCase();
        const existing = await prisma.affiliate.findUnique({ where: { code } });
        if (!existing) isUnique = true;
        attempts++;
      }

      affiliate = await prisma.affiliate.create({
        data: {
          code,
          name: user?.name || 'Superadmin Affiliate',
          email: user?.email,
          phone: user?.phone,
          userId: context.userId,
          tenantId: context.tenantId,
          status: 'active',
        },
      });
    }

    // Load dynamic config
    const config = await getAffiliateConfig();

    // Fetch current user's referred tenants
    const referrals = await prisma.referral.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
    });

    const totalReferrals = referrals.length;
    const paidReferrals = referrals.filter((r) => r.status === 'subscribed');
    const referredPaidCount = paidReferrals.length;

    // Calculate sum of referred tenants' monthly subscription price (Decimal to number)
    const referredMonthlyRevenue = paidReferrals.reduce((sum, ref) => {
      const price = ref.monthlyPrice ? Number(ref.monthlyPrice) : 0;
      return sum + price;
    }, 0);

    // Fetch the affiliate's own subscription price and plan term to calculate rewards
    const ownSub = await prisma.tenantSubscription.findUnique({
      where: { tenantId: context.tenantId },
    });

    const affiliatePlanTerm = (ownSub?.plan === 'yearly' || ownSub?.currentPeriodEnd && ownSub?.trialEndsAt && (Number(ownSub.currentPeriodEnd) - Number(ownSub.trialEndsAt)) > 30 * 24 * 60 * 60 * 1000) ? 'yearly' : 'monthly';
    const affiliateMonthlyPrice = ownSub?.totalMonthlyPrice ? Number(ownSub.totalMonthlyPrice) : 1000; // default ₹1000/mo
    const affiliateYearlyPrice = affiliateMonthlyPrice * 12 * 0.8; // default 20% yearly discount if not set

    const rewardInput = {
      affiliatePlanTerm: ownSub?.plan === 'yearly' ? 'yearly' as const : 'monthly' as const,
      affiliateMonthlyPrice,
      affiliateYearlyPrice,
      referredPaidCount,
      referredMonthlyRevenue,
    };

    // Calculate rewards using core engine
    const rewardsResult = computeAffiliateReward(rewardInput, config);
    const comparison = compareAffiliatePaths(rewardInput, config);

    // Fetch granted/pending rewards from database
    const dbRewards = await prisma.affiliateReward.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({
      affiliate,
      config,
      stats: {
        totalReferrals,
        referredPaidCount,
        referredMonthlyRevenue,
        remainingToUnlock: rewardsResult.remainingToUnlock,
        unlocked: rewardsResult.unlocked,
      },
      rewards: {
        current: rewardsResult,
        comparison,
        granted: dbRewards,
      },
      referrals,
    });
  } catch (error: any) {
    console.error('[API_AFFILIATE_ME_GET]', error);
    return apiError(error.message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(['superadmin', 'admin', 'developer']);
    if ('response' in authResult && authResult.response) return authResult.response;
    const { context } = authResult as { context: any };

    const body = await request.json();
    const { name, email, phone } = body;

    const affiliate = await prisma.affiliate.findUnique({
      where: { userId: context.userId },
    });

    if (!affiliate) {
      return apiError('Affiliate record not found. Call GET first to initialize.', 404);
    }

    const updated = await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        name: name || affiliate.name,
        email: email !== undefined ? email : affiliate.email,
        phone: phone !== undefined ? phone : affiliate.phone,
      },
    });

    return apiSuccess({ affiliate: updated });
  } catch (error: any) {
    console.error('[API_AFFILIATE_ME_POST]', error);
    return apiError(error.message, 500);
  }
}
