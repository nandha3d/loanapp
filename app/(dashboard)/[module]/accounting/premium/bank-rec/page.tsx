import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import { listBankAccounts } from './actions';
import BankRecListClient from './BankRecListClient';

export default async function BankRecListPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  if (!['admin','superadmin','developer'].includes(role)) redirect(`/${module}`);

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${module}/accounting`);

  const accounts = await listBankAccounts();
  return <BankRecListClient accounts={accounts as any} module={module} />;
}
