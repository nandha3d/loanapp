import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppSelectorClient from './AppSelectorClient';
import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { normalizeModuleList } from '@/types/modules';
import { getSubscription, isTenantSubscriptionExpired } from '@/lib/subscription';
import SubscriptionExpiredModal from '@/components/layout/SubscriptionExpiredModal';

export default async function SuperAdminPortal() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user as any)?.role;
  
  let tenantId: string | null = null;
  try {
    tenantId = await getDefaultTenantId();
  } catch (err) {
    // No default tenant found
  }
  
  let enabledModules: string[] = [];
  
  if (role === 'admin' || role === 'agent') {
    const { getActiveModules } = await import('@/lib/branch');
    enabledModules = await getActiveModules();
  } else if (tenantId) {
    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { enabledModules: true },
    });
    enabledModules = normalizeModuleList(subscription?.enabledModules);
  } else if (role === 'developer') {
    enabledModules = []; 
  }

  if (role !== 'superadmin' && role !== 'developer' && role !== 'admin' && role !== 'agent') {
    redirect('/dashboard');
  }

  let isExpired = false;
  if (tenantId && role !== 'developer') {
    const sub = await getSubscription(tenantId);
    isExpired = isTenantSubscriptionExpired(sub);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {isExpired && <SubscriptionExpiredModal isExpired={isExpired} role={role} />}
      <AppSelectorClient 
        userName={session.user.name || 'Admin'} 
        userRole={role} 
        enabledModules={enabledModules} 
      />
    </div>
  );
}
