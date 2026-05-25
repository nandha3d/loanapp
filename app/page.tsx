import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { modulePath } from '@/types/modules';

export default async function Home() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user as any).role;

  if (role === 'superadmin' || role === 'developer') {
    redirect('/portal');
  }

  if (role === 'admin' || role === 'agent') {
    const { getActiveModules } = await import('@/lib/branch');
    const modules = await getActiveModules();
    if (modules.length > 1) {
      redirect('/portal');
    }
    const module = modules[0] ?? 'microlending';
    redirect(modulePath(module, role === 'agent' ? '/agent-dashboard' : '/dashboard'));
  }
  
  redirect('/portal');
}
