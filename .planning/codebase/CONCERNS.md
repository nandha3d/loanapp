# CONCERNS.md — Technical Debt & Critical Issues

> Auto-generated from `loanapp` codebase analysis

---

## Critical Security Concerns

### 1. Documented Security Gaps (from SYSTEM_SPECIFICATION.md §9)

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| 1 | `/penalties` missing `appType` filter | HIGH | Needs verification |
| 2 | `/reports` missing `appType` filter | HIGH | Needs verification |
| 3 | `/notifications` missing `appType` filter | MEDIUM | Needs verification |
| 4 | `/customers/new` queries lack `appType` | HIGH | Needs verification |
| 5 | `/loans/new` queries lack `appType` | HIGH | Needs verification |
| 6 | `deleteRoute` no ownership check | HIGH | Needs verification |
| 7 | `deleteLoanPackage` no ownership check | HIGH | Needs verification |
| 8 | `submitCollectionEntry` no `appType` on DailyCollection | MEDIUM | Needs verification |
| 9 | `settings/page.tsx` missing import | CRITICAL | Needs verification |
| 10 | No middleware for route-level auth | MEDIUM | RESOLVED — middleware.ts exists |

**Action:** Audit each gap against current codebase to verify fix status.

---

## Technical Debt

### 1. Ad-Hoc Console Logging
**Severity:** MEDIUM
**Location:** `lib/auth.ts` and various files
**Issue:** Mixed use of `console.log`, `console.warn`, `console.error` alongside structured `logger` in `lib/logger.ts`
**Impact:** Logs are inconsistent, harder to parse in production
**Fix:** Migrate all console.* calls to `logger.info/warn/error`

### 2. Test Framework Absence
**Severity:** MEDIUM
**Issue:** Tests use raw `node:assert/strict` with no test runner
**Impact:** No test grouping, no coverage, no CI-friendly output
**Fix:** Migrate to Vitest or Jest

### 3. Hardcoded Redirect URLs
**Severity:** LOW
**Location:** `middleware.ts`, various pages
**Issue:** Redirect targets hardcoded as strings (`'/collection'`, `'/dashboard'`)
**Impact:** Refactoring risk if routes change
**Fix:** Centralize route constants

### 4. Dual Rate Limit Implementation
**Severity:** LOW
**Location:** `lib/rateLimit.ts`
**Issue:** Both MySQL-backed and in-memory implementations exported
**Impact:** Confusion about which to use, dead code
**Fix:** Remove in-memory exports or mark clearly as test-only

### 5. SQL Fix Files in Repository Root
**Severity:** LOW
**Files:** `fix.sql`, `fix_reverse.sql`, `fix_reverse_utf8.sql`, `fix_utf8.sql`
**Issue:** Ad-hoc SQL fix scripts in repo root
**Impact:** Clutter, potential for running outdated fixes
**Fix:** Move to `database/` directory or convert to Prisma migrations

---

## Architecture Concerns

### 1. Single Database Multi-Tenancy
**Risk:** MEDIUM
**Issue:** All tenants share one database; row-level isolation depends on discipline
**Mitigation:** `tenantId` + `appType` enforced at helper level (`getDefaultTenantId()`)
**Risk if bypassed:** Complete cross-tenant data exposure
**Recommendation:** Add automated tests for tenant isolation

### 2. Middleware Header Modification Side Effect
**Risk:** MEDIUM
**Location:** `middleware.ts:80`
**Issue:** Comment notes that passing headers to `NextResponse.next()` can cause POST body consumption
**Impact:** Auth API routes need special case handling (line 90-91)
**Recommendation:** Monitor for related bugs; consider alternative tenant passing mechanism

### 3. SSL Termination Detection
**Risk:** MEDIUM
**Location:** `lib/auth.ts:113`, `middleware.ts:107`
**Issue:** Fallback `secureCookie: true` in production due to reverse proxy SSL termination
**Impact:** Potential cookie security issues if misconfigured
**Recommendation:** Use `NEXTAUTH_URL` env var for explicit protocol configuration

### 4. Large Prisma Schema
**Risk:** LOW
**Issue:** 25+ models, 758 lines in schema.prisma
**Impact:** Slower generate/migrate times, complex relations
**Recommendation:** Consider schema organization with comments/regions

---

## Performance Concerns

### 1. N+1 Query Risk
**Risk:** MEDIUM
**Issue:** Server Components may trigger N+1 queries for customer lists with loan/instalment relations
**Recommendation:** Use Prisma `include` strategically; add `// @slowQuery` comments for review

### 2. No Caching Layer
**Risk:** LOW
**Issue:** No Redis or external cache; all data fetched from MySQL on every request
**Mitigation:** React `cache()` used for `getCurrentTenantId()` (per-request)
**Recommendation:** Consider Redis for frequently accessed data (settings, packages)

### 3. Standalone Output Size
**Risk:** LOW
**Issue:** `output: 'standalone'` bundles all dependencies
**Impact:** Larger deployment artifact
**Mitigation:** Already configured; monitor bundle size

---

## Maintainability Concerns

### 1. No Component Library
**Risk:** LOW
**Issue:** Only 3 components in `components/` (Modal, Sidebar, Topbar, LogoutButton)
**Impact:** UI code likely duplicated across pages
**Recommendation:** Extract reusable components (tables, forms, cards, buttons)

### 2. Inline Styles in globals.css
**Risk:** LOW
**Issue:** All styling in single `globals.css` file
**Impact:** Growing file, potential conflicts
**Recommendation:** Split into module CSS files or adopt CSS-in-JS

### 3. Seed Script Duplication
**Risk:** LOW
**Files:** `prisma/seed.ts`, `prisma/seed_demo.ts`
**Issue:** Two seed scripts with unclear separation of concerns
**Recommendation:** Consolidate or clearly document purpose of each

---

## Deployment Concerns

### 1. Hostinger-Specific Workarounds
**Location:** `lib/auth.ts`, `middleware.ts`
**Issue:** Code contains Hostinger-specific SSL and proxy workarounds
**Risk:** May break on other hosting platforms
**Recommendation:** Abstract platform-specific logic behind feature flags

### 2. Environment Variable Proliferation
**Issue:** Multiple env vars across `.env`, `.env_prod`, `.env.local`
**Vars:** `AUTH_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_ROOT_DOMAIN`, `APP_ROOT_DOMAIN`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MS`, `LOGIN_IP_MAX`, `ALLOW_ROOT_DOMAIN_LOGIN`, etc.
**Recommendation:** Document all required env vars with defaults

### 3. No CI/CD Pipeline
**Issue:** No `.github/workflows/` for automated testing/building
**Recommendation:** Add GitHub Actions for lint, typecheck, test, build

---

## Data Integrity Concerns

### 1. Soft Delete Consistency
**Issue:** `deletedAt` field exists on some models but not all
**Models with soft delete:** Tenant, User, Customer, Loan, Vehicle, ChitGroup
**Models without:** Branch, Instalment, Penalty, CollectionEntry, etc.
**Recommendation:** Audit which entities need soft delete; apply consistently

### 2. Decimal Precision
**Issue:** Financial fields use `@db.Decimal(12, 2)` — verify this is sufficient for all use cases
**Recommendation:** Document precision requirements per field type

### 3. Cron Lock Reliability
**Location:** `CronLock` model
**Issue:** Single-row lock with `expiresAt` — if process crashes, lock may persist
**Mitigation:** `expiresAt` field allows stale lock detection
**Recommendation:** Ensure cron job checks and clears stale locks
