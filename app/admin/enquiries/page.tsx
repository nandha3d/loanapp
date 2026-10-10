import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getEnquiries, getEnquiryStats } from '@/lib/enquiries';
import EnquiriesTableClient, { EnquiryItem } from './EnquiriesTableClient';

export const metadata = {
  title: 'Platform Enquiries & Leads — Developer Console',
};

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

export default async function AdminEnquiriesPage({ searchParams }: PageProps) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== 'developer') redirect('/admin');

  const resolvedParams = searchParams ? await searchParams : {};
  const currentFilter = resolvedParams.status || 'all';

  const [enquiries, stats] = await Promise.all([
    getEnquiries(currentFilter),
    getEnquiryStats()
  ]);

  // Serialize dates cleanly for the client component
  const serializedEnquiries: EnquiryItem[] = enquiries.map((e) => ({
    ...e,
    created_at: e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
    updated_at: e.updated_at ? new Date(e.updated_at).toISOString() : new Date().toISOString(),
  }));

  return (
    <EnquiriesTableClient
      initialEnquiries={serializedEnquiries}
      stats={stats}
      currentFilter={currentFilter}
    />
  );
}
