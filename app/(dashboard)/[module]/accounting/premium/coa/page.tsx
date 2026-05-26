import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { listAccounts } from './actions';
import CoAClient from './CoAClient';

export default async function CoAPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));
  const accounts = await listAccounts(true);
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>📋 Chart of Accounts</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>General ledger accounts. Reseed to populate with the Indian micro-lending default set.</p>
      </div>
      <CoAClient initialAccounts={JSON.parse(JSON.stringify(accounts))} />
    </div>
  );
}
