import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseModulePath } from '@/types/modules';
import { corsHeadersFor } from '@/lib/cors';

const AGENT_BLOCKED = [
  '/dashboard',
  '/vehicles',
  '/chits',
  '/penalties',
  '/reports',
  '/settings',
  '/subscription',
  '/accounting',
  '/analytics',
];

const SUPERADMIN_ONLY: string[] = [];
const DEVELOPER_ONLY = ['/admin'];
const PUBLIC_BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const PUBLIC_PREFIXES = [
  '/_next',
  '/api',
  '/assets',
  '/fonts',
];

// Public marketing site (app/(marketing) route group). These pages live outside
// the authenticated app and must be reachable by anonymous visitors.
const MARKETING_PATHS = [
  '/home',
  '/products',
  '/solutions',
  '/pricing',
  '/about-us',
  '/contact',
];

function normalizeBasePath(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function withBasePath(path: string): string {
  if (!PUBLIC_BASE_PATH) return path;
  if (!path.startsWith('/')) return path;
  if (path === PUBLIC_BASE_PATH || path.startsWith(`${PUBLIC_BASE_PATH}/`)) return path;
  return `${PUBLIC_BASE_PATH}${path}`;
}

function isInternalHost(host: string): boolean {
  const hostname = host.toLowerCase().split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function getPublicOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '') || 'https';
  const requestHost =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    request.nextUrl.host;

  if (requestHost && !isInternalHost(requestHost)) {
    return `${proto}://${requestHost}`;
  }

  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEB_APP_URL ||
    process.env.APP_URL ||
    '';
  if (configured) {
    const parsed = new URL(configured);
    return parsed.origin;
  }

  return `${proto}://${requestHost}`;
}

function publicUrl(request: NextRequest, path: string): URL {
  return new URL(withBasePath(path), getPublicOrigin(request));
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/favicon.ico' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/exchange') ||
    pathname.startsWith('/r/') ||
    pathname === '/affiliate' ||
    pathname.startsWith('/borrower') ||
    MARKETING_PATHS.includes(pathname) ||
    // SEO + crawler endpoints and generated social images must be public.
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/og.png' ||
    pathname.includes('opengraph-image') ||
    pathname.includes('twitter-image') ||
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
    // Developer never uses the portal — redirect to admin panel
    if (pathname.startsWith('/portal')) {
      return '/admin';
    }
    if (
      !DEVELOPER_ONLY.some((prefix) => pathname.startsWith(prefix)) &&
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
    if (module && (page === '/reports' || page.startsWith('/reports/'))) {
      return `/${module}/collection`;
    }
    if (module && AGENT_BLOCKED.some((prefix) => page === prefix || page.startsWith(`${prefix}/`))) {
      return `/${module}/agent-dashboard`;
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
      return module ? `/${module}/agent-dashboard` : '/portal';
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
    (await getToken({ req: request, secret, secureCookie: true, cookieName: 'next-auth.session-token' })) ??
    (await getToken({ req: request, secret, secureCookie: false, cookieName: 'next-auth.session-token' }))
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

  // If host is IPv4 or IPv6, it's not a tenant host
  if (
    /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname) ||
    /^[0-9a-fA-F:]+$/.test(hostname.replace(/[\[\]]/g, ''))
  ) {
    return null;
  }

  const normalizedRoot = normalizeHost(rootDomain);
  let slug: string | null = null;
  if (normalizedRoot) {
    if (hostname === normalizedRoot) return null;
    if (hostname.endsWith(`.${normalizedRoot}`)) {
      slug = hostname.slice(0, -(normalizedRoot.length + 1)).split('.')[0] || null;
    }
  } else {
    const labels = hostname.split('.');
    slug = labels.length > 2 ? labels[0] : null;
  }

  const reservedSlugs = ['www', 'api', 'admin', 'app', 'portal', 'support', 'static', 'assets'];
  if (slug && reservedSlugs.includes(slug.toLowerCase())) {
    return null;
  }

  return slug;
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

  // 0. CORS for the mobile API (/api/v1/*). Cross-origin browsers (e.g.
  //    `flutter run -d chrome`) need these headers + a preflight responder;
  //    native HTTP clients (Windows/Android Dio) bypass CORS entirely, which is
  //    why those builds work without this. Origin is reflected from a strict
  //    allowlist — never '*'.
  if (pathname.startsWith('/api/v1')) {
    const cors = corsHeadersFor(request.headers.get('origin'));
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: cors });
    }
    const apiResponse = nextWithTenantHeaders(request, tenantSlug);
    for (const [key, value] of Object.entries(cors)) {
      apiResponse.headers.set(key, value);
    }
    return apiResponse;
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
    const loginUrl = publicUrl(request, '/login');
    if (pathname !== '/') {
      loginUrl.searchParams.set(
        'callbackUrl',
        publicUrl(request, `${pathname}${request.nextUrl.search}`).toString(),
      );
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. Role-based Redirection
  let role = typeof token.role === 'string' ? token.role : 'agent';
  
  // If the user is a developer but has a monitor-token, let them act as a superadmin for routing
  if (role === 'developer' && request.cookies.has('monitor-token')) {
    role = 'superadmin';
  }

  const redirectTarget = getRoleRedirectTarget(
    pathname,
    role,
    request.nextUrl.searchParams.has('edit'),
  );
  if (redirectTarget) {
    return NextResponse.redirect(publicUrl(request, redirectTarget));
  }

  return nextWithTenantHeaders(request, tenantSlug);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|fonts).*)'],
};
