import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { listActiveAccounts } from '../actions';
import NewEntryClient from './NewEntryClient';

export default async function NewJournalPage({ params }: { params: Promise<{ module: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));
  const { module } = await params;
  const accounts = await listActiveAccounts();
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>📝 New Journal Entry</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Debits must equal credits to post.</p>
      </div>
      <NewEntryClient module={module} accounts={JSON.parse(JSON.stringify(accounts))} />
    </div>
  );
}
