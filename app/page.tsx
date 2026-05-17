import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function Home() {
  const session = await auth();
  
  if (session?.user) {
    const role = (session.user as any).role;
    
    // Super admins and developers go to app selector portal
    if (role === 'superadmin' || role === 'developer') {
      redirect('/portal');
    }
    
    // Agents go to portal
    if (role === 'agent') {
      redirect('/portal');
    }
    
    // Admins go to portal if they have multiple modules, otherwise dashboard
    if (role === 'admin') {
      const { getActiveModules } = await import('@/lib/branch');
      const modules = await getActiveModules();
      if (modules.length > 1) {
        redirect('/portal');
      } else {
        redirect('/dashboard');
      }
    }

    redirect('/dashboard');
  }
  
  redirect('/login');
}
