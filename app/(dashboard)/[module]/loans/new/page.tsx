import { serverFetch } from '@/lib/api-client/server';
import { getDefaultTenantId, getSetting, getUserAppType } from '@/lib/tenant';
import { getDictionary } from '@/lib/i18n';
import LoanForm from './LoanForm';
import { auth } from '@/lib/auth';

export default async function NewLoanPage({
  searchParams
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const resolvedSearchParams = await searchParams;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  
  const [customersRes, rawPackagesRes, defaultPenalty, currencySymbol, routesRes, agentsRes] = await Promise.all([
    serverFetch<any>('/customers?status=active&page=1&limit=1000'),
    serverFetch<any>('/packages'),
    getSetting(tenantId, 'default_penalty_per_day', '50'),
    getSetting(tenantId, 'currency_symbol', '₹'),
    serverFetch<any>('/routes'),
    serverFetch<any>('/agents')
  ]);

  const customers = customersRes?.data || [];
  const rawPackages = rawPackagesRes?.data || [];
  const routes = routesRes?.data || routesRes || [];
  const agents = agentsRes?.data || agentsRes || [];

  const packages = rawPackages.map((p: any) => ({
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
      viewerRole={userRole}
    />
  );
}

