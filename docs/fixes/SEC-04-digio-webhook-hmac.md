# SEC-04 — Fix Digio Webhook HMAC (`timingSafeEqual` Length Crash)

**Priority:** 🟠 HIGH  
**Category:** Security — Webhook Auth  
**Effort:** 15 min

---

## Problem

`lib/kyc/digio.ts` line 161:

```typescript
export function verifyDigioWebhook(payload: string, signature: string): boolean {
  const secret = process.env.DIGIO_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

**Bug 1 — Length crash:** `crypto.timingSafeEqual` throws `ERR_CRYPTO_TIMINGSAFEEQUAL_LENGTH` when the two `Buffer`s have different byte lengths. If Digio sends a signature in a different format (e.g., base64 instead of hex, or truncated), this throws an unhandled exception. The webhook handler at `app/api/webhooks/kyc/route.ts` does not wrap `verifyDigioWebhook` in a try/catch, so the exception propagates as a 500 error — and the webhook silently retries, potentially causing duplicate KYC status updates.

**Bug 2 — Encoding mismatch:** `Buffer.from(expected)` encodes the hex string as UTF-8 bytes (64 bytes for SHA-256 hex). `Buffer.from(signature)` also encodes the raw header value as UTF-8. This is consistent **only if** Digio sends hex. If Digio sends the HMAC as raw bytes or base64, the comparison is wrong. Verify Digio's actual signature format from their documentation and match it.

---

## Files Affected

- `lib/kyc/digio.ts` — fix `verifyDigioWebhook`
- `app/api/webhooks/kyc/route.ts` — wrap call in try/catch (defense in depth)

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Fix `verifyDigioWebhook` in `lib/kyc/digio.ts`

Replace lines 157–162 with:

```typescript
export function verifyDigioWebhook(payload: string, signature: string): boolean {
  const secret = process.env.DIGIO_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  // Digio sends HMAC-SHA256 as lowercase hex string.
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature.trim(), 'utf8');

  // timingSafeEqual requires equal lengths — return false for length mismatch
  // instead of throwing, to prevent unhandled exceptions from malformed requests.
  if (expectedBuf.byteLength !== providedBuf.byteLength) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
```

**Key changes:**
1. Guard `!signature` early — empty header → `false` (not crash)
2. Length check before `timingSafeEqual` → `false` instead of throw
3. `.trim()` on signature — Digio/nginx may add trailing whitespace

### Step 2 — Harden the webhook handler

In `app/api/webhooks/kyc/route.ts`, wrap the verify call:

**Before:**
```typescript
if (!verifyDigioWebhook(body, signature)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

**After:**
```typescript
let signatureValid = false;
try {
  signatureValid = verifyDigioWebhook(body, signature);
} catch {
  signatureValid = false;
}
if (!signatureValid) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

### Step 3 — Env var check

Verify `DIGIO_WEBHOOK_SECRET` is set in `.env` (local) and in the Hostinger VPS `.env.production`. If not set, every Digio webhook returns 401 and KYC callbacks silently fail. Add a startup log warning:

In `lib/kyc/digio.ts` at module level (after the imports):

```typescript
if (!process.env.DIGIO_WEBHOOK_SECRET) {
  console.warn('[digio] DIGIO_WEBHOOK_SECRET not set — webhook signature verification disabled');
}
```

---

## Verification

1. Call `verifyDigioWebhook('payload', '')` → returns `false` (no crash)
2. Call `verifyDigioWebhook('payload', 'short')` → returns `false` (no crash)
3. `npx tsc --noEmit` → 0 errors
4. `POST /api/webhooks/kyc` with wrong signature → 401 (no 500)
