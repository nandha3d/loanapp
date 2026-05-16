import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function AdminIndexPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (role === 'developer') redirect('/admin/users');
  if (role === 'superadmin') redirect('/admin/users');

  redirect('/login');
}
