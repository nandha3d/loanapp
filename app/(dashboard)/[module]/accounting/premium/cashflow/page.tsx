import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { getCashFlowData } from './actions';
import CashFlowClient from './CashFlowClient';

export default async function CashFlowPage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));
  const { module } = await params;
  const sp = await searchParams;
  const now = new Date();
  const from = sp.from ?? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const to = sp.to ?? now.toISOString().split('T')[0];
  const data = await getCashFlowData(from, to);
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>💧 Cash Flow Statement</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Movement of cash and cash equivalents.</p>
      </div>
      <CashFlowClient module={module} data={data} from={from} to={to} />
    </div>
  );
}
