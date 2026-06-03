import { auth } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { getDefaultTenantId } from '@/lib/tenant';
import { getAppConfig } from '@/lib/appConfig';
import { getDictionary, getCurrentLanguage } from '@/lib/i18n';
import BranchSwitcher from '@/components/layout/BranchSwitcher';
import { getActiveBranchId, getSuperadminBranches } from '@/lib/branch';
import {
  ALL_MODULES,
  isModuleKey,
  isRouteEnabledForModules,
  modulePath,
  normalizeModuleList,
  type ModuleKey,
} from '@/types/modules';
import { getSubscription, isTenantSubscriptionExpired } from '@/lib/subscription';
import SubscriptionExpiredModal from '@/components/layout/SubscriptionExpiredModal';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ module: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as any;
  const role = user.role as string;
  const userId = user.id as string;
  const { module } = await params;

  if (!isModuleKey(module)) {
    notFound();
  }

  const requestedModule: ModuleKey = module;
  const tenantId = await getDefaultTenantId();
  const appConfig = getAppConfig(requestedModule);
  const dict = await getDictionary(tenantId);
  const lang = await getCurrentLanguage(tenantId);

  let enabledModules: ModuleKey[] = [];
  if (role === 'developer') {
    enabledModules = [...ALL_MODULES];
  } else if (role === 'superadmin') {
    const rawBranches = await getSuperadminBranches(tenantId, userId);
    const activeBranchId = await getActiveBranchId();
    const activeBranch = rawBranches.find((branch) => branch.id === activeBranchId) ?? rawBranches[0];
    enabledModules = activeBranch ? normalizeModuleList(activeBranch.enabledModules) : [...ALL_MODULES];
  } else {
    const { getActiveModules } = await import('@/lib/branch');
    enabledModules = await getActiveModules();
  }

  if (!enabledModules.includes(requestedModule)) {
    const fallback = enabledModules[0];
    if (fallback) {
      redirect(modulePath(fallback, '/dashboard'));
    }
    redirect('/portal');
  }

  const headerStore = await headers();
  const pathname = headerStore.get('x-loantrack-path') || '';
  if (pathname && !isRouteEnabledForModules(pathname, [requestedModule])) {
    notFound();
  }

  let branches: { id: string; name: string; enabledModules: string[] }[] = [];
  let activeBranchId: string | null = null;

  if (role === 'superadmin') {
    const rawBranches = await getSuperadminBranches(tenantId, userId);
    branches = rawBranches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      enabledModules: normalizeModuleList(branch.enabledModules),
    }));
    activeBranchId = await getActiveBranchId();
    if (branches.length > 1) {
      branches.unshift({
        id: 'all',
        name: 'All Branches',
        enabledModules: [...ALL_MODULES],
      });
      if (!activeBranchId) {
        const cookieStore = await cookies();
        if (cookieStore.get('active_branch_id')?.value === 'all') {
          activeBranchId = 'all';
        }
      }
    }
  }

  const sub = await getSubscription(tenantId);
  const isExpired = isTenantSubscriptionExpired(sub);

  return (
    <div
      className="app-layout"
      style={{
        '--primary': appConfig.primaryColor,
        '--primary-dark': appConfig.primaryDark,
        '--primary-light': appConfig.primaryLight,
        '--accent': appConfig.accentColor,
      } as React.CSSProperties}
    >
      <Sidebar
        appType={requestedModule}
        enabledModules={enabledModules}
        dict={dict}
        role={role}
        userName={user.name || 'User'}
        modulePrefix={`/${requestedModule}`}
        subscription={sub}
      />
      <main className="main-content">
        <Topbar
          dict={dict}
          currentLang={lang}
          branchSwitcher={<BranchSwitcher branches={branches} activeBranchId={activeBranchId} />}
        />
        <div className="page-content fade-up" style={{ position: 'relative' }}>
          <SubscriptionExpiredModal isExpired={isExpired} role={role} />
          {children}
        </div>
      </main>
    </div>
  );
}
