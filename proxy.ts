import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AGENT_BLOCKED = [
  '/dashboard',
  '/penalties',
  '/reports',
  '/settings',
  '/approvals',
  '/subscription',
];

const SUPERADMIN_ONLY = ['/portal', '/admin'];
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

export function getRoleRedirectTarget(
  pathname: string,
  role: string,
  hasEditSearch = false,
): string | null {
  if (role === 'developer') {
    if (
      !DEVELOPER_ONLY.some((prefix) => pathname.startsWith(prefix)) &&
      !pathname.startsWith('/portal') &&
      !isPublicPath(pathname)
    ) {
      return '/admin';
    }
    return null;
  }

  if (DEVELOPER_ONLY.some((prefix) => pathname.startsWith(prefix))) {
    return '/dashboard';
  }

  if (role === 'superadmin' && pathname.startsWith('/admin')) {
    return '/dashboard';
  }

  if (role === 'admin' && pathname.startsWith('/portal')) {
    return '/dashboard';
  }

  if (role === 'agent') {
    if (AGENT_BLOCKED.some((prefix) => pathname.startsWith(prefix))) {
      return '/collection';
    }
    if (pathname.startsWith('/customers/new') && hasEditSearch) {
      return null;
    }
    if (pathname.match(/^\/customers\/[^/]+\/edit/)) {
      return '/customers';
    }
    if (SUPERADMIN_ONLY.some((prefix) => pathname.startsWith(prefix))) {
      return '/collection';
    }
  }

  return null;
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
  
  // NOTE: In some Next.js versions, passing headers back into NextResponse.next() 
  // can cause the POST body to be consumed/lost. 
  // We only do this for non-Auth API routes and documents.
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenantSlug = extractTenantSlugFromHost(request.headers.get('host'));

  // 1. Handle Public Paths
  if (isPublicPath(pathname)) {
    // CRITICAL: Avoid modifying request headers for Auth API routes to prevent body consumption issues
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
  // On Hostinger, SSL termination might make getToken think it's HTTP.
  // We explicitly check for secure cookies if we are on a production-like domain.
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  
  let token = await getToken({ 
    req: request, 
    secret,
    // Explicitly set secureCookie if we're on HTTPS or production
    secureCookie: request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production',
  });

  // Fallback check if token is still null (handle cases where protocol detection fails)
  if (!token && process.env.NODE_ENV === 'production') {
    token = await getToken({ 
      req: request, 
      secret,
      secureCookie: true,
    });
  }

  if (!token) {
    // If no token, redirect to login
    const loginUrl = new URL('/login', request.url);
    // Preserving the original destination for redirect back after login
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
