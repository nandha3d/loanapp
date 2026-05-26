import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { listJournalEntries } from './actions';
import JournalListClient from './JournalListClient';
import Link from 'next/link';

export default async function JournalPage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ from?: string; to?: string; status?: string; search?: string; page?: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));
  const { module } = await params;
  const sp = await searchParams;
  const data = await listJournalEntries({ from: sp.from, to: sp.to, status: sp.status, search: sp.search, page: sp.page ? parseInt(sp.page) : 1 });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>📝 Journal Entries</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Double-entry bookkeeping ledger.</p>
        </div>
        <Link href={`/${module}/accounting/premium/journal/new`} style={{ padding: '8px 16px', background: 'var(--primary,#2563eb)', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>+ New Entry</Link>
      </div>
      <JournalListClient module={module} data={data} />
    </div>
  );
}
