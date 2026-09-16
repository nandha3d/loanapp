import { redirect } from 'next/navigation';
import { getUserAppType } from '@/lib/tenant';
import { modulePath } from '@/types/modules';

export default async function BranchRequestsPage() {
  const appType = await getUserAppType();
  redirect(modulePath(appType, '/settings?tab=branches'));
}

