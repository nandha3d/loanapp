import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { getActiveBranchId } from '@/lib/branch';
import { listPendingSelfPay } from '@/lib/selfPay';
import { isTenantGatewayLive } from '@/lib/tenantRazorpay';
import SelfPayClient from './SelfPayClient';

/** mCollect-B verification queue — confirm borrower self-pay claims. */
export default async function SelfPayQueuePage() {
  const session = await auth();
  if (!session) redirect('/login');
  const tenantId = await getDefaultTenantId();
  const role = (session.user as { role?: string })?.role || 'agent';
  // No role exemption: getActiveBranchId() is already null for "All Branches".
  const branchId = await getActiveBranchId();

  const [pending, gatewayLive] = await Promise.all([
    listPendingSelfPay(tenantId, branchId),
    isTenantGatewayLive(tenantId),
  ]);

  return <SelfPayClient pending={pending} gatewayLive={gatewayLive} />;
}
