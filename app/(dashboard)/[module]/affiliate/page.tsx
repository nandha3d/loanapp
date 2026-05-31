import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { getAffiliateConfig, computeAffiliateReward, compareAffiliatePaths } from '@/lib/affiliate';
import AffiliateClient from './AffiliateClient';

export default async function AffiliateDashboardPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as any;
  const role = user.role as string;
  const userId = user.id as string;
  const tenantId = user.tenantId as string;

  const { module } = await params;

  // Verify that the user is a superadmin or admin
  if (role !== 'superadmin' && role !== 'admin' && role !== 'developer') {
    redirect(`/${module}/dashboard`);
  }

  // Fetch or auto-create the superadmin's affiliate record
  let affiliate = await prisma.affiliate.findUnique({
    where: { userId },
  });

  if (!affiliate) {
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
        name: user.name || 'Superadmin Affiliate',
        email: user.email,
        phone: user.phone,
        userId,
        tenantId,
        status: 'active',
      },
    });
  }

  // Load dynamic configuration settings
  const config = await getAffiliateConfig();

  // Fetch current user's referred tenants
  const referrals = await prisma.referral.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { createdAt: 'desc' },
  });

  const totalReferrals = referrals.length;
  const paidReferrals = referrals.filter((r) => r.status === 'subscribed');
  const referredPaidCount = paidReferrals.length;

  // Calculate sum of referred tenants' monthly subscription price
  const referredMonthlyRevenue = paidReferrals.reduce((sum, ref) => {
    const price = ref.monthlyPrice ? Number(ref.monthlyPrice) : 0;
    return sum + price;
  }, 0);

  // Fetch the affiliate's own subscription price and plan term
  const ownSub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
  });

  const affiliatePlanTerm = ownSub?.plan === 'yearly' ? 'yearly' as const : 'monthly' as const;
  const affiliateMonthlyPrice = ownSub?.totalMonthlyPrice ? Number(ownSub.totalMonthlyPrice) : 1000;
  const affiliateYearlyPrice = affiliateMonthlyPrice * 12 * 0.8; // estimate 20% discount if not set

  const rewardInput = {
    affiliatePlanTerm,
    affiliateMonthlyPrice,
    affiliateYearlyPrice,
    referredPaidCount,
    referredMonthlyRevenue,
  };

  // Compute reward details
  const rewardsResult = computeAffiliateReward(rewardInput, config);
  const comparison = compareAffiliatePaths(rewardInput, config);

  // Fetch granted rewards from database
  const dbRewards = await prisma.affiliateReward.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { createdAt: 'desc' },
  });

  // Safe formatting for client serialization (Decimal to scalar conversion)
  const referralsFormatted = referrals.map(r => ({
    id: r.id,
    referredEmail: r.referredEmail || 'n/a',
    status: r.status,
    planTerm: r.planTerm || 'n/a',
    monthlyPrice: r.monthlyPrice ? Number(r.monthlyPrice) : 0,
    subscribedAt: r.subscribedAt ? r.subscribedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString()
  }));

  const rewardsFormatted = dbRewards.map(r => ({
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    grantedAt: r.grantedAt ? r.grantedAt.toISOString() : null
  }));

  return (
    <AffiliateClient
      module={module}
      affiliate={{
        id: affiliate.id,
        code: affiliate.code,
        name: affiliate.name,
        email: affiliate.email,
        phone: affiliate.phone,
        status: affiliate.status
      }}
      config={config}
      stats={{
        totalReferrals,
        referredPaidCount,
        referredMonthlyRevenue,
        remainingToUnlock: rewardsResult.remainingToUnlock,
        unlocked: rewardsResult.unlocked,
      }}
      rewards={{
        current: rewardsResult,
        comparison,
        granted: rewardsFormatted,
      }}
      referrals={referralsFormatted}
    />
  );
}
