import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled } from '@/lib/accounting/premium';
import ApprovalsClient from './ApprovalsClient';
import { listApprovals } from './actions';

export default async function ApprovalsPage({ params }: { params: { module: string } }) {
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  if (!['admin','superadmin','developer'].includes(role)) redirect(`/${params.module}`);

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${params.module}/accounting`);

  const approvals = await listApprovals({ status: 'pending' });

  return <ApprovalsClient approvals={approvals as any} userRole={role} />;
}
