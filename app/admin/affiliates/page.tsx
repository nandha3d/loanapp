import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAffiliateConfig } from '@/lib/affiliate';
import AffiliatesClient from './AffiliatesClient';

export default async function AdminAffiliatesPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  
  if (role !== 'developer') {
    redirect('/portal');
  }

  // Fetch all affiliates
  const affiliates = await prisma.affiliate.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Fetch all referrals
  const referrals = await prisma.referral.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Fetch all affiliate rewards
  const rewards = await prisma.affiliateReward.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Fetch all visits and leads
  const visits = await prisma.affiliateVisit.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const leads = await prisma.referralLead.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Load current global config settings
  const config = await getAffiliateConfig();

  // Serialization formatting: decimal to float/number and date to string
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
    metadata: l.metadata ? JSON.parse(JSON.stringify(l.metadata)) : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  return (
    <AffiliatesClient
      initialAffiliates={affiliatesFormatted}
      initialReferrals={referralsFormatted}
      initialRewards={rewardsFormatted}
      initialConfig={config}
      initialVisits={visitsFormatted}
      initialLeads={leadsFormatted}
    />
  );
}
