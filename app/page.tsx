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
    
    // Agents go to collection
    if (role === 'agent') {
      redirect('/collection');
    }
    
    // Admins go to dashboard
    redirect('/dashboard');
  }
  
  redirect('/login');
}
