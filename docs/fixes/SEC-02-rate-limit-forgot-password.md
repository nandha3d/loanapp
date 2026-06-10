# SEC-02 — Rate-Limit `POST /api/v1/auth/forgot-password`

**Priority:** 🔴 HIGH  
**Category:** Security — Brute-force / Email flooding  
**Effort:** 30 min

---

## Problem

`app/api/v1/auth/forgot-password/route.ts` has no rate limiting. An attacker can:

1. Enumerate valid email addresses by timing (though the route always returns `{ sent: true }`, the OTP generation + DB query still takes slightly different time).
2. Flood any email address with OTP emails by sending thousands of requests — effectively a DoS on the mailbox and a spam reputation risk.
3. Brute-force the 6-digit HMAC-OTP (1,000,000 combinations) against `POST /api/v1/auth/reset-password` if that route also lacks limiting.

The route uses a **10-minute time bucket** OTP (same OTP valid for the entire 10-min window). Rate limiting at the forgot-password stage is the first line of defense.

---

## Current File

`app/api/v1/auth/forgot-password/route.ts`

The route:
- Takes `{ email }` body
- Always returns `{ sent: true }` (prevents enumeration — keep this)
- Sends OTP email only if user exists

---

## Fix Design

Use an **in-process sliding-window counter** keyed by IP + email. For a production app on a single VPS (Hostinger), an in-process `Map` with TTL is sufficient. Do **not** add Redis as a dependency just for this.

Limits to enforce:
- **5 requests per email per 10 minutes** — prevents flooding a specific inbox
- **20 requests per IP per 10 minutes** — prevents enumeration from same source

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Create `lib/rateLimit.ts`

Create a new file `lib/rateLimit.ts` with an in-process sliding-window rate limiter:

```typescript
// Sliding-window in-process rate limiter. Suitable for single-process deployments.
// Keys auto-expire after windowMs to prevent unbounded memory growth.

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Sweep old entries every 5 minutes to avoid memory leaks.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

/**
 * Returns true if the request should be ALLOWED.
 * Returns false if the limit is exceeded.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
```

### Step 2 — Apply to `forgot-password/route.ts`

Open `app/api/v1/auth/forgot-password/route.ts`.

At the top, add the import:
```typescript
import { checkRateLimit } from '@/lib/rateLimit';
```

Inside the `POST` handler, **before the DB query**, add:

```typescript
// Rate limiting — 5 req/email/10min and 20 req/IP/10min
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
const window = 10 * 60 * 1000; // 10 minutes
const emailKey = `fpw:email:${email}`;
const ipKey    = `fpw:ip:${ip}`;
if (!checkRateLimit(emailKey, 5, window) || !checkRateLimit(ipKey, 20, window)) {
  // Return success-shaped response to prevent timing oracle — do NOT say "rate limited"
  return ok({ sent: true });
}
```

> **Important:** Return `ok({ sent: true })` (not a 429) to preserve the existing anti-enumeration behavior. The attacker gets no signal that rate limiting fired.

### Step 3 — Verify `reset-password` route is also guarded

Check `app/api/v1/auth/reset-password/route.ts`. If it takes the OTP + new password and has no rate limiting, apply a stricter limit there (3 attempts per email per 10 minutes) so brute-force of the OTP is also blocked:

```typescript
if (!checkRateLimit(`rpw:email:${email}`, 3, 10 * 60 * 1000)) {
  return fail('Too many attempts. Try again later.', 429);
}
```

Here a 429 is acceptable because the reset step reveals nothing about email existence.

---

## Verification

1. Send 6 `POST /api/v1/auth/forgot-password` requests with the same email within 10 min — 6th must return `{ sent: true }` without sending an email.
2. `npx tsc --noEmit` → 0 errors.
3. Confirm no new dependency added to `package.json`.
