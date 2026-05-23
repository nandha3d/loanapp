import prisma from '@/lib/db';
import { getDefaultTenantId, getTenantSettings, getUserAppType } from '@/lib/tenant';
import SettingsClient from './SettingsClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { modulePath } from '@/types/modules';
import { getSubscription } from '@/lib/subscription';

export default async function SettingsPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
    redirect(modulePath(appType, '/collection'));
  }

  const tenantId = await getDefaultTenantId();
  const dict = await getDictionary(tenantId);
  
  const [routes, rawPackages, users, settings, currentUser, subscription, bureauCredential] = await Promise.all([
    prisma.route.findMany({ 
      where: { tenantId, appType },
      include: { 
        assignedAgent: true, 
        _count: { select: { customers: true } },
        routeAgents: { include: { agent: { select: { id: true, name: true } } } }
      }
    }),
    prisma.loanPackage.findMany({ where: { tenantId, appType } }),
    prisma.user.findMany({ where: { tenantId, appType } }),
    getTenantSettings(tenantId),
    prisma.user.findUnique({ where: { id: session?.user?.id } }),
    getSubscription(tenantId),
    prisma.bureauCredential.findUnique({ where: { tenantId } }),
  ]);

  const packages = rawPackages.map(p => ({
    ...p,
    principal: p.principal.toString(),
    deduction: p.deduction.toString(),
    perInstalment: p.perInstalment.toString(),
    penaltyRate: p.penaltyRate.toString(),
  }));

  // Decrypt credential fields securely on the server
  let decryptedCreds: any = null;
  if (bureauCredential) {
    const { decryptField } = await import('@/lib/pii');
    decryptedCreds = {
      provider: bureauCredential.provider,
      memberId: decryptField(bureauCredential.memberId) || '',
      apiKey: decryptField(bureauCredential.apiKey) || '',
      apiSecret: bureauCredential.apiSecret ? (decryptField(bureauCredential.apiSecret) || '') : '',
      environment: bureauCredential.environment,
      isActive: bureauCredential.isActive,
      hasCert: !!bureauCredential.bureauCert,
      hasKey: !!bureauCredential.bureauKey,
    };
  }

  return (
    <SettingsClient 
      routes={routes} 
      packages={packages} 
      users={users} 
      settings={settings} 
      currencySymbol={settings.currency_symbol || '₹'}
      dict={dict}
      currentUser={currentUser}
      subscription={subscription}
      bureauCredential={decryptedCreds}
    />
  );
}
