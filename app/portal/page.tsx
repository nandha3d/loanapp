import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppSelectorClient from './AppSelectorClient';
import prisma from '@/lib/db';
import { getDefaultTenantId } from '@/lib/tenant';
import { mergeModuleLists, modulePath, normalizeModuleList } from '@/types/modules';
import { getSubscription, getTenantSubscriptionAccessState } from '@/lib/subscription';
import SubscriptionPaywall from '@/components/layout/SubscriptionPaywall';

import { headers } from 'next/headers';

type PortalSearchParams = {
  moduleAccess?: string;
  module?: string;
};

export default async function SuperAdminPortal({
  searchParams,
}: {
  searchParams?: Promise<PortalSearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user as any)?.role;
  const tenantSlug = (session.user as any)?.tenantSlug;

  // Enforce subdomain scoping for non-developers landing on root domain
  if (tenantSlug && tenantSlug !== 'default' && role !== 'developer') {
    const headerStore = await headers();
    const host = headerStore.get('host') || '';
    const hostname = host.split(':')[0];
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost';
    const rootHost = rootDomain.split(':')[0];

    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const supportsSubdomains = rootDomain && !rootDomain.includes('localhost');

    if (hostname === rootHost && !isLocalhost && supportsSubdomains) {
      const protocol = host.includes('localhost') || host.includes('lvh.me') ? 'http' : 'https';
      const port = host.split(':')[1] ? `:${host.split(':')[1]}` : '';
      const redirectUrl = `${protocol}://${tenantSlug}.${hostname}${port}/portal`;
      redirect(redirectUrl);
    }
  }
  
  let tenantId: string | null = null;
  try {
    tenantId = await getDefaultTenantId();
  } catch (err) {
    // No default tenant found
  }

  if (tenantId && role !== 'developer') {
    const subscription = await getSubscription(tenantId);
    const access = getTenantSubscriptionAccessState(subscription);
    if (access.blocked) {
      return <SubscriptionPaywall access={access} role={role} />;
    }
  }
  
  let enabledModules: string[] = [];
  
  if (role === 'admin' || role === 'agent') {
    const { getActiveModules } = await import('@/lib/branch');
    enabledModules = await getActiveModules();
  } else if (role === 'superadmin' && tenantId) {
    const branches = await prisma.branch.findMany({
      where: { tenantId, superadminId: (session.user as any).id, status: 'active' },
      select: { enabledModules: true },
    });
    enabledModules = mergeModuleLists(...branches.map((branch) => branch.enabledModules));
    if (enabledModules.length === 0) {
      const subscription = await prisma.tenantSubscription.findUnique({
        where: { tenantId },
        select: { enabledModules: true },
      });
      enabledModules = normalizeModuleList(subscription?.enabledModules);
    }
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
    redirect(modulePath('microlending', '/dashboard'));
  }

  const resolvedSearchParams = await searchParams;
  const moduleAccess = resolvedSearchParams?.moduleAccess;
  const accessNotice =
    moduleAccess === 'denied'
      ? 'That module is not enabled for your active branch or account.'
      : moduleAccess === 'invalid'
        ? 'That application link is no longer valid.'
        : null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <AppSelectorClient 
        userName={session.user.name || 'Admin'} 
        userRole={role} 
        enabledModules={enabledModules} 
        accessNotice={accessNotice}
      />
    </div>
  );
}
