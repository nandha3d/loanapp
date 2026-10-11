import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { modulePath } from '@/types/modules';
import type { Metadata } from 'next';
import ZoloFundsLanding from '@/components/zolofunds/ZoloFundsLanding';
import ZoloFundsShell, { zoloFundsMetadata } from '@/components/zolofunds/ZoloFundsShell';

async function isMarketingHost(): Promise<boolean> {
  const headerStore = await headers();
  const rawHost = headerStore.get('x-forwarded-host') || headerStore.get('host') || '';
  const host = rawHost.toLowerCase().split(':')[0];
  return host === 'zolofunds.com' || host === 'www.zolofunds.com';
}

export async function generateMetadata(): Promise<Metadata> {
  return (await isMarketingHost()) ? zoloFundsMetadata : {};
}

export default async function Home() {
  const isMarketingDomain = await isMarketingHost();

  const session = await auth();

  if (!session?.user) {
    if (isMarketingDomain) {
      return (
        <ZoloFundsShell>
          <ZoloFundsLanding />
        </ZoloFundsShell>
      );
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
