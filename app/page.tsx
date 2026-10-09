import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { modulePath } from '@/types/modules';
import ZoloFundsLanding from '@/components/zolofunds/ZoloFundsLanding';

export default async function Home() {
  const headerStore = await headers();
  const rawHost = headerStore.get('x-forwarded-host') || headerStore.get('host') || '';
  const host = rawHost.toLowerCase().split(':')[0];
  const isMarketingDomain = host === 'zolofunds.com' || host === 'www.zolofunds.com';

  const session = await auth();
  
  if (!session?.user) {
    if (isMarketingDomain) {
      return <ZoloFundsLanding />;
    }
    redirect('/login');
  }

  const role = (session.user as any).role;

  if (role === 'superadmin' || role === 'developer') {
    redirect('/portal');
  }

  if (role === 'admin' || role === 'agent') {
    const { getActiveModules } = await import('@/lib/branch');
    const modules = await getActiveModules();
    if (modules.length > 1) {
      redirect('/portal');
    }
    const module = modules[0] ?? 'microlending';
    redirect(modulePath(module, role === 'agent' ? '/agent-dashboard' : '/dashboard'));
  }
  
  redirect('/portal');
}
