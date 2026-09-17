import { serverFetch } from '@/lib/api-client/server';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import CustomerForm from './CustomerForm';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { modulePath } from '@/types/modules';

export default async function NewCustomerPage({
  searchParams
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const resolvedSearchParams = await searchParams;
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const dict = await getDictionary(tenantId);
  const session = await auth();
  const userRole = (session?.user as any)?.role || 'agent';
  
  const [routesRes, agentsRes] = await Promise.all([
    serverFetch<any>('/routes'),
    serverFetch<any>('/agents')
  ]);

  const routes = routesRes?.data || routesRes || [];
  const agents = agentsRes?.data || agentsRes || [];

  let customer = null;
  if (resolvedSearchParams.edit) {
    if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
      redirect(modulePath(appType, `/customers/${resolvedSearchParams.edit}`));
    }

    try {
      const customerRes = await serverFetch<any>(`/customers/${resolvedSearchParams.edit}`);
      customer = customerRes?.data;
    } catch (err) {
      // If error or not found
    }

    if (!customer) {
      redirect(modulePath(appType, '/customers'));
    }
  }

  return <CustomerForm appType={appType} routes={routes} agents={agents} customer={customer} dict={dict} viewerRole={userRole} />;
}

