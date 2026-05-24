import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseModulePath } from '@/types/modules';
import { corsHeadersFor } from '@/lib/cors';

const AGENT_BLOCKED = [
  '/penalties',
  '/reports',
  '/settings',
  '/subscription',
  '/accounting',
  '/analytics',
];

const SUPERADMIN_ONLY: string[] = [];
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
    pathname.startsWith('/borrower') ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function getRoleRedirectTarget(
  pathname: string,
  role: string,
  hasEditSearch = false,
): string | null {
  const { module, page } = parseModulePath(pathname);

  if (role === 'developer') {
    if (
      !DEVELOPER_ONLY.some((prefix) => pathname.startsWith(prefix)) &&
      !pathname.startsWith('/portal') &&
      module === null &&
      !isPublicPath(pathname)
    ) {
      return '/admin';
    }
    return null;
  }

  // Superadmin: allow specific /admin paths for user and branch management
  if (role === 'superadmin' && pathname.startsWith('/admin')) {
    const allowedPaths = ['/admin/users', '/admin/branches', '/admin/branch-requests'];
    if (allowedPaths.some(p => pathname.startsWith(p))) return null;
    return '/portal';
  }

  // Branch Admin: allow /admin/team and block other admin paths
  if (role === 'admin' && pathname.startsWith('/admin')) {
    if (pathname.startsWith('/admin/team')) return null;
    return '/portal';
  }

  // Non-developer, non-superadmin, non-admin blocked from developer-only paths
  if (
    role !== 'superadmin' && 
    role !== 'admin' && 
    DEVELOPER_ONLY.some((prefix) => pathname.startsWith(prefix))
  ) {
    return '/portal';
  }

  if (pathname === '/') {
    return '/portal';
  }

  if (role === 'agent') {
    if (module && AGENT_BLOCKED.some((prefix) => page === prefix || page.startsWith(`${prefix}/`))) {
      return `/${module}/collection`;
    }
    if (!module && AGENT_BLOCKED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return '/portal';
    }
    if (pathname.startsWith('/customers/new') && hasEditSearch) {
      return null;
    }
    if (module && page.match(/^\/customers\/[^/]+\/edit/)) {
      return `/${module}/customers`;
    }
    if (!module && pathname.match(/^\/customers\/[^/]+\/edit/)) {
      return '/customers';
    }
    if (SUPERADMIN_ONLY.some((prefix) => pathname.startsWith(prefix))) {
      return module ? `/${module}/collection` : '/portal';
    }
  }

  return null;
}

async function getSessionToken(request: NextRequest) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  // Hostinger terminates HTTPS before forwarding to Node. Auth.js sets the
  // secure cookie for the public URL, while middleware may see an internal
  // HTTP request. Try both cookie name variants so protected routes can see
  // the same session that /api/auth/session sees.
  return (
    (await getToken({ req: request, secret, secureCookie: true })) ??
    (await getToken({ req: request, secret, secureCookie: false }))
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
  const activeBranch = request.cookies.get('active_branch_id')?.value;
  if (activeBranch) requestHeaders.set('x-loantrack-active-branch', activeBranch);
  const host = request.headers.get('host');
  if (host) requestHeaders.set('x-loantrack-host', host);
  
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenantSlug = extractTenantSlugFromHost(request.headers.get('host'));

  // CORS-01/02/03: mobile API gets CORS treatment.
  if (pathname.startsWith('/api/v1') || pathname.startsWith('/api/auth')) {
    const origin = request.headers.get('origin');
    const corsHeaders = corsHeadersFor(origin);

    // CORS-02: preflight short-circuit — 204 with CORS headers.
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    // Normal request flows through; attach CORS headers on the way back.
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
    return res;
  }

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
  const token = await getSessionToken(request);

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Role-based Redirection
  const role = typeof token.role === 'string' ? token.role : 'agent';
  const redirectTarget = getRoleRedirectTarget(
    pathname,
    role,
    request.nextUrl.searchParams.has('edit'),
  );
  if (redirectTarget) {
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  return nextWithTenantHeaders(request, tenantSlug);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|fonts).*)'],
};
