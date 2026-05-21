import prisma from '@/lib/db';
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
  
  const [routes, agents] = await Promise.all([
    prisma.route.findMany({ where: { tenantId, appType, status: 'active' }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { tenantId, appType, role: 'agent', status: 'active' }, orderBy: { name: 'asc' } })
  ]);

  let customer = null;
  if (resolvedSearchParams.edit) {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'developer') {
      redirect(modulePath(appType, `/customers/${resolvedSearchParams.edit}`));
    }

    customer = await prisma.customer.findUnique({
      where: { id: resolvedSearchParams.edit, tenantId },
      include: { securityCheques: true, guarantors: true }
    });
    if (!customer) {
      redirect(modulePath(appType, '/customers'));
    }
  }

  return <CustomerForm routes={routes} agents={agents} customer={customer} dict={dict} />;
}
