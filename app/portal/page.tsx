import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppSelectorClient from './AppSelectorClient';

export default async function SuperAdminPortal() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user as any)?.role;
  const appType = (session.user as any)?.appType || 'microlending';

  // Non-superadmins go straight to their assigned app
  if (role !== 'superadmin' && role !== 'developer') {
    redirect('/dashboard');
  }

  return <AppSelectorClient userName={session.user.name || 'Admin'} userRole={role} />;
}
