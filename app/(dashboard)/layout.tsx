import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { getUserAppType, getDefaultTenantId } from '@/lib/tenant';
import { getAppConfig } from '@/lib/appConfig';
import { getDictionary, getCurrentLanguage } from '@/lib/i18n';
import { getEnabledModules } from '@/lib/moduleGate';
import BranchSwitcher from '@/components/layout/BranchSwitcher';
import { getActiveBranchId, getSuperadminBranches } from '@/lib/branch';
import { isRouteEnabledForModules, normalizeModuleList } from '@/types/modules';
import { getSubscription, isTenantSubscriptionExpired } from '@/lib/subscription';
import Link from 'next/link';
import SubscriptionExpiredModal from '@/components/layout/SubscriptionExpiredModal';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as any;
  const role = user.role as string;
  const userId = user.id as string;

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const appConfig = getAppConfig(appType);
  const dict = await getDictionary(tenantId);
  const lang = await getCurrentLanguage(tenantId);
  
  let enabledModules: string[] = [];
  if (role === 'developer') {
    const { getEnabledModules } = await import('@/lib/moduleGate');
    enabledModules = await getEnabledModules(tenantId);
  } else {
    const { getActiveModules } = await import('@/lib/branch');
    enabledModules = await getActiveModules();
  }
  const headerStore = await headers();
  const pathname = headerStore.get('x-loantrack-path') || '';
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
  }

  // Fix 15: Module removal — allow read-only access instead of redirecting
  // Sidebar hides nav links, but direct URL access shows data with a read-only banner
  const isModuleDisabled = role !== 'developer' && pathname && !isRouteEnabledForModules(pathname, enabledModules);
  // Agents are redirected since they shouldn't access disabled module pages
  if (isModuleDisabled && role === 'agent') {
    redirect('/collection');
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
      <Sidebar appType={appType} enabledModules={enabledModules} dict={dict} role={role} userName={user.name || 'User'} />
      <main className="main-content">
        <Topbar
          dict={dict}
          currentLang={lang}
          branchSwitcher={<BranchSwitcher branches={branches} activeBranchId={activeBranchId} />}
        />
        <div className="page-content fade-up" style={{ position: 'relative' }}>
          <SubscriptionExpiredModal isExpired={isExpired} role={role} />
          {isModuleDisabled && !isExpired && (
            <div style={{
              background: '#e8f4fd',
              color: '#02528a',
              padding: '12px 20px',
              borderRadius: '8px',
              border: '1px solid #bce0f9',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <span className="material-icons-outlined">info</span>
              <div>
                <strong style={{ display: 'block' }}>Read-Only Mode</strong>
                <span style={{ fontSize: '0.9rem' }}>This module is not enabled for the current branch. You can view existing data but cannot make changes.</span>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
