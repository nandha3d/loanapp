# TESTING.md — Test Strategy & Execution

> Auto-generated from `loanapp` codebase analysis

---

## Test Framework

| Aspect | Details |
|--------|---------|
| Runner | `tsx` (TypeScript execution) |
| Assertion | Node.js `assert/strict` |
| Pattern | Script-based tests (no Jest/Vitest framework) |
| Location | `tests/` directory at project root |

---

## Existing Tests

### 1. `repaymentAllocation.test.ts`
**What it tests:** Payment allocation logic across instalments

Tests `allocatePaymentsAcrossInstalments()` from `lib/repayments.ts`:
- Full payment covering multiple instalments sequentially
- Partial payment on a single instalment
- Overdue instalment status and days calculation
- Outstanding amount calculation

**Run:** `npm run test:repayments`

---

### 2. `security.test.ts`
**What it tests:** Security-related functionality

Likely covers:
- Rate limiting behavior
- Auth token validation
- Input sanitization
- PII masking

**Run:** `npm run test:security`

---

### 3. `authDatabase.test.ts`
**What it tests:** Authentication database interactions

Likely covers:
- User lookup with tenant scoping
- Password hash verification
- TOTP validation
- Session token creation

**Run:** `npm run test:authdb`

---

### 4. `proxyPublicPaths.test.ts`
**What it tests:** Public path handling behind reverse proxy

Likely covers:
- `isPublicPath()` function from middleware
- Static asset serving
- `_next` path handling
- `/api/auth` special case (no header modification)

**Run:** `npm run test:proxy-public`

---

### 5. `uiAssets.test.ts`
**What it tests:** UI asset availability and serving

Likely covers:
- Static file existence
- Image optimization with sharp
- Font loading
- Logo/asset paths

**Run:** `npm run test:ui-assets`

---

### 6. `collectionAction.test.ts`
**What it tests:** Collection entry submission logic

Likely covers:
- Collection entry creation
- Instalment status updates
- DailyCollection totals
- Agent identity stamping

**Run:** `tsx tests/collectionAction.test.ts` (no npm script defined)

---

## Running All Tests

```bash
# Individual tests
npm run test:repayments
npm run test:security
npm run test:authdb
npm run test:proxy-public
npm run test:ui-assets

# Collection action test (no npm script)
tsx tests/collectionAction.test.ts

# All tests (PowerShell)
Get-ChildItem tests/*.test.ts | ForEach-Object { tsx $_.FullName }
```

---

## Test Gaps & Recommendations

### Missing Test Coverage

| Area | Priority | Notes |
|------|----------|-------|
| **Server Actions** | HIGH | No tests for customer CRUD, loan creation, collection submission |
| **Middleware** | HIGH | No tests for tenant resolution, role-based redirects |
| **Tenant Isolation** | HIGH | No tests verifying cross-tenant data cannot leak |
| **Rate Limiting** | MEDIUM | In-memory tests exist but MySQL-backed logic untested |
| **Penalty Calculation** | MEDIUM | `lib/penalties.ts` logic untested |
| **Subscription Gating** | MEDIUM | `assertTenantSubscriptionAccess()` untested |
| **Approval Request Flow** | MEDIUM | End-to-end approval workflow untested |
| **Webhook Processing** | MEDIUM | Razorpay webhook handler untested |
| **API Routes** | LOW | REST endpoints have no test coverage |
| **PDF Generation** | LOW | @react-pdf/renderer outputs untested |

### Recommended Test Framework Migration

Consider migrating to a proper test framework for:
- Mocking capabilities (Prisma, NextAuth)
- Test grouping and reporting
- Coverage reports
- CI/CD integration

**Options:**
- **Vitest** — Fast, native ESM, good Next.js compatibility
- **Jest** — Industry standard, extensive ecosystem
- **Playwright** — For E2E browser testing

### Integration Testing Needs

| Scenario | Approach |
|----------|----------|
| Full loan lifecycle | Create customer → create loan → submit collections → close loan |
| Multi-tenant isolation | Create data in tenant A, verify invisible in tenant B |
| Role-based access | Login as each role, verify page access matrix |
| Subscription enforcement | Exceed plan limits, verify blocking |
