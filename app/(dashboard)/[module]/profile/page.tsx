import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDefaultTenantId, getUserAppType } from '@/lib/tenant';
import { getSuperadminProfile } from '@/lib/profile';
import { getGenericProfile } from '@/lib/genericProfile';
import { modulePath } from '@/types/modules';
import ProfileClient from './ProfileClient';
import AccountProfileClient from './AccountProfileClient';

export default async function ProfilePage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    redirect(modulePath(await getUserAppType(), '/dashboard'));
  }

  const tenantId = await getDefaultTenantId();

  if (user.role === 'superadmin') {
    const profile = await getSuperadminProfile(user.id, tenantId);
    return <ProfileClient initialProfile={profile} />;
  }

  // Non-superadmin (admin/agent/developer): generic account view — no
  // tenant subscription/billing data, just name/phone edit + password change.
  const profile = await getGenericProfile(user.id, tenantId);
  return <AccountProfileClient initialProfile={profile} />;
}
