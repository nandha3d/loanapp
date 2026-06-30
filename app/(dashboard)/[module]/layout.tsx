import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { getDefaultTenantId, getTenantSettings } from '@/lib/tenant';
import { getAppConfig } from '@/lib/appConfig';
import { getThemePreset, THEME_SETTING_KEY } from '@/lib/themes';
import { getDictionary, getCurrentLanguage } from '@/lib/i18n';
import BranchSwitcher from '@/components/layout/BranchSwitcher';
import { getActiveBranchId, getSuperadminBranches } from '@/lib/branch';
import {
  ALL_MODULES,
  isModuleKey,
  isRouteEnabledForModules,
  modulePath,
  normalizeModuleList,
  parseModulePath,
  type ModuleKey,
} from '@/types/modules';
import { getSubscription, isTenantSubscriptionExpired } from '@/lib/subscription';
import SubscriptionExpiredModal from '@/components/layout/SubscriptionExpiredModal';
import TrialBanner from '@/components/TrialBanner';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import WebPushManager from '@/components/push/WebPushManager';

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

  const user = session.user as { id?: string; name?: string | null; role?: string };
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

  const headerStore = await headers();
  const pathname = headerStore.get('x-loantrack-path') || '';
  const pagePath = pathname ? parseModulePath(pathname).page : '';
  const isSharedProfileRoute = pagePath === '/profile';

  if (!enabledModules.includes(requestedModule) && !isSharedProfileRoute) {
    const fallback = enabledModules[0];
    if (fallback) {
      redirect(modulePath(fallback, '/dashboard'));
    }
    redirect('/portal');
  }

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

  // Pending-approvals count for the Sidebar badge (admins/superadmins only).
  // Scope to the active branch when one is selected; superadmin "all"/none =
  // tenant-wide. Cheap indexed counts.
  let pendingApprovals = 0;
  if (role === 'admin' || role === 'superadmin' || role === 'developer') {
    const scopeBranchId =
      activeBranchId && activeBranchId !== 'all'
        ? activeBranchId
        : role === 'admin'
          ? (await getActiveBranchId()) ?? undefined
          : undefined;
    const base = {
      tenantId,
      appType: requestedModule,
      status: 'pending_review',
      ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
    };
    const [pc, pl, pv, pr] = await Promise.all([
      prisma.customer.count({ where: base }),
      prisma.loan.count({ where: base }),
      requestedModule === 'autofinance'
        ? prisma.vehicle.count({
            where: {
              tenantId,
              appType: requestedModule,
              status: 'pending_review',
              deletedAt: null,
              ...(scopeBranchId ? { customer: { branchId: scopeBranchId } } : {}),
            },
          })
        : Promise.resolve(0),
      prisma.approvalRequest.count({
        where: { tenantId, appType: requestedModule, status: 'pending' },
      }),
    ]);
    pendingApprovals = pc + pl + pv + pr;
  }

  // Tenant theme preset (Settings → Theme) overrides the per-module colours.
  const tenantSettings = await getTenantSettings(tenantId);
  const theme = getThemePreset(tenantSettings[THEME_SETTING_KEY]);

  return (
    <div
      className={`app-layout${role === 'agent' ? ' has-bottom-nav' : ''}`}
      style={{
        '--primary': theme?.primary ?? appConfig.primaryColor,
        '--primary-dark': theme?.primaryDark ?? appConfig.primaryDark,
        '--primary-light': theme?.primaryLight ?? appConfig.primaryLight,
        '--accent': theme?.accent ?? appConfig.accentColor,
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
        pendingApprovals={pendingApprovals}
      />
      <main className="main-content">
        <Topbar
          dict={dict}
          currentLang={lang}
          branchSwitcher={<BranchSwitcher branches={branches} activeBranchId={activeBranchId} />}
        />
        <div className="page-content fade-up" style={{ position: 'relative' }}>
          <SubscriptionExpiredModal isExpired={isExpired} role={role} />
          <TrialBanner sub={sub} />
          <OnboardingTour module={requestedModule} role={role} />
          <WebPushManager
            config={{
              apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
              authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
              messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
              appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '',
            }}
          />
          {children}
        </div>
      </main>
      {role === 'agent' && <MobileBottomNav modulePrefix={`/${requestedModule}`} dict={dict} />}
    </div>
  );
}
