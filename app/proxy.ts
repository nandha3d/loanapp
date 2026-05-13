import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Static assets, auth routes, and public API bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/assets') ||
    pathname === '/favicon.ico' ||
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

  // 2. Admin-only Routes (/dashboard, /loans, /penalties, /reports, /settings)
  const adminOnlyRoutes = ['/dashboard', '/loans', '/penalties', '/reports', '/settings'];
  const isAdminOnlyRoute = adminOnlyRoutes.some(route => pathname.startsWith(route));

  if (isAdminOnlyRoute) {
    if (role !== 'admin' && role !== 'superadmin' && role !== 'developer') {
      return NextResponse.redirect(new URL('/collection', request.url));
    }
  }

  // 3. Shared routes: /customers, /approvals, /collection, /notifications — agents allowed
  // Agent cannot use /customers/new?edit= (direct edit), redirect to customers list
  if (role === 'agent' && pathname.startsWith('/customers/new') && request.nextUrl.searchParams.has('edit')) {
    return NextResponse.redirect(new URL('/customers', request.url));
  }

  // 4. Agent Routes (/collection, /notifications) — all authenticated roles allowed
  // No additional block needed here
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
