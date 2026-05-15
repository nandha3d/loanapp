import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  '/fonts',
];

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/favicon.ico' ||
    pathname === '/login' ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  return host.toLowerCase().split(':')[0] || null;
}

function extractTenantSlugFromHost(
  host: string | null | undefined,
  rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.APP_ROOT_DOMAIN || '',
): string | null {
  const hostname = normalizeHost(host);
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return null;
  }

  const normalizedRoot = normalizeHost(rootDomain);
  if (normalizedRoot) {
    if (hostname === normalizedRoot) return null;
    if (hostname.endsWith(`.${normalizedRoot}`)) {
      const slug = hostname.slice(0, -(normalizedRoot.length + 1)).split('.')[0];
      return slug || null;
    }
    return null;
  }

  const labels = hostname.split('.');
  return labels.length > 2 ? labels[0] : null;
}

function nextWithTenantHeaders(
  request: NextRequest,
  tenantSlug: string | null,
  options: { forceDocument?: boolean } = {},
) {
  const requestHeaders = new Headers(request.headers);
  if (options.forceDocument) {
    requestHeaders.delete('rsc');
    requestHeaders.delete('next-router-prefetch');
    requestHeaders.delete('next-router-state-tree');
    requestHeaders.delete('next-url');
    requestHeaders.set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  }
  if (tenantSlug) requestHeaders.set('x-loantrack-tenant-slug', tenantSlug);
  requestHeaders.set('x-loantrack-path', request.nextUrl.pathname);
  const host = request.headers.get('host');
  if (host) requestHeaders.set('x-loantrack-host', host);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenantSlug = extractTenantSlugFromHost(request.headers.get('host'));

  if (isPublicPath(pathname)) {
    const response = nextWithTenantHeaders(request, tenantSlug, { forceDocument: pathname === '/login' });
    if (pathname === '/login') {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Vary', 'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Url, Accept');
    }
    return response;
  }

  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = typeof token.role === 'string' ? token.role : 'agent';

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

  return nextWithTenantHeaders(request, tenantSlug);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|fonts).*)'],
};
