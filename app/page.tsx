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

  // §7.2 — an agent may not switch modules, so the portal (the module/branch
  // selector) is never their landing page even when the tenant runs several
  // modules. They go straight to their own appType's workspace.
  if (role === 'agent') {
    const module = (session.user as any).appType || 'microlending';
    redirect(modulePath(module, '/agent-dashboard'));
  }

  if (role === 'admin') {
    const { getActiveModules } = await import('@/lib/branch');
    const modules = await getActiveModules();
    if (modules.length > 1) {
      redirect('/portal');
    }
    const module = modules[0] ?? 'microlending';
    redirect(modulePath(module, '/dashboard'));
  }
  
  redirect('/portal');
}
