import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Routes agents cannot access (redirected to /collection)
const AGENT_BLOCKED = [
  '/dashboard', '/loans', '/penalties', '/reports',
  '/settings', '/vehicles', '/chits',
];

// Routes only superadmin/developer can access
const SUPERADMIN_ONLY = ['/portal', '/admin'];

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const user = req.auth?.user as any;

  // Public: bypass static assets, auth routes, and login page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico' ||
    pathname === '/login'
  ) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const role = user.role as string;

  // Superadmin/Developer only routes (/portal, /admin)
  if (SUPERADMIN_ONLY.some((p) => pathname.startsWith(p))) {
    if (role !== 'superadmin' && role !== 'developer') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Agent restrictions
  if (role === 'agent') {
    if (AGENT_BLOCKED.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/collection', req.url));
    }
    // Block agents from the customer edit URL
    if (pathname.startsWith('/customers/new') && nextUrl.searchParams.has('edit')) {
      return NextResponse.redirect(new URL('/customers', req.url));
    }
    if (SUPERADMIN_ONLY.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/collection', req.url));
    }
  }

  // Admin restrictions (no portal/admin panel access)
  if (role === 'admin') {
    if (SUPERADMIN_ONLY.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets|uploads).*)',
  ],
};
