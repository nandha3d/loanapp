/**
 * CORS layer for /api/v1/* (mobile clients).
 *
 * CORS-01: ensures Flutter/Dio clients get the headers they need.
 * CORS-02: handles preflight OPTIONS at the middleware layer so each
 *          route file doesn't need its own handler.
 * CORS-03: strict origin allowlist — never reflects '*'. Anything not in
 *          the allowlist gets no ACAO header (browser blocks).
 */

const STATIC_ALLOWED = new Set<string>([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  // Flutter WebView / native shells (used by Capacitor/Ionic, harmless here).
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost', // Android emulator WebView
]);

const ALLOW_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Tenant-Slug',
  'X-Tenant-Id',
  'X-App-Version',
  'X-Requested-With',
  'X-Idempotency-Key',
].join(', ');

const ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

function envAllowed(): string[] {
  const list = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_ROOT_DOMAIN ? `https://${process.env.APP_ROOT_DOMAIN}` : null,
    process.env.NEXT_PUBLIC_ROOT_DOMAIN ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}` : null,
    process.env.CORS_EXTRA_ORIGINS, // comma-separated overrides
  ]
    .filter(Boolean)
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return list;
}

/** True if origin matches allowlist or is a subdomain of a configured root domain. */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED.has(origin)) return true;
  for (const o of envAllowed()) {
    if (o === origin) return true;
  }
  const root = (process.env.APP_ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || '')
    .toLowerCase()
    .split(':')[0];
  if (root) {
    try {
      const u = new URL(origin);
      const host = u.hostname.toLowerCase();
      if (host === root || host.endsWith(`.${root}`)) return true;
    } catch {
      /* not a URL — ignore */
    }
  }
  return false;
}

/** Build CORS response headers for a given request origin. */
export function corsHeadersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Max-Age': '86400',
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}
