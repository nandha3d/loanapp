import prisma from '@/lib/db';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { getDictionary } from '@/lib/i18n';
import LoanForm from './LoanForm';

export default async function NewLoanPage({
  searchParams
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const resolvedSearchParams = await searchParams;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  
  const [customers, rawPackages, defaultPenalty, currencySymbol, routes, agents] = await Promise.all([
    prisma.customer.findMany({ 
      where: { tenantId, appType, status: 'active' }, 
      include: { route: true, guarantors: true },
      orderBy: { name: 'asc' } 
    }),
    prisma.loanPackage.findMany({ 
      where: { tenantId, appType, status: 'active' }, 
      orderBy: { name: 'asc' } 
    }),
    getSetting(tenantId, 'default_penalty_per_day', '50'),
    getSetting(tenantId, 'currency_symbol', '₹'),
    prisma.route.findMany({ where: { tenantId, appType, status: 'active' }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { tenantId, appType, role: 'agent', status: 'active' }, orderBy: { name: 'asc' } })
  ]);

  const packages = rawPackages.map(p => ({
    ...p,
    principal: p.principal.toString(),
    deduction: p.deduction.toString(),
    perInstalment: p.perInstalment.toString(),
    penaltyRate: p.penaltyRate.toString(),
  }));

  return (
    <LoanForm 
      customers={customers} 
      packages={packages} 
      defaultPenalty={Number(defaultPenalty)}
      currencySymbol={currencySymbol}
      preSelectedCustomerId={resolvedSearchParams.customerId}
      routes={routes}
      agents={agents}
      dict={dict}
      appType={appType}
    />
  );
}
