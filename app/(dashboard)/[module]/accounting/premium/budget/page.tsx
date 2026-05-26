import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDefaultTenantId } from '@/lib/tenant';
import { isPremiumAccountingEnabled, getFiscalYear, getPeriodKey } from '@/lib/accounting/premium';
import BudgetClient from './BudgetClient';
import { listBudgets } from './actions';

export const metadata = { title: 'Budget' };

export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const role = (session.user as any)?.role;
  const { module } = await params;
  if (!['admin', 'superadmin', 'developer'].includes(role)) redirect(`/${module}`);

  const tenantId = await getDefaultTenantId();
  const enabled = await isPremiumAccountingEnabled(tenantId);
  if (!enabled) redirect(`/${module}/accounting`);

  const today = new Date();
  const currentFy = getFiscalYear(today);
  const sp = await searchParams;
  const currentPeriod = sp.period ?? getPeriodKey(today);
  const budgets = await listBudgets();

  return (
    <BudgetClient
      budgets={budgets}
      currentFy={currentFy}
      currentPeriod={currentPeriod}
    />
  );
}
