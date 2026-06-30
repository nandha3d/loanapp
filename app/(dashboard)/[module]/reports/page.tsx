import { redirect } from 'next/navigation';
import { getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const appType = await getUserAppType();
  const resolvedParams = await searchParams;
  const q = new URLSearchParams();
  Object.entries(resolvedParams).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      q.set(key, val);
    }
  });
  const queryString = q.toString() ? `?${q.toString()}` : '';
  redirect(modulePath(appType, `/analytics${queryString}`));
}
