import prisma from '@/lib/db';
import { getDefaultTenantId, getTenantSettings, getUserAppType } from '@/lib/tenant';
import SettingsClient from './SettingsClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const session = await auth();
  if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
    redirect('/dashboard');
  }

  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  
  const [routes, rawPackages, users, settings] = await Promise.all([
    prisma.route.findMany({ 
      where: { tenantId, appType },
      include: { assignedAgent: true, _count: { select: { customers: true } } }
    }),
    prisma.loanPackage.findMany({ where: { tenantId, appType } }),
    prisma.user.findMany({ where: { tenantId, appType } }),
    getTenantSettings(tenantId)
  ]);

  const packages = rawPackages.map(p => ({
    ...p,
    principal: p.principal.toString(),
    deduction: p.deduction.toString(),
    perInstalment: p.perInstalment.toString(),
    penaltyRate: p.penaltyRate.toString(),
  }));

  return (
    <SettingsClient 
      routes={routes} 
      packages={packages} 
      users={users} 
      settings={settings} 
      currencySymbol={settings.currency_symbol || '₹'}
    />
  );
}
