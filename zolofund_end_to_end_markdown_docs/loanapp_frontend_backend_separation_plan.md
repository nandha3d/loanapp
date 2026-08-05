# ZoloFund — Frontend/Backend Separation Plan
## Migrating from Next.js Monolith to Decoupled Architecture via REST API

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Target Architecture](#2-target-architecture)
3. [What Changes & What Stays](#3-what-changes--what-stays)
4. [Phase-by-Phase Migration Plan](#4-phase-by-phase-migration-plan)
5. [Backend: Standalone API Server Setup](#5-backend-standalone-api-server-setup)
6. [Frontend: Next.js API Client Layer](#6-frontend-nextjs-api-client-layer)
7. [Authentication — Session to JWT Migration](#7-authentication--session-to-jwt-migration)
8. [Converting Server Actions to API Calls](#8-converting-server-actions-to-api-calls)
9. [CORS & Middleware Configuration](#9-cors--middleware-configuration)
10. [Flutter Mobile App Integration](#10-flutter-mobile-app-integration)
11. [File Upload Migration](#11-file-upload-migration)
12. [Environment & Deployment Configuration](#12-environment--deployment-configuration)
13. [Testing Strategy](#13-testing-strategy)
14. [Risk Register & Mitigations](#14-risk-register--mitigations)

---

## 1. Current Architecture Analysis

### Tech Stack Identified

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Database ORM | Prisma + MySQL |
| Auth (Web) | NextAuth.js (session cookies) |
| Auth (Mobile) | JWT tokens via `/api/v1/*` |
| Mobile App | Flutter (Dart) |
| Styling | Tailwind CSS |
| File storage | Local disk (`private/uploads/`) |

### How the App is Currently Structured

The application already has **two API layers** running side by side inside the same Next.js process:

```
zolofund/
├── app/
│   ├── (dashboard)/[module]/
│   │   ├── loans/
│   │   │   ├── page.tsx           ← Server Component (renders HTML)
│   │   │   └── actions.ts         ← 'use server' — Server Actions (direct DB via Prisma)
│   │   ├── collection/actions.ts  ← 'use server' — Server Actions
│   │   └── customers/actions.ts   ← 'use server' — Server Actions
│   │
│   ├── api/
│   │   ├── v1/                    ← ✅ Already clean REST API (used by Flutter)
│   │   │   ├── auth/login/        ← JWT-based auth
│   │   │   ├── loans/             ← Full CRUD for mobile
│   │   │   ├── customers/
│   │   │   ├── collection/
│   │   │   └── ...70+ routes
│   │   │
│   │   └── (internal)/            ← Web-only routes (NextAuth, file serving, etc.)
│   │       ├── auth/[...nextauth]/
│   │       ├── files/[...path]/
│   │       └── ...
│   │
├── middleware.ts                  ← Auth guard + CORS already set up
├── lib/
│   ├── db.ts                      ← Prisma client (shared by actions + API)
│   ├── api/v1-auth.ts             ← JWT helpers for /api/v1/
│   └── auth.ts                    ← NextAuth session helpers
└── mobile/                        ← Flutter app (already consuming /api/v1/)
```

### The Core Problem

The **web dashboard** (Next.js Server Actions in `actions.ts` files) talks **directly to the database** through Prisma, bypassing the `/api/v1/` layer entirely:

```
Web Dashboard (Browser)
    │
    ├── Server Action (actions.ts)
    │       │
    │       └── prisma.loan.findMany(...)   ← Direct DB call — tightly coupled
    │
Flutter Mobile App
    │
    └── fetch('/api/v1/loans')              ← Clean API boundary — decoupled ✅
```

The goal is to make the web dashboard behave the same way Flutter does — consuming the REST API — so both clients share one clean backend.

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│                                                                 │
│   ┌──────────────────────┐      ┌──────────────────────┐       │
│   │  Next.js Frontend     │      │  Flutter Mobile App   │       │
│   │  (Vercel / CDN)       │      │  (Android / iOS)      │       │
│   │                       │      │                       │       │
│   │  - Server Components  │      │  - Dart http client   │       │
│   │  - Client Components  │      │  - JWT in storage     │       │
│   │  - API Client lib     │      │                       │       │
│   └──────────┬────────────┘      └──────────┬────────────┘       │
│              │  HTTPS + JWT                  │  HTTPS + JWT       │
└──────────────┼───────────────────────────────┼───────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND  (Node.js / Next.js)                  │
│                                                                  │
│   POST /api/v1/auth/login     → issues JWT                      │
│   GET  /api/v1/loans          → list loans (scoped to tenant)    │
│   POST /api/v1/loans          → create loan                      │
│   GET  /api/v1/customers      → list customers                   │
│   POST /api/v1/collection/entry → record collection              │
│   GET  /api/v1/dashboard      → KPI stats                        │
│   ...  70+ versioned routes                                      │
│                                                                  │
│   Shared lib:  prisma / auth / loanPolicy / loanCalculator       │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   MySQL DB  │
                    │  (Prisma)   │
                    └─────────────┘
```

**Key principle:** The backend exposes one versioned REST API (`/api/v1/`). Both the web frontend and the mobile app consume it identically. No client touches the database directly.

---

## 3. What Changes & What Stays

### What Stays the Same

- All `/api/v1/*` routes — these are already correct and need no changes
- Flutter mobile app — it already uses `/api/v1/` correctly
- Database schema (Prisma)
- Business logic in `lib/` (loanPolicy, loanCalculator, wallet, etc.)
- Middleware auth guard logic in `middleware.ts`
- Multi-tenant slug resolution
- JWT issuance (`issueMobileToken`, `issueRefreshToken`)

### What Changes

| Current | After Migration |
|---|---|
| `actions.ts` files with `'use server'` calling Prisma directly | Replaced by API client calls to `/api/v1/*` |
| NextAuth session cookies for web auth | Web also uses JWT (or keeps NextAuth as a thin wrapper that gets a v1 token) |
| Server Components fetching data via Prisma | Server Components fetch from `/api/v1/` using internal HTTP or shared service functions |
| File uploads saved directly to local disk in actions | File uploads go through `/api/v1/upload` |

---

## 4. Phase-by-Phase Migration Plan

```
Phase 1 — Audit & Gap Analysis        (Week 1)
Phase 2 — Backend Completion          (Week 2–3)
Phase 3 — API Client Library          (Week 3)
Phase 4 — Auth Bridge                 (Week 4)
Phase 5 — Convert Actions Module-by-Module  (Week 5–8)
Phase 6 — Remove Server Actions       (Week 9)
Phase 7 — Testing & Hardening         (Week 10)
Phase 8 — Deploy & Monitor            (Week 11)
```

---

## 5. Backend: Standalone API Server Setup

### Option A — Keep Next.js as the API Server (Recommended)

Since `/api/v1/` routes already exist in Next.js and are production-ready, **keep them where they are**. The backend is already "standalone" in logic — you just need the web frontend to call it via HTTP instead of bypassing it.

This avoids a full infrastructure split and is the lowest-risk path.

**Folder structure after migration:**

```
zolofund/
├── app/
│   ├── api/v1/                  ← Backend (no changes needed)
│   └── (dashboard)/             ← Frontend (actions.ts removed, uses api-client instead)
├── lib/
│   ├── api-client/              ← NEW: HTTP client for frontend → /api/v1/
│   │   ├── index.ts
│   │   ├── loans.ts
│   │   ├── customers.ts
│   │   ├── collection.ts
│   │   └── ...
│   └── (all existing lib files stay)
```

### Option B — Extract Backend to Separate Service

If you want full physical separation (e.g., deploy backend on Railway, frontend on Vercel):

```bash
# New repo structure
loantrack-api/         ← Express or Fastify app
  src/
    routes/
      loans.ts
      customers.ts
      auth.ts
    lib/               ← Copy shared lib/ from Next.js
    prisma/            ← Shared schema
  package.json

loantrack-web/         ← Next.js app (frontend only)
  app/
    (dashboard)/
  lib/
    api-client/        ← Points to loantrack-api base URL
```

> **Recommendation:** Start with Option A. The `/api/v1/` routes are already well-structured with cursor pagination, tenant scoping, and JWT auth. Moving to Option B is a mechanical step you can do later once the frontend-backend boundary is clean in code.

---

## 6. Frontend: Next.js API Client Layer

Create a typed API client that all dashboard pages and components use instead of calling Prisma directly.

### `lib/api-client/index.ts` — Base Client

```typescript
// lib/api-client/index.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * For Server Components / Server Actions — uses the internal JWT
 * obtained from the current session.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}/api/v1${path}`;
  const res = await fetch(url, { ...fetchOptions, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }

  const body = await res.json();
  return body.data as T;
}
```

### `lib/api-client/loans.ts` — Domain Module

```typescript
// lib/api-client/loans.ts
import { apiFetch } from './index';

export interface Loan {
  id: string;
  principal: number;
  status: string;
  customer: { id: string; name: string; phone: string };
  // ... other fields
}

export interface LoanCreatePayload {
  customerId: string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  // ... other fields
}

export async function getLoans(
  token: string,
  params?: { customerId?: string; status?: string; cursor?: string }
): Promise<{ data: Loan[]; nextCursor: string | null }> {
  const qs = new URLSearchParams(params as any).toString();
  return apiFetch(`/loans${qs ? `?${qs}` : ''}`, { token });
}

export async function createLoan(token: string, payload: LoanCreatePayload): Promise<Loan> {
  return apiFetch('/loans', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
}

export async function getLoanById(token: string, id: string): Promise<Loan> {
  return apiFetch(`/loans/${id}`, { token });
}

export async function closeLoan(token: string, id: string, reason: string): Promise<void> {
  return apiFetch(`/loans/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });
}
```

### Getting the Token in Server Components

In Server Components, get the JWT token from the session (after the auth bridge is set up in Phase 4):

```typescript
// app/(dashboard)/[module]/loans/page.tsx
import { getApiToken } from '@/lib/api-client/token';
import { getLoans } from '@/lib/api-client/loans';

export default async function LoansPage() {
  const token = await getApiToken(); // Gets JWT from session
  const { data: loans } = await getLoans(token, { status: 'active' });

  return <LoansClient initialLoans={loans} />;
}
```

---

## 7. Authentication — Session to JWT Migration

This is the most important bridge. The web dashboard currently uses NextAuth session cookies. The `/api/v1/` layer uses JWT Bearer tokens.

### Strategy: Store the v1 JWT Inside the NextAuth Session

When a user logs in via NextAuth, also call `/api/v1/auth/login` (or reuse the same logic) to get a JWT and store it in the session object.

**Step 1 — Update NextAuth callbacks to embed the API token:**

```typescript
// lib/auth.ts  (NextAuth config)
import NextAuth from 'next-auth';
import { issueMobileToken } from '@/lib/api/v1-auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ... existing providers

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Issue a v1 API token when the user first signs in
        const apiToken = await issueMobileToken({
          userId: user.id as string,
          tenantId: (user as any).tenantId,
          branchId: (user as any).branchId,
          role: (user as any).role,
          appType: (user as any).appType,
        });
        token.apiToken = apiToken;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).apiToken = token.apiToken;
      return session;
    },
  },
});
```

**Step 2 — Helper to extract the API token from the session:**

```typescript
// lib/api-client/token.ts
import { auth } from '@/lib/auth';

export async function getApiToken(): Promise<string> {
  const session = await auth();
  const token = (session as any)?.apiToken;
  if (!token) throw new Error('Not authenticated');
  return token;
}
```

**Step 3 — For Client Components, pass the token from the Server Component:**

```typescript
// Server Component passes token to Client Component via props
// OR: expose a lightweight /api/token route that returns the JWT for client-side use

// app/api/auth/token/route.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  const token = (session as any)?.apiToken;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ token });
}
```

---

## 8. Converting Server Actions to API Calls

This is the bulk of the migration work. Each `actions.ts` file becomes an API client call.

### Before (Server Action — direct Prisma):

```typescript
// app/(dashboard)/[module]/loans/actions.ts (BEFORE)
'use server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';

export async function createLoan(formData: FormData) {
  const session = await auth();
  // ... 80 lines of validation + prisma calls directly
  const loan = await prisma.loan.create({ data: { ... } });
  revalidatePath('/loans');
}
```

### After (Client calls `/api/v1/` — same validation, same business logic, but in one place):

```typescript
// app/(dashboard)/[module]/loans/LoanForm.tsx (AFTER)
'use client';

async function handleSubmit(formData: FormData) {
  const res = await fetch('/api/v1/loans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,  // token passed as prop from Server Component
    },
    body: JSON.stringify(Object.fromEntries(formData)),
  });

  if (!res.ok) {
    const err = await res.json();
    setError(err.error);
    return;
  }
  router.push('/loans');
}
```

### Migration Mapping — All `actions.ts` Files

| Module | actions.ts | Target v1 Route | HTTP Method |
|---|---|---|---|
| loans | createLoan | POST /api/v1/loans | POST |
| loans | getLoanById | GET /api/v1/loans/:id | GET |
| loans | updateLoan | PUT /api/v1/loans/:id | PUT |
| loans | closeLoan | POST /api/v1/loans/:id/close | POST |
| customers | createCustomer | POST /api/v1/customers | POST |
| customers | getCustomers | GET /api/v1/customers | GET |
| collection | recordEntry | POST /api/v1/collection/entry | POST |
| collection | openRun | POST /api/v1/collection/run/open | POST |
| collection | closeRun | POST /api/v1/collection/run/:id/close | POST |
| approvals | getApprovals | GET /api/v1/approvals | GET |
| approvals | reviewApproval | POST /api/v1/approvals/:id/approve | POST |
| accounting | getJournal | GET /api/v1/accounting | GET |
| settings | updateSettings | PUT /api/v1/settings | PUT |
| analytics | getSummary | GET /api/v1/analytics/summary | GET |
| chits | createChit | POST /api/v1/chits | POST |
| penalties | settlePenalty | POST /api/v1/penalties/:id/settle | POST |
| wallet | deposit | POST /api/v1/wallet/deposit | POST |

> Most of these `/api/v1/` routes **already exist** in the codebase. You're not writing new backend code — you're redirecting the web frontend to call the routes that Flutter is already using.

### Gaps to Fill in the API

Some web dashboard Server Actions perform operations that don't have a corresponding `/api/v1/` route yet. These need to be created:

```
app/api/v1/accounting/budget/          ← needs create/update
app/api/v1/accounting/period-lock/     ← needs lock/unlock
app/api/v1/accounting/tax/             ← needs full CRUD
app/api/v1/accounting/vendors/         ← needs full CRUD
app/api/v1/settings/payment-gateway/  ← exists ✅
app/api/v1/kyc/review/                 ← exists ✅
app/api/v1/reports/                    ← needs pdf generation endpoint
```

---

## 9. CORS & Middleware Configuration

Your `middleware.ts` already handles CORS for `/api/v1/` paths. Here's what to verify and extend:

### Current CORS Setup (from middleware.ts)

The middleware already has a `corsHeadersFor()` helper. Make sure these headers are returned for all `/api/v1/*` requests:

```typescript
// lib/cors.ts (ensure this covers your frontend origin)
export function corsHeadersFor(origin: string | null): HeadersInit {
  const allowed = [
    process.env.NEXT_PUBLIC_APP_URL,      // web frontend
    'https://your-web-app.vercel.app',
  ].filter(Boolean);

  return {
    'Access-Control-Allow-Origin': allowed.includes(origin ?? '') ? (origin ?? '*') : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-slug',
    'Access-Control-Max-Age': '86400',
  };
}
```

### Middleware Update for OPTIONS Preflight

```typescript
// middleware.ts — add preflight handler
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Handle CORS preflight for all v1 API routes
  if (req.method === 'OPTIONS' && pathname.startsWith('/api/v1/')) {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeadersFor(req.headers.get('origin')),
    });
  }

  // ... rest of existing middleware logic
}
```

### If Backend Runs on a Separate Domain (Option B)

If the backend is deployed separately (e.g., `api.loantrack.com`), update the allowed origins in the backend's CORS config to include the web frontend's domain.

---

## 10. Flutter Mobile App Integration

**No changes required** to the Flutter app. It already consumes `/api/v1/` with JWT tokens. This migration only affects how the web frontend talks to the backend. The mobile app continues working as before.

However, once the web dashboard is also calling `/api/v1/`, you get a major benefit: **any new feature added to the API automatically works for both web and mobile.**

### How Flutter Currently Authenticates (for reference)

```dart
// mobile/ — Flutter already does this correctly
final response = await http.post(
  Uri.parse('$baseUrl/api/v1/auth/login'),
  headers: {'Content-Type': 'application/json', 'x-tenant-slug': tenantSlug},
  body: jsonEncode({'username': username, 'password': password}),
);
final data = jsonDecode(response.body);
final token = data['data']['token'];
// Store token, use as Bearer in all subsequent requests
```

The web dashboard will follow the exact same pattern after migration.

---

## 11. File Upload Migration

Currently, `actions.ts` files save files directly to disk via `fs.writeFileSync`. After migration, all uploads go through the API.

### Current (Server Action — direct disk write):

```typescript
// In actions.ts — BEFORE
const filePath = path.join(UPLOAD_DIR, tenantId, 'loans', safeName);
fs.writeFileSync(filePath, buffer);
```

### After — Frontend sends to `/api/v1/upload`:

```typescript
// Client Component — AFTER
async function uploadFile(file: File, token: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('subfolder', 'loans');

  const res = await fetch('/api/v1/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  const data = await res.json();
  return data.data.url; // Returns the file path
}
```

The `/api/v1/upload` route already exists at `app/api/v1/upload/route.ts` — it handles auth, file type validation, and disk storage. No new backend code needed.

---

## 12. Environment & Deployment Configuration

### Environment Variables

```bash
# .env.local (Frontend)
NEXT_PUBLIC_API_URL=https://api.loantrack.com   # Empty string if same-origin (Option A)
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://app.loantrack.com

# .env (Backend — if Option B)
DATABASE_URL=mysql://user:pass@db-host:3306/loantrack
JWT_SECRET=your-jwt-secret
MOBILE_TOKEN_SECRET=your-mobile-secret
```

### Same-Origin Deployment (Option A — Recommended First Step)

Frontend and backend remain in the same Next.js app. The API base URL is empty (same origin):

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''; // '' = same origin
// Results in: fetch('/api/v1/loans') — same server, no CORS needed
```

### Separate Deployment (Option B)

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.loantrack.com';
// Results in: fetch('https://api.loantrack.com/api/v1/loans')
```

---

## 13. Testing Strategy

### Step 1 — Verify Existing API Routes Work

Before converting any frontend code, run the existing API routes against the database:

```bash
# Smoke test all v1 routes
curl -X POST /api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'x-tenant-slug: demo' \
  -d '{"username":"admin","password":"test123"}'

# Use the returned token to test a protected route
curl /api/v1/loans \
  -H 'Authorization: Bearer <token>'
```

### Step 2 — Add Integration Tests for New API Routes

For any gaps you fill in Step 5, write route-level tests:

```typescript
// tests/api/loans.test.ts
describe('POST /api/v1/loans', () => {
  it('creates a loan and returns it with correct fields', async () => {
    const token = await loginAsAdmin();
    const res = await fetch('/api/v1/loans', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: 'cust_1', principal: 10000, ... }),
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.id).toBeDefined();
  });
});
```

### Step 3 — Module-by-Module Regression Testing

For each module converted (loans, customers, collection, etc.):

1. Run the existing test suites: `npm run test:repayments`, `npm run test:security`
2. Manually test the full happy path (create → list → detail → action)
3. Test error cases (invalid data, unauthorized access, wrong tenant)
4. Compare behaviour before and after conversion using browser devtools network tab

### Step 4 — End-to-End Tests

Use the existing `tests/endToEndFeatures.test.ts` as a baseline and extend it to cover the new API-based flows.

---

## 14. Risk Register & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Server Actions have business logic not in `/api/v1/` routes | High | High | Audit each `actions.ts` file before converting; backfill missing logic into the v1 route |
| JWT token expiry causes silent failures on web | Medium | High | Implement token refresh using `/api/v1/auth/refresh`; add 401 interceptor in API client |
| CORS errors when testing across origins | Medium | Medium | Set up CORS correctly before migrating any frontend code; test with browser devtools |
| File uploads break if disk path changes | Low | Medium | Ensure `/api/v1/upload` is tested before removing `fs.writeFileSync` from actions |
| Multi-tenant slug resolution differences | Low | High | The v1 routes already use `extractTenantSlugFromHost` — verify it works for all tenant URLs |
| Accounting module has many actions with no v1 equivalents | High | Medium | Budget 2 extra weeks for accounting module (vendor, journal, budget, period-lock routes) |
| Performance regression from HTTP round-trip in Server Components | Low | Low | In Option A (same-origin), use `fetch` with `{ cache: 'no-store' }` — same-process calls are fast; or expose shared service functions that both API routes and Server Components can call directly |

---

## Summary: Migration Order

1. **Set up the API client library** (`lib/api-client/`) — no production risk
2. **Add the auth bridge** (store JWT in NextAuth session) — test thoroughly
3. **Convert the simplest module first** — e.g., `notifications/actions.ts` (small, low risk)
4. **Convert loans module** — most used, most important to get right
5. **Convert customers, collection** — high-traffic modules
6. **Convert accounting** — fill any missing v1 routes
7. **Convert all remaining modules**
8. **Delete all `actions.ts` files** and the `'use server'` imports
9. **Remove Prisma client from Server Components** — only the API routes should use it now
10. **Deploy backend separately** (optional, once boundary is clean)

The key insight: **your `/api/v1/` backend is already 80% complete.** The Flutter app proves it. This migration is primarily a frontend task — redirecting the web dashboard to call the same routes that mobile already uses.
