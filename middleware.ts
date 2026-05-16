import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Agents can no longer be blocked from loans/customers — they can create both.
// They ARE still blocked from management/reporting/settings views.
const AGENT_BLOCKED = [
  '/dashboard',     // KPI dashboard (admin+ only)
  '/penalties',
  '/reports',
  '/settings',
  '/approvals',
  '/subscription',
];

const SUPERADMIN_ONLY = ['/portal'];
const DEVELOPER_ONLY = ['/admin'];

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

  // Forward active branch cookie as a header for server components
  const activeBranch = request.cookies.get('active_branch_id')?.value;
  if (activeBranch) {
    requestHeaders.set('x-loantrack-active-branch', activeBranch);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenantSlug = extractTenantSlugFromHost(request.headers.get('host'));

  // 1. Handle Public Paths
  if (isPublicPath(pathname)) {
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    const response = nextWithTenantHeaders(request, tenantSlug, { forceDocument: pathname === '/login' });
    if (pathname === '/login') {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Vary', 'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Url, Accept');
    }
    return response;
  }

  // 2. Token Retrieval
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  let token = await getToken({
    req: request,
    secret,
    secureCookie: request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production',
  });

  if (!token && process.env.NODE_ENV === 'production') {
    token = await getToken({
      req: request,
      secret,
      secureCookie: true,
    });
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Role-based Redirection
  const role = typeof token.role === 'string' ? token.role : 'agent';

  // Developer: can access /admin and /portal only; redirect all other paths
  if (role === 'developer') {
    if (!DEVELOPER_ONLY.some(p => pathname.startsWith(p)) &&
        !pathname.startsWith('/portal') &&
        !isPublicPath(pathname)) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Superadmin/admin/agent blocked from developer-only paths
  if (role !== 'developer' && DEVELOPER_ONLY.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Superadmin: /portal allowed; /admin blocked
  if (role === 'superadmin' && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Admin: block superadmin-only paths
  if (role === 'admin' && pathname.startsWith('/portal')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Agent: block reporting/management paths
  if (role === 'agent') {
    if (AGENT_BLOCKED.some(prefix => pathname.startsWith(prefix))) {
      return NextResponse.redirect(new URL('/collection', request.url));
    }
    if (SUPERADMIN_ONLY.some(prefix => pathname.startsWith(prefix))) {
      return NextResponse.redirect(new URL('/collection', request.url));
    }
  }

  return nextWithTenantHeaders(request, tenantSlug);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|fonts).*)'],
};
