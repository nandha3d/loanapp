# LoanApp Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the launch-blocking audit findings that can be safely completed in this codebase pass.

**Architecture:** Resolve tenant identity from the authenticated session first, with host/subdomain lookup as a fallback for tenant-aware requests. Keep security behavior close to request/data boundaries with small helper modules that are testable without a browser runtime.

**Tech Stack:** Next.js 16 App Router/Proxy, NextAuth v5, Prisma, MySQL, TypeScript, Node `crypto`, focused `tsx` regression tests.

---

### Task 1: Focused Regression Tests

**Files:**
- Create: `tests/security.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a focused test command**

```json
"test:security": "tsx tests/security.test.ts"
```

- [ ] **Step 2: Add failing tests for helpers**

```ts
import assert from 'node:assert/strict';
import {
  decryptAadharNumber,
  encryptAadharNumber,
  maskAadharNumber,
} from '../lib/pii';
import {
  isTenantTrialExpired,
  normalizeRazorpaySubscriptionStatus,
} from '../lib/subscription';
import {
  extractTenantSlugFromHost,
  isTenantHostAllowedForSession,
} from '../lib/tenant';
import {
  checkFixedWindowLimit,
  createFixedWindowStore,
} from '../lib/rateLimit';
import { verifyRazorpayWebhookSignature } from '../lib/razorpay';

const encrypted = encryptAadharNumber('1234 5678 9012', '0123456789abcdef0123456789abcdef');
assert.notEqual(encrypted, '1234 5678 9012');
assert.equal(decryptAadharNumber(encrypted, '0123456789abcdef0123456789abcdef'), '123456789012');
assert.equal(maskAadharNumber('123456789012'), 'XXXX XXXX 9012');
assert.equal(extractTenantSlugFromHost('alpha.loantrack.test:3000', 'loantrack.test'), 'alpha');
assert.equal(extractTenantSlugFromHost('localhost:3000', 'loantrack.test'), null);
assert.equal(isTenantHostAllowedForSession({ requestedTenantId: 't1', sessionTenantId: 't1', role: 'admin' }), true);
assert.equal(isTenantHostAllowedForSession({ requestedTenantId: 't2', sessionTenantId: 't1', role: 'admin' }), false);
assert.equal(isTenantHostAllowedForSession({ requestedTenantId: 't2', sessionTenantId: 't1', role: 'developer' }), true);
assert.equal(isTenantTrialExpired({ plan: 'trial', status: 'active', trialEndsAt: new Date('2026-01-01') }, new Date('2026-01-02')), true);
assert.equal(normalizeRazorpaySubscriptionStatus('subscription.halted'), 'past_due');
const store = createFixedWindowStore();
assert.equal(checkFixedWindowLimit(store, 'u', 2, 1000, 0).allowed, true);
assert.equal(checkFixedWindowLimit(store, 'u', 2, 1000, 1).allowed, true);
assert.equal(checkFixedWindowLimit(store, 'u', 2, 1000, 2).allowed, false);
const secret = 'secret';
const body = '{"event":"subscription.activated"}';
assert.equal(verifyRazorpayWebhookSignature(body, secret, 'bad'), false);
```

- [ ] **Step 3: Run the tests and verify RED**

Run: `npm run test:security`

Expected: FAIL because the helper modules and package script do not exist yet.

### Task 2: Tenant Context and Trial Enforcement

**Files:**
- Modify: `lib/tenant.ts`
- Modify: `lib/apiAuth.ts`
- Modify: `app/proxy.ts`
- Create: `proxy.ts`

- [ ] **Step 1: Implement tenant helpers**

Implement host slug parsing, tenant lookup from slug, session-first tenant resolution, and session/host mismatch checks.

- [ ] **Step 2: Update API context**

Use the authenticated session tenant from `getCurrentTenantId()` rather than hardcoded `slug: default`.

- [ ] **Step 3: Add root Next 16 Proxy**

Move the request guard to root `proxy.ts`, keep role restrictions, pass tenant host headers, and redirect expired trial tenants to `/subscription`.

### Task 3: Billing and Subscription Gaps

**Files:**
- Modify: `lib/subscription.ts`
- Create: `lib/razorpay.ts`
- Create: `app/api/webhooks/razorpay/route.ts`

- [ ] **Step 1: Implement subscription state helpers**

Add `isTenantTrialExpired()`, `assertTenantSubscriptionAccess()`, and Razorpay status mapping.

- [ ] **Step 2: Add Razorpay webhook handler**

Require `RAZORPAY_WEBHOOK_SECRET`, verify `x-razorpay-signature`, and update `TenantSubscription` for `subscription.activated`, `subscription.charged`, `subscription.halted`, and `subscription.cancelled`.

### Task 4: Auth and Cron Hardening

**Files:**
- Create: `lib/rateLimit.ts`
- Modify: `lib/auth.ts`
- Modify: `app/api/cron/accrue-penalties/route.ts`

- [ ] **Step 1: Add fixed-window login rate limiting**

Use an in-memory fixed-window limiter for credentials login attempts.

- [ ] **Step 2: Enforce cron secret**

Return `500` if `CRON_SECRET` is not configured, and `401` for missing/invalid bearer tokens.

### Task 5: PII Encryption

**Files:**
- Create: `lib/pii.ts`
- Modify: `app/(dashboard)/customers/actions.ts`
- Modify: `app/(dashboard)/customers/[id]/page.tsx`
- Modify: `app/(dashboard)/approvals/actions.ts`
- Modify: `app/api/customers/[id]/route.ts`
- Modify: `app/api/approvals/[id]/review/route.ts`

- [ ] **Step 1: Add AES-256-GCM helper**

Encrypt Aadhaar values before storage using `PII_ENCRYPTION_KEY`, support legacy plaintext reads, and provide masked display values.

- [ ] **Step 2: Wire customer and approval paths**

Encrypt submitted `aadharNumber` fields before writes and decrypt/mask values only when preparing server-rendered/customer review data.

### Task 6: Verification and Audit Report

**Files:**
- Create: `loantrack_end_to_end_markdown_docs/bug fix/loanapp_audit_fix_report.md`

- [ ] **Step 1: Run focused tests**

Run: `npm run test:security`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Document residual gaps**

Write an audit-style remediation report listing fixed items, partially fixed items, remaining product work, and verification evidence.
