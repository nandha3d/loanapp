import { auth } from '@/lib/auth';
import { getUserAppType } from '@/lib/tenant';
import { redirect } from 'next/navigation';
import { modulePath } from '@/types/modules';
import { getJournalEntry } from '../actions';
import JournalDetailClient from './JournalDetailClient';

export default async function JournalDetailPage({ params }: { params: Promise<{ module: string; id: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const appType = await getUserAppType();
  if (!role || role === 'agent') redirect(modulePath(appType, '/dashboard'));
  const { module, id } = await params;
  const entry = await getJournalEntry(id);
  if (!entry) return <div style={{ padding: '2rem', color: '#888' }}>Journal entry not found.</div>;
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>📝 {entry.entryNo ?? '(draft)'}</h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{new Date(entry.entryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}{entry.narration ? ` · ${entry.narration}` : ''}</p>
      </div>
      <JournalDetailClient module={module} entry={entry} role={role} />
    </div>
  );
}
