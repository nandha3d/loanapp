import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Static assets and auth routes bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login'
  ) {
    return NextResponse.next();
  }

  // Not logged in
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = (session.user as any)?.role || 'agent';

  // 1. Super Admin & Developer Routes (/portal, /admin)
  if (pathname.startsWith('/portal') || pathname.startsWith('/admin')) {
    if (role !== 'superadmin' && role !== 'developer') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 2. Admin Routes (/dashboard, /customers, /loans, /penalties, /reports, /settings)
  const adminRoutes = ['/dashboard', '/customers', '/loans', '/penalties', '/reports', '/settings', '/approvals'];
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  
  if (isAdminRoute) {
    if (role !== 'admin' && role !== 'superadmin' && role !== 'developer') {
      return NextResponse.redirect(new URL('/collection', request.url));
    }
  }

  // 3. Agent Routes (/collection, /notifications)
  // Agents can access these, Admins and Superadmins can too.
  // We don't need a specific block here since agents are blocked from admin routes above.
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
