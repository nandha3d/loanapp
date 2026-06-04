import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { ok, fail } from '@/lib/api/v1-envelope';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { getAffiliateConfig, computeAffiliateReward } from '@/lib/affiliate';
import { setSetting } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role !== 'developer') {
    return fail('Forbidden', 403);
  }

  try {
    const affiliates = await prisma.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const referrals = await prisma.referral.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const rewards = await prisma.affiliateReward.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const visits = await prisma.affiliateVisit.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const leads = await prisma.referralLead.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const config = await getAffiliateConfig();

    const affiliatesFormatted = affiliates.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      email: a.email || 'n/a',
      phone: a.phone || 'n/a',
      userId: a.userId || null,
      tenantId: a.tenantId || null,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));

    const referralsFormatted = referrals.map((r) => ({
      id: r.id,
      affiliateId: r.affiliateId,
      referredTenantId: r.referredTenantId || null,
      referredEmail: r.referredEmail || 'n/a',
      status: r.status,
      planTerm: r.planTerm || 'n/a',
      monthlyPrice: r.monthlyPrice ? Number(r.monthlyPrice) : 0,
      subscribedAt: r.subscribedAt ? r.subscribedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

    const rewardsFormatted = rewards.map((rw) => ({
      id: rw.id,
      affiliateId: rw.affiliateId,
      type: rw.type,
      amount: Number(rw.amount),
      status: rw.status,
      createdAt: rw.createdAt.toISOString(),
      grantedAt: rw.grantedAt ? rw.grantedAt.toISOString() : null,
    }));

    const visitsFormatted = visits.map((v) => ({
      id: v.id,
      affiliateId: v.affiliateId,
      ipAddress: v.ipAddress,
      userAgent: v.userAgent,
      referrerUrl: v.referrerUrl,
      createdAt: v.createdAt.toISOString(),
    }));

    const leadsFormatted = leads.map((l) => ({
      id: l.id,
      affiliateId: l.affiliateId,
      businessName: l.businessName || 'N/A',
      ownerName: l.ownerName || 'N/A',
      phone: l.phone || 'N/A',
      email: l.email || 'N/A',
      lastStepReached: l.lastStepReached,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }));

    return ok({
      affiliates: affiliatesFormatted,
      referrals: referralsFormatted,
      rewards: rewardsFormatted,
      visits: visitsFormatted,
      leads: leadsFormatted,
      config,
    });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMobileContext(req);
  if (auth.response) return auth.response;
  const ctx = auth.context;

  if (ctx.role !== 'developer') {
    return fail('Forbidden', 403);
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'sync') {
      const config = await getAffiliateConfig();
      const threshold = config.threshold;

      const pendingReferrals = await prisma.referral.findMany({
        where: {
          status: 'signup',
          referredTenantId: { not: null },
        },
      });

      let conversions = 0;
      for (const ref of pendingReferrals) {
        if (!ref.referredTenantId) continue;

        const sub = await prisma.tenantSubscription.findUnique({
          where: { tenantId: ref.referredTenantId },
        });

        if (sub && sub.status === 'active' && sub.plan !== 'trial') {
          const monthlyPrice = sub.totalMonthlyPrice ? Number(sub.totalMonthlyPrice) : 1000;
          let planTerm: 'monthly' | 'yearly' = 'monthly';
          if (sub.currentPeriodEnd && sub.createdAt) {
            const durationDays = (sub.currentPeriodEnd.getTime() - sub.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            if (durationDays > 300) planTerm = 'yearly';
          }

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

      const affiliates = await prisma.affiliate.findMany({
        where: { status: 'active' },
      });

      let rewardsGenerated = 0;
      for (const affiliate of affiliates) {
        const paidCount = await prisma.referral.count({
          where: {
            affiliateId: affiliate.id,
            status: 'subscribed',
          },
        });

        const expectedRewardsCount = Math.floor(paidCount / threshold);
        const actualRewardsCount = await prisma.affiliateReward.count({
          where: { affiliateId: affiliate.id },
        });

        if (expectedRewardsCount > actualRewardsCount) {
          const rewardsToCreate = expectedRewardsCount - actualRewardsCount;

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

      return ok({
        success: true,
        conversionsDetected: conversions,
        rewardsGenerated,
      });
    }

    if (action === 'config') {
      const defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'default' } });
      if (!defaultTenant) {
        return fail('Default tenant not found.', 500);
      }
      const tenantId = defaultTenant.id;
      const { threshold, monthlyCommissionRate, monthlyCommissionMonths, yearlyRewardFreeMonths } = body;

      if (threshold !== undefined) {
        await setSetting(tenantId, 'affiliate_threshold', String(threshold), 'affiliate');
      }
      if (monthlyCommissionRate !== undefined) {
        await setSetting(tenantId, 'affiliate_commission_rate', String(monthlyCommissionRate), 'affiliate');
      }
      if (monthlyCommissionMonths !== undefined) {
        await setSetting(tenantId, 'affiliate_commission_months', String(monthlyCommissionMonths), 'affiliate');
      }
      if (yearlyRewardFreeMonths !== undefined) {
        await setSetting(tenantId, 'affiliate_yearly_free_months', String(yearlyRewardFreeMonths), 'affiliate');
      }

      return ok({
        success: true,
        config: {
          threshold,
          monthlyCommissionRate,
          monthlyCommissionMonths,
          yearlyRewardFreeMonths,
        },
      });
    }

    if (action === 'update_reward') {
      const { rewardId, status } = body;

      if (!rewardId || !status) {
        return fail('Missing rewardId or status', 400);
      }

      const reward = await prisma.affiliateReward.findUnique({
        where: { id: rewardId },
      });

      if (!reward) {
        return fail('AffiliateReward not found', 404);
      }

      const updated = await prisma.affiliateReward.update({
        where: { id: rewardId },
        data: {
          status,
          grantedAt: status === 'granted' || status === 'paid' ? new Date() : reward.grantedAt,
        },
      });

      return ok({ success: true, reward: updated });
    }

    return fail('Invalid action', 400);
  } catch (e: any) {
    return fail(e.message, 500);
  }
}
