# Environment-Based URL Configuration & Multi-Domain Implementation Guide
## LoanTrack — Local Development + Hostinger Production

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Environment Variables — Complete Reference](#2-environment-variables--complete-reference)
3. [Local Development Setup](#3-local-development-setup)
4. [Backend: Config Module & CORS Update](#4-backend-config-module--cors-update)
5. [Frontend: API Client with Base URL Variable](#5-frontend-api-client-with-base-url-variable)
6. [Auth Bridge — JWT in NextAuth Session](#6-auth-bridge--jwt-in-nextauth-session)
7. [Protected Token Route](#7-protected-token-route)
8. [Client-Side Token Hook](#8-client-side-token-hook)
9. [File URL Resolution](#9-file-url-resolution)
10. [Tenant Slug Header — Always Send It](#10-tenant-slug-header--always-send-it)
11. [next.config.ts Updates](#11-nextconfigts-updates)
12. [Flutter — Dart-Define Configuration](#12-flutter--dart-define-configuration)
13. [Hostinger Production Deployment](#13-hostinger-production-deployment)
14. [Nginx Reverse Proxy Config](#14-nginx-reverse-proxy-config)
15. [SSL Certificates](#15-ssl-certificates)
16. [PM2 Process Management](#16-pm2-process-management)
17. [Environment Files Summary](#17-environment-files-summary)
18. [Deployment Checklist](#18-deployment-checklist)

---

## 1. Overview & Architecture

### Domains

| Environment | Backend (API) | Frontend (Web) |
|---|---|---|
| Local | `http://localhost:3001` | `http://localhost:3000` |
| Production | `https://api.loantrack.com` | `https://app.loantrack.com` |
| Tenant subdomains | — | `https://demo.loantrack.com` |

### How the Single Variable Propagates

```
.env file
   │
   ├── NEXT_PUBLIC_API_URL=https://api.loantrack.com
   │         │
   │         ├── lib/api-client/index.ts  → every apiFetch() call
   │         ├── lib/api-client/files.ts  → every file/image URL
   │         └── Flutter --dart-define    → every Dart http call
   │
   └── APP_ROOT_DOMAIN=loantrack.com
             │
             ├── lib/cors.ts     → subdomain allowlist
             ├── lib/auth.ts     → tenant slug resolution
             └── middleware.ts   → already using this ✅
```

Changing domain = editing **one line** in `.env`. Nothing in application code changes.

---

## 2. Environment Variables — Complete Reference

### Backend `.env` (API server)

```bash
# ─── Database ───────────────────────────────────────────────────────────────
DATABASE_URL="mysql://loantrack_user:StrongPass123@localhost:3306/loantrack"

# ─── Auth Secrets ───────────────────────────────────────────────────────────
# Must be >= 32 characters. Used by NextAuth AND v1 JWT verification.
AUTH_SECRET="replace-with-32-plus-char-random-string-here"

# Dedicated secret for mobile/API JWT tokens (best practice: separate from web)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MOBILE_JWT_SECRET="replace-with-64-hex-char-random-string"

# PII encryption key for Aadhaar numbers etc. (>= 64 hex chars OR >= 24 utf8 bytes)
PII_ENCRYPTION_KEY="replace-with-64-hex-char-string"

# ─── Domain Configuration ───────────────────────────────────────────────────
# The root domain — used for tenant subdomain resolution and CORS
APP_ROOT_DOMAIN="loantrack.com"
NEXT_PUBLIC_ROOT_DOMAIN="loantrack.com"

# The public URL of THIS server (backend)
APP_URL="https://api.loantrack.com"
NEXT_PUBLIC_APP_URL="https://api.loantrack.com"

# Frontend URL — added to CORS allowlist automatically
WEB_APP_URL="https://app.loantrack.com"

# Additional origins allowed for CORS (comma-separated, optional)
# Useful for staging domains or admin portals
CORS_EXTRA_ORIGINS="https://admin.loantrack.com,https://staging.loantrack.com"

# ─── NextAuth ───────────────────────────────────────────────────────────────
NEXTAUTH_URL="https://api.loantrack.com"
NEXTAUTH_SECRET="${AUTH_SECRET}"

# ─── OAuth (Google) ─────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ─── CRON Protection ────────────────────────────────────────────────────────
CRON_SECRET="replace-with-random-cron-secret"

# ─── Email (Nodemailer) ─────────────────────────────────────────────────────
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_USER="noreply@loantrack.com"
SMTP_PASS="your-smtp-password"
SMTP_FROM="LoanTrack <noreply@loantrack.com>"

# ─── Storage ────────────────────────────────────────────────────────────────
UPLOAD_DIR="/var/www/loantrack-api/private/uploads"

# ─── Rate Limiting ──────────────────────────────────────────────────────────
LOGIN_MAX_ATTEMPTS="10"
LOGIN_WINDOW_MS="900000"
LOGIN_IP_MAX="30"

# ─── Node Environment ───────────────────────────────────────────────────────
NODE_ENV="production"
PORT="3001"
```

### Frontend `.env.production` (Next.js web)

```bash
# ─── API Connection ─────────────────────────────────────────────────────────
# NEXT_PUBLIC_ prefix = available in both Server Components AND browser JS
NEXT_PUBLIC_API_URL="https://api.loantrack.com"

# ─── Domain Configuration ───────────────────────────────────────────────────
NEXT_PUBLIC_ROOT_DOMAIN="loantrack.com"
NEXT_PUBLIC_APP_URL="https://app.loantrack.com"
APP_ROOT_DOMAIN="loantrack.com"

# ─── NextAuth (Web Session) ─────────────────────────────────────────────────
# Must match the AUTH_SECRET in the backend
AUTH_SECRET="replace-with-32-plus-char-random-string-here"
NEXTAUTH_URL="https://app.loantrack.com"
NEXTAUTH_SECRET="${AUTH_SECRET}"

# ─── Mobile JWT Secret ──────────────────────────────────────────────────────
# Must match MOBILE_JWT_SECRET in the backend — used to issue tokens in auth callback
MOBILE_JWT_SECRET="replace-with-64-hex-char-random-string"

# ─── OAuth ──────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ─── Node Environment ───────────────────────────────────────────────────────
NODE_ENV="production"
PORT="3000"
```

### Local Development `.env.local` (used by BOTH apps during dev)

```bash
# ─── Database ───────────────────────────────────────────────────────────────
DATABASE_URL="mysql://root:root@localhost:3306/loantrack_dev"

# ─── Auth Secrets ───────────────────────────────────────────────────────────
AUTH_SECRET="dev-secret-at-least-32-characters-long"
MOBILE_JWT_SECRET="dev-mobile-secret-at-least-32-chars-long"
PII_ENCRYPTION_KEY="dev-pii-key-that-is-at-least-24-characters-long"

# ─── Domain Configuration ───────────────────────────────────────────────────
# Local: frontend runs on :3000, backend on :3001
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_ROOT_DOMAIN=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
APP_ROOT_DOMAIN=""
APP_URL="http://localhost:3001"
WEB_APP_URL="http://localhost:3000"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="${AUTH_SECRET}"

# OAuth (use a dev app registered on Google Console)
GOOGLE_CLIENT_ID="your-dev-google-client-id"
GOOGLE_CLIENT_SECRET="your-dev-google-client-secret"

# CRON
CRON_SECRET="dev-cron-secret"

# Node
NODE_ENV="development"
```

---

## 3. Local Development Setup

### Folder Structure

```
loantrack/                  ← monorepo root (or keep as one Next.js app)
├── package.json            ← root scripts
├── .env.local              ← shared local overrides
├── loantrack-api/          ← backend (Next.js API only, or Express)
│   ├── .env                ← backend defaults
│   └── package.json
└── loantrack-web/          ← frontend (Next.js)
    ├── .env.local          ← NEXT_PUBLIC_API_URL=http://localhost:3001
    └── package.json
```

> **If keeping as one Next.js app (Option A from the plan):** both apps are the same codebase. Use a single `.env.local`. Set `NEXT_PUBLIC_API_URL=""` (empty = same origin) locally and `NEXT_PUBLIC_API_URL="https://api.loantrack.com"` in production.

### Root `package.json` — Run Both Simultaneously

```json
{
  "scripts": {
    "dev": "concurrently -n API,WEB -c cyan,magenta \"npm run dev:api\" \"npm run dev:web\"",
    "dev:api": "cd loantrack-api && npm run dev",
    "dev:web": "cd loantrack-web && npm run dev",
    "build": "npm run build:api && npm run build:web",
    "build:api": "cd loantrack-api && npm run build",
    "build:web": "cd loantrack-web && npm run build"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

### Install and run locally

```bash
npm install -g concurrently   # one-time
npm run dev                    # starts both :3001 (API) and :3000 (Web)
```

---

## 4. Backend: Config Module & CORS Update

### `lib/config.ts` — Single source of truth for all URLs

```typescript
// lib/config.ts

/**
 * Central config module. All environment variables that affect URLs,
 * domains, or external services are read here — never scattered inline.
 * Changing a domain = changing one .env value, nothing else.
 */

export const config = {
  // ── Server identity ─────────────────────────────────────────────────────
  apiUrl:        process.env.APP_URL            ?? 'http://localhost:3001',
  webAppUrl:     process.env.WEB_APP_URL        ?? 'http://localhost:3000',
  rootDomain:    process.env.APP_ROOT_DOMAIN    ?? '',
  nodeEnv:       process.env.NODE_ENV           ?? 'development',
  port:          Number(process.env.PORT        ?? 3001),

  // ── Auth ────────────────────────────────────────────────────────────────
  authSecret:    process.env.AUTH_SECRET        ?? process.env.NEXTAUTH_SECRET ?? '',
  mobileJwtSecret: process.env.MOBILE_JWT_SECRET ?? '',
  piiKey:        process.env.PII_ENCRYPTION_KEY ?? '',

  // ── CORS ────────────────────────────────────────────────────────────────
  // Extra comma-separated origins beyond webAppUrl and root domain subdomains
  corsExtraOrigins: (process.env.CORS_EXTRA_ORIGINS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // ── Storage ─────────────────────────────────────────────────────────────
  uploadDir:     process.env.UPLOAD_DIR ?? 'private/uploads',

  // ── Helpers ─────────────────────────────────────────────────────────────
  get isProd()   { return this.nodeEnv === 'production'; },
  get isDev()    { return this.nodeEnv === 'development'; },

  /**
   * Builds an absolute URL for a stored file path.
   * Stored paths look like: /api/files/tenant123/loans/photo.jpg
   */
  fileUrl(storedPath: string): string {
    if (!storedPath) return '';
    if (storedPath.startsWith('http')) return storedPath; // already absolute
    return `${this.apiUrl}${storedPath}`;
  },
} as const;
```

### `lib/cors.ts` — Updated to read from config

Your existing `lib/cors.ts` is already well-structured. Add one import and extend `envAllowed()` to include `WEB_APP_URL`:

```typescript
// lib/cors.ts  — UPDATED SECTION ONLY
// (keep all existing code, replace envAllowed() function)

function envAllowed(): string[] {
  const list = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.WEB_APP_URL,                            // ← ADD THIS LINE
    process.env.APP_ROOT_DOMAIN
      ? `https://${process.env.APP_ROOT_DOMAIN}`
      : null,
    process.env.NEXT_PUBLIC_ROOT_DOMAIN
      ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
      : null,
    process.env.CORS_EXTRA_ORIGINS,                     // comma-separated
  ]
    .filter(Boolean)
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return list;
}

// Everything else in cors.ts stays exactly the same.
// isAllowedOrigin() and corsHeadersFor() need no changes —
// they already read from envAllowed() above.
```

This means adding `WEB_APP_URL=https://app.loantrack.com` to `.env` is all you need to allow the frontend domain. No code changes required when you change the domain.

### `lib/env.ts` — Add new required variables to validation

```typescript
// lib/env.ts  — ADD to the REQUIRED array
const REQUIRED = [
  'DATABASE_URL',
  'PII_ENCRYPTION_KEY',
  'MOBILE_JWT_SECRET',  // ← ADD: needed for API JWT issuance
] as const;

const RECOMMENDED = [
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_ROOT_DOMAIN',
  'WEB_APP_URL',          // ← ADD: needed for CORS
  'APP_URL',              // ← ADD: needed for absolute file URLs
] as const;

// Rest of the file stays the same.
```

---

## 5. Frontend: API Client with Base URL Variable

### `lib/api-client/index.ts` — Base fetch with URL from env

```typescript
// lib/api-client/index.ts

/**
 * All HTTP calls from the web frontend to the backend go through this file.
 * Changing NEXT_PUBLIC_API_URL in .env is the only thing needed to point
 * to a different backend domain.
 *
 * NEXT_PUBLIC_ prefix ensures this value is available in:
 *   - Server Components   (Node.js process)
 *   - Client Components   (browser bundle)
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
// Trailing slash guard — prevents double-slash in URLs like "http://api.com//api/v1/loans"

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends RequestInit {
  token?: string;
  tenantSlug?: string;
}

/**
 * Core fetch wrapper. Used by both Server Components (via serverFetch)
 * and Client Components (via useApiClient hook).
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, tenantSlug, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Always send tenant slug if available — backend resolves tenant from this
  // header when the subdomain approach cannot be used (cross-domain calls).
  if (tenantSlug) {
    headers['X-Tenant-Slug'] = tenantSlug;
  }

  const url = `${API_BASE}/api/v1${path}`;

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
    // Server Components: don't cache API responses by default
    // Caller can override with { cache: 'force-cache' } for static data
    cache: fetchOptions.cache ?? 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `API error ${res.status}`;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.error ?? parsed?.message ?? message;
    } catch { /* raw text error */ }
    throw new ApiError(res.status, body, message);
  }

  // Handle empty responses (204 No Content)
  if (res.status === 204) return undefined as T;

  const json = await res.json();
  // Your backend wraps responses in { data: ... } via v1-envelope
  return (json?.data ?? json) as T;
}
```

### `lib/api-client/server.ts` — Server Component helpers

```typescript
// lib/api-client/server.ts
// Only import this in Server Components, Route Handlers, or Server Actions.
// NEVER import in 'use client' files.

import { auth } from '@/lib/auth';
import { apiFetch, ApiFetchOptions } from './index';

/**
 * Extracts the v1 API JWT from the current NextAuth session.
 * The token is embedded in the session during the jwt() callback (see lib/auth.ts).
 */
export async function getApiToken(): Promise<string> {
  const session = await auth();
  const token = (session as any)?.apiToken as string | undefined;
  if (!token) throw new Error('No API token in session — user may not be authenticated');
  return token;
}

/**
 * Convenience: gets the token and calls apiFetch in one step.
 * Use this in every Server Component data fetch.
 *
 * @example
 * const loans = await serverFetch<Loan[]>('/loans?status=active');
 */
export async function serverFetch<T = unknown>(
  path: string,
  options: Omit<ApiFetchOptions, 'token'> = {},
): Promise<T> {
  const token = await getApiToken();
  const session = await auth();
  const tenantSlug = (session?.user as any)?.tenantSlug ?? undefined;
  return apiFetch<T>(path, { ...options, token, tenantSlug });
}
```

### `lib/api-client/files.ts` — Absolute file URL resolver

```typescript
// lib/api-client/files.ts

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/**
 * Converts a stored relative file path to a fully absolute URL.
 *
 * Stored in DB:  /api/files/tenant123/loans/photo.jpg
 * Returns:       https://api.loantrack.com/api/files/tenant123/loans/photo.jpg
 *
 * Works in both Server Components and Client Components because
 * NEXT_PUBLIC_API_URL is available in both environments.
 */
export function resolveFileUrl(storedPath: string | null | undefined): string {
  if (!storedPath) return '';
  if (storedPath.startsWith('http')) return storedPath; // already absolute
  return `${API_BASE}${storedPath}`;
}

/**
 * Use this for <img src> and Next.js <Image> src props.
 * Returns empty string (not undefined) so React doesn't complain.
 */
export function fileOrFallback(
  storedPath: string | null | undefined,
  fallback = '',
): string {
  return resolveFileUrl(storedPath) || fallback;
}
```

**Usage example:**

```tsx
// In any component — Server or Client
import { resolveFileUrl } from '@/lib/api-client/files';

<img src={resolveFileUrl(customer.photoUrl)} alt={customer.name} />
<Image src={resolveFileUrl(loan.documentUrl)} width={400} height={300} />
```

---

## 6. Auth Bridge — JWT in NextAuth Session

This embeds the v1 API JWT inside the NextAuth session so Server Components can use it directly.

### `lib/auth.ts` — Add `apiToken` to the JWT callback

Find the existing `jwt()` callback in your `lib/auth.ts` and add the highlighted lines:

```typescript
// lib/auth.ts  — MODIFY the jwt() callback only

async jwt({ token, user }: any) {
  if (user) {
    // ── Existing code (keep as-is) ───────────────────────
    token.userId = user.id;
    const authorizedUser = user as AuthorizedUser;
    token.role = authorizedUser.role;
    // ... your existing token fields ...

    // ── ADD: Issue a v1 API JWT and store it in the session ──
    try {
      const { issueMobileToken } = await import('@/lib/api/v1-auth');
      const apiJwt = await issueMobileToken({
        userId:   user.id,
        tenantId: (user as any).tenantId ?? '',
        branchId: (user as any).branchId ?? null,
        role:     (user as any).role     ?? 'agent',
        appType:  (user as any).appType  ?? 'loan',
      });
      token.apiToken    = apiJwt;
      // Store expiry so we can proactively refresh (1h token, refresh at 50min)
      token.apiTokenExp = Date.now() + 60 * 60 * 1000;
    } catch (e) {
      console.error('[AUTH_JWT] Failed to issue API token:', e);
    }
    // ─────────────────────────────────────────────────────
  }

  // ── ADD: Proactive refresh — re-issue before it expires ──────────────────
  // Check if the API token is within 10 minutes of expiry and refresh it.
  if (
    token.apiTokenExp &&
    Date.now() > (token.apiTokenExp as number) - 10 * 60 * 1000
  ) {
    try {
      const { issueMobileToken } = await import('@/lib/api/v1-auth');
      // The session callback fetches fresh user data from DB on each session check.
      // We re-use the claims already in the JWT token here for the refresh.
      const apiJwt = await issueMobileToken({
        userId:   token.userId   as string,
        tenantId: token.tenantId as string ?? '',
        branchId: token.branchId as string | null ?? null,
        role:     token.role     as string ?? 'agent',
        appType:  token.appType  as string ?? 'loan',
      });
      token.apiToken    = apiJwt;
      token.apiTokenExp = Date.now() + 60 * 60 * 1000;
    } catch (e) {
      console.error('[AUTH_JWT] Failed to refresh API token:', e);
      // Don't throw — keep the old token and let the API reject it naturally
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  return token;
},

// ── MODIFY the session() callback — expose apiToken ──────────────────────
async session({ session, token }: any) {
  if (session.user) {
    // ... your existing session fields (keep as-is) ...

    // ADD this one line:
    (session as any).apiToken = token.apiToken;
  }
  return session;
},
```

---

## 7. Protected Token Route

This is the bridge for Client Components — they call this lightweight route to get the JWT, then use it directly for API calls.

```typescript
// app/api/auth/v1-token/route.ts

import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Returns the v1 API JWT for use by Client Components.
 *
 * Security properties:
 *   - Protected by NextAuth session cookie (httpOnly, Secure)
 *   - Returns ONLY the API token — no other session data
 *   - Cache-Control: no-store — never cached by browser, CDN, or proxy
 *   - Only GET is allowed — mutation methods return 405
 */
export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const token = (session as any)?.apiToken as string | undefined;

  if (!token) {
    return NextResponse.json(
      { error: 'No API token available — please sign in again' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { token },
    {
      headers: {
        // Critical: prevent this response from being cached anywhere
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma':        'no-cache',
        'Expires':       '0',
      },
    }
  );
}

// Block all non-GET methods explicitly
export async function POST()   { return _methodNotAllowed(); }
export async function PUT()    { return _methodNotAllowed(); }
export async function DELETE() { return _methodNotAllowed(); }
export async function PATCH()  { return _methodNotAllowed(); }

function _methodNotAllowed() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
```

---

## 8. Client-Side Token Hook

```typescript
// lib/api-client/use-api-token.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface TokenState {
  token: string | null;
  loading: boolean;
  error: string | null;
}

// Module-level cache: survives re-renders and component unmounts within the session.
// Cleared when the user navigates away or refreshes.
let _cachedToken: string | null = null;
let _fetchPromise: Promise<string> | null = null; // Prevents duplicate simultaneous fetches

async function fetchToken(): Promise<string> {
  // If a fetch is already in-flight, wait for it instead of making a second request
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = fetch('/api/auth/v1-token', { credentials: 'include' })
    .then(async res => {
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new Error(`Token fetch failed: ${res.status}`);
      }
      const { token } = await res.json();
      _cachedToken = token;
      return token as string;
    })
    .finally(() => {
      _fetchPromise = null; // Clear the in-flight promise
    });

  return _fetchPromise;
}

/**
 * Hook for Client Components that need to call the backend API.
 *
 * @example
 * const { token, loading } = useApiToken();
 * if (loading) return <Spinner />;
 * const data = await fetch(`${API_URL}/api/v1/loans`, {
 *   headers: { Authorization: `Bearer ${token}` }
 * });
 */
export function useApiToken(): TokenState & { refetch: () => void } {
  const router = useRouter();
  const [state, setState] = useState<TokenState>({
    token:   _cachedToken,
    loading: !_cachedToken,
    error:   null,
  });

  const load = useCallback(async () => {
    if (_cachedToken) {
      setState({ token: _cachedToken, loading: false, error: null });
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const token = await fetchToken();
      setState({ token, loading: false, error: null });
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        // Session expired — redirect to login
        router.push('/login');
        return;
      }
      setState({ token: null, loading: false, error: err.message });
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refetch: load };
}

/** Clears the cached token — call this on logout */
export function clearTokenCache() {
  _cachedToken = null;
  _fetchPromise = null;
}
```

### `lib/api-client/use-api-client.ts` — Higher-level hook with auto-auth

```typescript
// lib/api-client/use-api-client.ts
'use client';

import { useApiToken } from './use-api-token';
import { apiFetch, ApiError, ApiFetchOptions } from './index';
import { useCallback } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Combines token retrieval + apiFetch into one hook.
 * Handles the Authorization header automatically.
 *
 * @example
 * const { call, loading } = useApiClient();
 * const loans = await call<Loan[]>('/loans');
 */
export function useApiClient() {
  const { token, loading: tokenLoading } = useApiToken();
  const { data: session } = useSession();
  const tenantSlug = (session?.user as any)?.tenantSlug ?? undefined;

  const call = useCallback(
    async <T = unknown>(path: string, options: Omit<ApiFetchOptions, 'token'> = {}): Promise<T> => {
      if (!token) throw new Error('Not authenticated');
      return apiFetch<T>(path, { ...options, token, tenantSlug });
    },
    [token, tenantSlug],
  );

  return { call, tokenLoading };
}
```

---

## 9. File URL Resolution

### Update `next.config.ts` to allow images from the API domain

```typescript
// next.config.ts  — UPDATE images section

const nextConfig: NextConfig = {
  // ... existing config ...

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200],

    // ADD: allow Next.js Image component to load from API domain
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.loantrack.com',
        pathname: '/api/files/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/api/files/**',
      },
    ],
  },
};
```

### Update `next.config.ts` Content Security Policy

Your existing CSP has `connect-src 'self'` which will block cross-domain API calls from the browser. Update it:

```typescript
// next.config.ts — UPDATE the Content-Security-Policy header

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const securityHeaders = [
  // ... other headers stay the same ...
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      `img-src 'self' data: blob: ${API_URL}`,          // ← ADD API_URL
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src 'self' ${API_URL}`,                   // ← ADD API_URL
      "frame-ancestors 'none'",
    ].join('; '),
  },
];
```

---

## 10. Tenant Slug Header — Always Send It

When the web frontend is on a separate domain, the backend cannot derive the tenant from the hostname. The `x-tenant-slug` header must be sent on every API request.

### How the tenant slug reaches every request

```
1. User logs in at demo.app.loantrack.com
2. NextAuth session stores tenantSlug = "demo"
3. serverFetch() reads tenantSlug from session and passes to apiFetch()
4. apiFetch() sets X-Tenant-Slug: demo header on every request
5. Backend v1-auth.ts reads x-tenant-slug (already supports this ✅)
```

The `serverFetch()` in `lib/api-client/server.ts` above already does this automatically. For Client Components, `useApiClient()` reads it from the NextAuth session automatically.

### Manual override (if needed for a specific fetch)

```typescript
// If you ever need to specify the tenant slug manually:
const data = await apiFetch('/loans', {
  token,
  tenantSlug: 'demo',   // explicit override
});
```

---

## 11. `next.config.ts` Updates

Complete updated file showing all changes together:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

const securityHeaders = [
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(self), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      `img-src 'self' data: blob: ${API_URL}`,
      "font-src 'self' https://fonts.gstatic.com",
      `connect-src 'self' ${API_URL}`,
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const noStoreHeaders = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
  { key: 'Pragma',        value: 'no-cache' },
  { key: 'Expires',       value: '0' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  compress: true,

  // ADD: allow cross-origin requests from local dev backend
  allowedDevOrigins: [
    'lvh.me', '*.lvh.me',
    'localhost:3000', 'localhost:3001',   // ← ADD :3001
  ],

  typescript: { ignoreBuildErrors: false },
  turbopack:  { root: process.cwd() },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200],

    // ADD: allow Next.js <Image> to load from the API server
    remotePatterns: [
      ...(API_URL.startsWith('https')
        ? [{
            protocol: 'https' as const,
            hostname: new URL(API_URL).hostname,
            pathname: '/api/files/**',
          }]
        : [{
            protocol: 'http' as const,
            hostname: 'localhost',
            port: '3001',
            pathname: '/api/files/**',
          }]
      ),
    ],
  },

  async headers() {
    return [
      { source: '/login',     headers: [...securityHeaders, ...noStoreHeaders] },
      { source: '/api/:path*', headers: [
          { key: 'Cache-Control', value: 'private, max-age=30, stale-while-revalidate=60' },
        ],
      },
      { source: '/(.*)',      headers: securityHeaders },
    ];
  },
};

export default nextConfig;
```

---

## 12. Flutter — Dart-Define Configuration

### `lib/config/env.dart`

```dart
// lib/config/env.dart

/// Environment configuration for LoanTrack mobile app.
/// All values are injected at build time via --dart-define.
/// Changing the API domain = changing the build command only.
class Env {
  /// Base URL of the backend API server.
  /// Never has a trailing slash.
  ///
  /// Local:      http://10.0.2.2:3001   (Android emulator → host machine)
  /// Local iOS:  http://localhost:3001
  /// Production: https://api.loantrack.com
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );

  /// Root domain — used for tenant subdomain construction
  static const rootDomain = String.fromEnvironment(
    'ROOT_DOMAIN',
    defaultValue: '',
  );
}
```

### `lib/services/api_client.dart`

```dart
// lib/services/api_client.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:loantrack/config/env.dart';

/// Central HTTP client. All API calls go through this class.
/// Domain changes only affect Env.apiBaseUrl — nothing here changes.
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  static const _base = Env.apiBaseUrl;

  // Token stored in memory during the session.
  // For persistence across app restarts, store in flutter_secure_storage.
  String? _accessToken;
  String? _refreshToken;
  String? _tenantSlug;

  void setCredentials({
    required String accessToken,
    required String? refreshToken,
    required String? tenantSlug,
  }) {
    _accessToken  = accessToken;
    _refreshToken = refreshToken;
    _tenantSlug   = tenantSlug;
  }

  void clearCredentials() {
    _accessToken  = null;
    _refreshToken = null;
    _tenantSlug   = null;
  }

  /// Build headers for every request — token + tenant slug
  Map<String, String> _headers({bool withBody = false}) {
    return {
      if (withBody) 'Content-Type': 'application/json',
      if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
      if (_tenantSlug  != null) 'X-Tenant-Slug': _tenantSlug!,
    };
  }

  Uri _uri(String path) => Uri.parse('$_base/api/v1$path');

  Future<Map<String, dynamic>> get(String path) async {
    final res = await http.get(_uri(path), headers: _headers());
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      _uri(path),
      headers: _headers(withBody: true),
      body: jsonEncode(body),
    );
    return _handleResponse(res);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    final res = await http.put(
      _uri(path),
      headers: _headers(withBody: true),
      body: jsonEncode(body),
    );
    return _handleResponse(res);
  }

  Future<void> delete(String path) async {
    final res = await http.delete(_uri(path), headers: _headers());
    _handleResponse(res);
  }

  Map<String, dynamic> _handleResponse(http.Response res) {
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    }
    if (res.statusCode == 401) {
      throw ApiException(401, 'Unauthorized — please log in again');
    }
    throw ApiException(res.statusCode, body['error']?.toString() ?? 'Request failed');
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  const ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}
```

### Build Commands

```bash
# ── Local Development ────────────────────────────────────────────────────────

# Android emulator (10.0.2.2 = host machine)
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:3001 \
  --dart-define=ROOT_DOMAIN=localhost

# iOS simulator (localhost works directly)
flutter run \
  --dart-define=API_BASE_URL=http://localhost:3001 \
  --dart-define=ROOT_DOMAIN=localhost

# Physical device on same WiFi (replace 192.168.1.x with your machine's IP)
flutter run \
  --dart-define=API_BASE_URL=http://192.168.1.100:3001 \
  --dart-define=ROOT_DOMAIN=localhost


# ── Production Builds ────────────────────────────────────────────────────────

# Android APK
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.loantrack.com \
  --dart-define=ROOT_DOMAIN=loantrack.com

# Android App Bundle (Play Store)
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.loantrack.com \
  --dart-define=ROOT_DOMAIN=loantrack.com

# iOS
flutter build ios --release \
  --dart-define=API_BASE_URL=https://api.loantrack.com \
  --dart-define=ROOT_DOMAIN=loantrack.com
```

---

## 13. Hostinger Production Deployment

### Hostinger VPS Setup (Ubuntu 22.04)

```bash
# ── 1. Connect to your VPS ───────────────────────────────────────────────────
ssh root@your-vps-ip

# ── 2. Install Node.js 20 ───────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

node --version   # Should show v20.x
npm --version

# ── 3. Install PM2 (process manager) ────────────────────────────────────────
npm install -g pm2

# ── 4. Install Nginx ────────────────────────────────────────────────────────
sudo apt update
sudo apt install -y nginx

# ── 5. Install MySQL 8 ──────────────────────────────────────────────────────
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Create database and user
sudo mysql -u root -p << 'SQL'
CREATE DATABASE loantrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'loantrack_user'@'localhost' IDENTIFIED BY 'StrongPass123';
GRANT ALL PRIVILEGES ON loantrack.* TO 'loantrack_user'@'localhost';
FLUSH PRIVILEGES;
SQL

# ── 6. Install Certbot for SSL ───────────────────────────────────────────────
sudo apt install -y certbot python3-certbot-nginx

# ── 7. Create app directories ────────────────────────────────────────────────
sudo mkdir -p /var/www/loantrack-api
sudo mkdir -p /var/www/loantrack-web
sudo mkdir -p /var/www/loantrack-api/private/uploads
sudo chown -R $USER:$USER /var/www/loantrack-api
sudo chown -R $USER:$USER /var/www/loantrack-web
```

### Deploy the API (Backend)

```bash
# On your LOCAL machine — build and upload
cd loantrack-api
npm run build

# Upload the standalone build
rsync -avz --progress \
  .next/standalone/ \
  .next/static \
  public \
  .env \
  root@your-vps-ip:/var/www/loantrack-api/

# Back on the VPS
ssh root@your-vps-ip
cd /var/www/loantrack-api

# Copy static files into standalone output (required for Next.js standalone)
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# Create the production .env
cat > /var/www/loantrack-api/.env << 'EOF'
DATABASE_URL="mysql://loantrack_user:StrongPass123@localhost:3306/loantrack"
AUTH_SECRET="your-32-plus-char-secret-here"
MOBILE_JWT_SECRET="your-64-hex-char-mobile-secret-here"
PII_ENCRYPTION_KEY="your-64-hex-char-pii-key-here"
APP_ROOT_DOMAIN="loantrack.com"
NEXT_PUBLIC_ROOT_DOMAIN="loantrack.com"
APP_URL="https://api.loantrack.com"
NEXT_PUBLIC_APP_URL="https://api.loantrack.com"
WEB_APP_URL="https://app.loantrack.com"
NEXTAUTH_URL="https://api.loantrack.com"
NEXTAUTH_SECRET="your-32-plus-char-secret-here"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
CRON_SECRET="your-cron-secret"
UPLOAD_DIR="/var/www/loantrack-api/private/uploads"
NODE_ENV="production"
PORT="3001"
EOF

# Run Prisma migrations
cd /var/www/loantrack-api
npx prisma migrate deploy

# Start with PM2
pm2 start .next/standalone/server.js \
  --name "loantrack-api" \
  --env production \
  -- --port 3001

pm2 save
pm2 startup   # Follow the printed command to enable auto-start on reboot
```

### Deploy the Frontend (Web)

```bash
# On your LOCAL machine
cd loantrack-web

# Build with production env
NEXT_PUBLIC_API_URL=https://api.loantrack.com \
NEXT_PUBLIC_ROOT_DOMAIN=loantrack.com \
npm run build

rsync -avz --progress \
  .next/standalone/ \
  .next/static \
  public \
  root@your-vps-ip:/var/www/loantrack-web/

# On the VPS
ssh root@your-vps-ip
cd /var/www/loantrack-web

cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

cat > /var/www/loantrack-web/.env << 'EOF'
NEXT_PUBLIC_API_URL="https://api.loantrack.com"
NEXT_PUBLIC_ROOT_DOMAIN="loantrack.com"
NEXT_PUBLIC_APP_URL="https://app.loantrack.com"
APP_ROOT_DOMAIN="loantrack.com"
AUTH_SECRET="your-32-plus-char-secret-here"
MOBILE_JWT_SECRET="your-64-hex-char-mobile-secret-here"
NEXTAUTH_URL="https://app.loantrack.com"
NEXTAUTH_SECRET="your-32-plus-char-secret-here"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NODE_ENV="production"
PORT="3000"
EOF

pm2 start .next/standalone/server.js \
  --name "loantrack-web" \
  --env production \
  -- --port 3000

pm2 save
```

---

## 14. Nginx Reverse Proxy Config

### `/etc/nginx/sites-available/loantrack-api`

```nginx
# Backend API — api.loantrack.com

server {
    listen 80;
    server_name api.loantrack.com;

    # Certbot will add SSL config here
    # Temporary: redirect to HTTPS after cert is issued
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.loantrack.com;

    # SSL — filled in by certbot (do not edit manually)
    ssl_certificate     /etc/letsencrypt/live/api.loantrack.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.loantrack.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options           "DENY"                        always;
    add_header X-Content-Type-Options    "nosniff"                     always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;

    # File upload size limit (match Next.js serverActions.bodySizeLimit)
    client_max_body_size 10M;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Pass the original origin through for CORS
        proxy_set_header   Origin            $http_origin;

        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # Serve uploaded files directly via Nginx (faster than Node.js)
    location /api/files/ {
        alias /var/www/loantrack-api/private/uploads/;
        # Strip the /api/files/ prefix and the tenant prefix
        # Actual file path: /private/uploads/{tenantId}/{subfolder}/{filename}

        # Security: only serve known image/doc types
        location ~* \.(jpg|jpeg|png|webp|pdf)$ {
            expires 7d;
            add_header Cache-Control "public, max-age=604800, immutable";
        }

        # Block everything else
        deny all;
    }
}
```

### `/etc/nginx/sites-available/loantrack-web`

```nginx
# Frontend Web App — app.loantrack.com (and tenant subdomains *.loantrack.com)

server {
    listen 80;
    server_name app.loantrack.com *.loantrack.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name app.loantrack.com *.loantrack.com;

    ssl_certificate     /etc/letsencrypt/live/app.loantrack.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.loantrack.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header X-Frame-Options        "DENY"                            always;
    add_header X-Content-Type-Options "nosniff"                         always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;

    client_max_body_size 10M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # Next.js static assets — served with long cache
    location /_next/static/ {
        proxy_pass       http://127.0.0.1:3000;
        expires          1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### Enable the sites

```bash
sudo ln -s /etc/nginx/sites-available/loantrack-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/loantrack-web /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

---

## 15. SSL Certificates

```bash
# Get certificates for both domains
# Note: *.loantrack.com wildcard requires DNS challenge (not HTTP challenge)

# Option A — individual subdomains (simpler, recommended for start)
sudo certbot --nginx -d api.loantrack.com
sudo certbot --nginx -d app.loantrack.com

# Option B — wildcard (covers all tenant subdomains like demo.loantrack.com)
# Requires DNS TXT record at your domain registrar
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d "*.loantrack.com" \
  -d "loantrack.com"

# After issuing, update nginx server_name and ssl_certificate paths accordingly.

# Auto-renewal (certbot sets this up automatically, verify it works)
sudo certbot renew --dry-run
```

---

## 16. PM2 Process Management

```bash
# View running processes
pm2 list

# View logs
pm2 logs loantrack-api
pm2 logs loantrack-web

# Restart after a code deploy
pm2 restart loantrack-api
pm2 restart loantrack-web

# Reload with zero downtime (for production)
pm2 reload loantrack-api
pm2 reload loantrack-web

# Monitor CPU/memory
pm2 monit
```

### `ecosystem.config.js` — PM2 config file (place at VPS root)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'loantrack-api',
      script: '/var/www/loantrack-api/.next/standalone/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,         // Increase to 'max' for multi-core if needed
      exec_mode: 'fork',    // Use 'cluster' for multi-core
      max_memory_restart: '512M',
      error_file: '/var/log/pm2/loantrack-api-error.log',
      out_file:   '/var/log/pm2/loantrack-api-out.log',
    },
    {
      name: 'loantrack-web',
      script: '/var/www/loantrack-web/.next/standalone/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: '/var/log/pm2/loantrack-web-error.log',
      out_file:   '/var/log/pm2/loantrack-web-out.log',
    },
  ],
};
```

```bash
# Start both processes from the config file
pm2 start ecosystem.config.js
pm2 save
```

---

## 17. Environment Files Summary

### What goes where

```
Project root
├── .env.local              ← LOCAL DEV only — never committed to git
│                              Contains both backend + frontend vars
│
loantrack-api/
├── .env                    ← Backend defaults (committed, no secrets)
├── .env.local              ← Local dev overrides (gitignored)
└── .env.production         ← Production values (gitignored, set on VPS)
│
loantrack-web/
├── .env                    ← Frontend defaults (committed, no secrets)
├── .env.local              ← Local dev overrides (gitignored)
└── .env.production         ← Production values (gitignored, set on VPS)
```

### `.gitignore` additions

```gitignore
# Environment files with secrets
.env.local
.env.production
.env*.local

# PM2
ecosystem.config.js   # Only if it contains secrets

# Uploaded files
private/uploads/
```

### Generating secure secrets

```bash
# AUTH_SECRET / NEXTAUTH_SECRET (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# MOBILE_JWT_SECRET (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PII_ENCRYPTION_KEY (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CRON_SECRET
node -e "console.log(require('crypto').randomBytes(20).toString('hex'))"
```

---

## 18. Deployment Checklist

### Before going live, verify each item:

**Environment Variables**
- [ ] `NEXT_PUBLIC_API_URL` set to `https://api.loantrack.com` in frontend `.env`
- [ ] `WEB_APP_URL` set to `https://app.loantrack.com` in backend `.env`
- [ ] `APP_ROOT_DOMAIN` and `NEXT_PUBLIC_ROOT_DOMAIN` both set to `loantrack.com`
- [ ] `AUTH_SECRET` and `MOBILE_JWT_SECRET` match between frontend and backend
- [ ] `NEXTAUTH_URL` matches the actual frontend domain

**CORS**
- [ ] Test from browser: `fetch('https://api.loantrack.com/api/v1/health')` returns 200
- [ ] OPTIONS preflight returns `Access-Control-Allow-Origin: https://app.loantrack.com`
- [ ] No wildcard `*` in CORS headers for credentialed requests

**SSL**
- [ ] `https://api.loantrack.com` loads without certificate warning
- [ ] `https://app.loantrack.com` loads without certificate warning
- [ ] HTTP redirects to HTTPS on both domains

**Auth**
- [ ] Login flow completes and sets session cookie
- [ ] `GET /api/auth/v1-token` returns `{ token: "eyJ..." }` for logged-in user
- [ ] `GET /api/auth/v1-token` returns 401 for unauthenticated requests

**Tenant Routing**
- [ ] `demo.loantrack.com` resolves to the correct tenant
- [ ] `X-Tenant-Slug` header is present on all `/api/v1/` requests
- [ ] Backend logs show correct `tenantId` being resolved

**File Uploads**
- [ ] Upload an image through the app — it saves to `/var/www/loantrack-api/private/uploads/`
- [ ] The stored URL `resolveFileUrl('/api/files/...')` resolves to a working image
- [ ] `<Image>` component loads images from the API domain

**Flutter**
- [ ] Production APK built with `--dart-define=API_BASE_URL=https://api.loantrack.com`
- [ ] Login works on the physical device
- [ ] Collection entry sync works end-to-end

**Process Management**
- [ ] `pm2 list` shows both processes as `online`
- [ ] Both apps survive a VPS reboot (`pm2 startup` was run)
- [ ] `pm2 logs` show no startup errors
