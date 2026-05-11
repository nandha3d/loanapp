import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { getUserAppType } from '@/lib/tenant';
import { getAppConfig } from '@/lib/appConfig';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const appType = await getUserAppType();
  const appConfig = getAppConfig(appType);

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
        <Sidebar appType={appType} />
        <main className="main-content">
          <Topbar />
          <div className="page-content fade-up">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
