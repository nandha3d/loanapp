import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  extractTenantSlugFromHost,
  isTenantHostAllowedForSession,
} from '@/lib/tenant';
import { isTenantTrialExpired } from '@/lib/subscription';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type ProxySessionUser = {
  role?: string | null;
  tenantId?: string | null;
};

const AGENT_BLOCKED = [
  '/dashboard',
  '/loans',
  '/penalties',
  '/reports',
  '/settings',
  '/vehicles',
  '/chits',
];

const SUPERADMIN_ONLY = ['/portal', '/admin'];
const PUBLIC_PREFIXES = [
  '/_next',
  '/api',
  '/assets',
];

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/favicon.ico' ||
    pathname === '/login' ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function nextWithTenantHeaders(request: NextRequest, tenantSlug: string | null) {
  const requestHeaders = new Headers(request.headers);
  if (tenantSlug) requestHeaders.set('x-loantrack-tenant-slug', tenantSlug);
  requestHeaders.set('x-loantrack-path', request.nextUrl.pathname);
  const host = request.headers.get('host');
  if (host) requestHeaders.set('x-loantrack-host', host);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

async function getTenantIdForSlug(tenantSlug: string | null): Promise<string | null> {
  if (!tenantSlug) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, status: true },
  });
  return tenant?.status === 'active' ? tenant.id : null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenantSlug = extractTenantSlugFromHost(request.headers.get('host'));

  if (isPublicPath(pathname)) {
    return nextWithTenantHeaders(request, tenantSlug);
  }

  const session = await auth();
  const user = session?.user as ProxySessionUser | undefined;

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const requestedTenantId = await getTenantIdForSlug(tenantSlug);
  if (!isTenantHostAllowedForSession({
    requestedTenantId,
    sessionTenantId: user.tenantId,
    role: user.role,
  })) {
    return NextResponse.json({ error: 'Tenant host does not match authenticated user' }, { status: 403 });
  }

  const role = user.role || 'agent';

  if (SUPERADMIN_ONLY.some((prefix) => pathname.startsWith(prefix))) {
    if (role !== 'superadmin' && role !== 'developer') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (role === 'agent') {
    if (AGENT_BLOCKED.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.redirect(new URL('/collection', request.url));
    }
    if (pathname.startsWith('/customers/new') && request.nextUrl.searchParams.has('edit')) {
      return NextResponse.redirect(new URL('/customers', request.url));
    }
    if (SUPERADMIN_ONLY.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.redirect(new URL('/collection', request.url));
    }
  }

  if (role === 'admin' && SUPERADMIN_ONLY.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (user.tenantId && pathname !== '/subscription') {
    const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId: user.tenantId } });
    if (sub && (sub.status !== 'active' || isTenantTrialExpired(sub))) {
      return NextResponse.redirect(new URL('/subscription', request.url));
    }
  }

  return nextWithTenantHeaders(request, tenantSlug);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};
