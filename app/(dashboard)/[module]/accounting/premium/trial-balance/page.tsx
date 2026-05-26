import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { getTrialBalanceData } from './actions';
import TrialBalanceClient from './TrialBalanceClient';

export default async function TrialBalancePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ asOf?: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));
  const { module } = await params;
  const sp = await searchParams;
  const asOf = sp.asOf ?? new Date().toISOString().split('T')[0];
  const data = await getTrialBalanceData(asOf);
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>🔢 Trial Balance</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cumulative debit/credit totals for all accounts.</p>
      </div>
      <TrialBalanceClient module={module} data={data} asOf={asOf} />
    </div>
  );
}
