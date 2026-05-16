import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppSelectorClient from './AppSelectorClient';
import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { normalizeModuleList } from '@/types/modules';

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
  
  if (tenantId) {
    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { enabledModules: true },
    });
    enabledModules = normalizeModuleList(subscription?.enabledModules);
  } else if (role === 'developer') {
    enabledModules = []; 
  }

  if (role !== 'superadmin' && role !== 'developer') {
    redirect('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <AppSelectorClient 
        userName={session.user.name || 'Admin'} 
        userRole={role} 
        enabledModules={enabledModules} 
      />
    </div>
  );
}
