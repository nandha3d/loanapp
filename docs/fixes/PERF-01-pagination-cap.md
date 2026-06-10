# PERF-01 — Cap All Unbounded List Endpoints

**Priority:** 🟠 HIGH  
**Category:** Performance — DB protection  
**Effort:** 1–2 hours (affects many routes)

---

## Problem

Multiple `GET` list endpoints accept a `pageSize` query param but do not cap it. An attacker or buggy client can pass `?pageSize=999999` causing a full table scan. On a low-spec VPS (1–2 GB RAM) this can OOM the Node process.

Common pattern in the codebase:

```typescript
const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
// ← no cap. Caller can pass 999999.
```

---

## Files to Audit

Run this grep to find all uncapped `pageSize` usages:

```
grep -rn "pageSize" app/api --include="route.ts"
```

**Known offenders (from audit):**
- `app/api/v1/loans/route.ts`
- `app/api/v1/customers/route.ts`
- `app/api/v1/collection/runs/route.ts`
- `app/api/v1/accounting/journal/route.ts`
- `app/api/v1/nach/mandate/route.ts`
- `app/api/npa/loans/route.ts` (being deleted in SEC-01, but also in v1 version)
- Any other route using `parseInt(...pageSize...)` without a `Math.min`

---

## Fix Design

Create a shared pagination helper. Apply it everywhere.

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Create `lib/api/pagination.ts`

```typescript
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX     = 200;

/**
 * Parse and clamp pagination params from URL search params.
 * Always returns safe values — never lets caller exceed PAGE_SIZE_MAX.
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE_DEFAULT)) || PAGE_SIZE_DEFAULT),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
```

### Step 2 — Apply to every list route

For each route identified in the grep:

**Before:**
```typescript
const page     = parseInt(searchParams.get('page') ?? '1');
const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
const skip     = (page - 1) * pageSize;
```

**After:**
```typescript
import { parsePagination } from '@/lib/api/pagination';

const { page, pageSize, skip } = parsePagination(searchParams);
```

### Step 3 — Special case: export endpoints

Routes that export full data (CSV/Excel/Tally) must NOT use `parsePagination` — they need all records. Instead add an explicit `export=true` param guard:

```typescript
const isExport = searchParams.get('export') === 'true';
if (!isExport) {
  const { page, pageSize, skip } = parsePagination(searchParams);
  // use paginated query
} else {
  // use full query with a hard cap of 50000 rows for safety
  const EXPORT_MAX = 50_000;
  // ...
}
```

### Step 4 — Build check

```
npx tsc --noEmit
```

---

## Verification

- `GET /api/v1/loans?pageSize=999999` → returns at most 200 records, `pageSize` in response is 200
- `GET /api/v1/loans?pageSize=10` → returns 10 records
- `GET /api/v1/loans` (no param) → returns 20 records (default)
