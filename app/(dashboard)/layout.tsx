import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { getUserAppType, getDefaultTenantId } from '@/lib/tenant';
import { getAppConfig } from '@/lib/appConfig';
import { getDictionary, getCurrentLanguage } from '@/lib/i18n';
import { getEnabledModules } from '@/lib/moduleGate';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const appConfig = getAppConfig(appType);
  const dict = await getDictionary(tenantId);
  const lang = await getCurrentLanguage(tenantId);
  const enabledModules = await getEnabledModules(tenantId);

  return (
    <SessionProvider session={session}>
      <div 
        className="app-layout"
        style={{ 
          '--primary': appConfig.primaryColor,
          '--primary-dark': appConfig.primaryDark,
          '--primary-light': appConfig.primaryLight,
          '--accent': appConfig.accentColor,
        } as React.CSSProperties}
      >
        <Sidebar appType={appType} enabledModules={enabledModules} dict={dict} />
        <main className="main-content">
          <Topbar dict={dict} currentLang={lang} />
          <div className="page-content fade-up">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
