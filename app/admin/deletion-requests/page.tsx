import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDeletionRequests } from '@/lib/deletionRequests';
import DeletionRequestsClient, { type DeletionRequestItem } from './DeletionRequestsClient';

export const metadata = {
  title: 'Account Deletion Requests — Developer Console',
};

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

export default async function AdminDeletionRequestsPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/admin');

  const resolvedParams = searchParams ? await searchParams : {};
  const currentFilter = resolvedParams.status || 'open';

  const all = await getDeletionRequests();
  const rows: DeletionRequestItem[] = all.map((r) => ({
    id: r.id,
    reference: r.reference,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    organization: r.organization,
    reason: r.reason,
    status: r.status,
    admin_note: r.admin_note,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
  }));

  return <DeletionRequestsClient initialRows={rows} currentFilter={currentFilter} />;
}
