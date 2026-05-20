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
    
    // Admins go to portal
    if (role === 'admin') {
      redirect('/portal');
    }

    redirect('/dashboard');
  }
  
  redirect('/login');
}
