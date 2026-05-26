import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { getBalanceSheetData } from './actions';
import BalanceSheetClient from './BalanceSheetClient';

export default async function BalanceSheetPage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ asOf?: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));
  const { module } = await params;
  const sp = await searchParams;
  const asOf = sp.asOf ?? new Date().toISOString().split('T')[0];
  const data = await getBalanceSheetData(asOf);
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>⚖️ Balance Sheet</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Assets = Liabilities + Equity</p>
      </div>
      <BalanceSheetClient module={module} data={data} asOf={asOf} />
    </div>
  );
}
