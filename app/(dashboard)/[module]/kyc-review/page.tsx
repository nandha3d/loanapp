import prisma from '@/lib/db';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { modulePath } from '@/types/modules';
import KycReviewClient from './KycReviewClient';
import { getActiveBranchId } from '@/lib/branch';
import { branchScopeWhere } from '@/lib/branchScope';

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

  // Fetch customers with active or pending KYC verification actions. Scoped to
  // the reviewer's own branch and module — a KYC queue is a work queue, and an
  // admin may only act on their own branch's customers (SCOPE-3).
  const activeBranchId = await getActiveBranchId();
  const pendingKycCustomers = await prisma.customer.findMany({
    where: {
      tenantId,
      appType,
      ...branchScopeWhere(activeBranchId),
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
