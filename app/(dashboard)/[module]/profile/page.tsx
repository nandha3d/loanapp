import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { getSuperadminProfile } from '@/lib/profile';
import { modulePath } from '@/types/modules';
import ProfileClient from './ProfileClient';

export default async function SuperadminProfilePage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== 'superadmin') {
    redirect(modulePath(await getUserAppType(), '/dashboard'));
  }

  const tenantId = await getDefaultTenantId();
  const profile = await getSuperadminProfile(user.id, tenantId);

  return <ProfileClient initialProfile={profile} />;
}
