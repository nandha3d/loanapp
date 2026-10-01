import { auth } from '@/lib/auth';
import { getUserAppType, getDefaultTenantId } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { getPnLData } from './actions';
import PnLClient from './PnLClient';
import { startOfBusinessDayUtc, formatBusinessDate } from '@/lib/businessTime';

export default async function PnLPage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));
  const { module } = await params;
  const sp = await searchParams;
  const todayStr = formatBusinessDate(startOfBusinessDayUtc());
  const from = sp.from ?? `${todayStr.slice(0, 7)}-01`;
  const to = sp.to ?? todayStr;
  const data = await getPnLData(from, to);
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>📈 Profit & Loss</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Income vs Expenses for the selected period.</p>
      </div>
      <PnLClient module={module} data={data} from={from} to={to} />
    </div>
  );
}
