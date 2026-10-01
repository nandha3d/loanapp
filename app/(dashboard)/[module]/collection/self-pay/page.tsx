import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { listPendingSelfPay } from '@/lib/selfPay';
import { isTenantGatewayLive } from '@/lib/tenantRazorpay';
import SelfPayClient from './SelfPayClient';

/** mCollect-B verification queue — confirm borrower self-pay claims. */
export default async function SelfPayQueuePage({ params }: { params?: Promise<{ module?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const moduleParam = resolvedParams?.module;
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as { role?: string })?.role || 'agent';
  if (role === 'agent') {
    redirect(moduleParam ? `/${moduleParam}/agent-dashboard` : '/agent-dashboard');
  }
  const tenantId = await getDefaultTenantId();
  // No role exemption: getActiveBranchId() is already null for "All Branches".
  const branchId = await getActiveBranchId();

  const [pending, gatewayLive] = await Promise.all([
    listPendingSelfPay(tenantId, branchId, moduleParam),
    isTenantGatewayLive(tenantId),
  ]);

  return <SelfPayClient pending={pending} gatewayLive={gatewayLive} />;
}
