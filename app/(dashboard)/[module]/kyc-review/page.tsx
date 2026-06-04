import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { modulePath } from '@/types/modules';
import KycReviewClient from './KycReviewClient';

export default async function KycReviewPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const { module } = await params;
  
  if (!userRole) {
    redirect('/login');
  }

  // Gated for admins and higher roles
  if (userRole === 'agent') {
    redirect(modulePath(module, '/agent-dashboard'));
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);

  // Check subscription
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { kycEnabled: true }
  });
  const kycEnabled = sub?.kycEnabled || false;

  // Fetch customers with active or pending KYC verification actions
  const pendingKycCustomers = await prisma.customer.findMany({
    where: {
      tenantId,
      kycStatus: {
        in: ['video_under_review', 'video_submitted', 'otp_initiated']
      }
    },
    include: {
      kycSessions: {
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      agent: { select: { name: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <KycReviewClient
      customers={JSON.parse(JSON.stringify(pendingKycCustomers))}
      kycEnabled={kycEnabled}
      userRole={userRole}
      dict={dict}
    />
  );
}
