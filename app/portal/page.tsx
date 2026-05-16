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
  const tenantId = await getDefaultTenantId();
  
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    select: { enabledModules: true },
  });
  const enabledModules = normalizeModuleList(subscription?.enabledModules);

  // Non-superadmins go straight to their assigned app
  if (role !== 'superadmin' && role !== 'developer') {
    redirect('/dashboard');
  }

  return (
    <AppSelectorClient 
      userName={session.user.name || 'Admin'} 
      userRole={role} 
      enabledModules={enabledModules} 
    />
  );
}
