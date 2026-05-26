import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import VendorsClient from './VendorsClient';
import { listVendors, listBills } from './actions';

export default async function VendorsPage({ params, searchParams }: { params: { module: string }; searchParams: { tab?: string } }) {
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  if (!['admin','superadmin','developer'].includes(role)) redirect(`/${params.module}`);

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${params.module}/accounting`);

  const [vendors, bills] = await Promise.all([
    listVendors(),
    listBills(),
  ]);

  return <VendorsClient vendors={vendors as any} bills={bills as any} />;
}
