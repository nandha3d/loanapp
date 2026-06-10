# SEC-01 — Delete `/api/npa/*` Shadow Routes

**Priority:** 🔴 HIGH  
**Category:** Security / Hygiene  
**Effort:** 5 min

---

## Problem

Two parallel sets of NPA routes exist:

| Old (shadow) | New (canonical) |
|---|---|
| `app/api/npa/upgrade/route.ts` | `app/api/v1/npa/upgrade/route.ts` |
| `app/api/npa/loans/route.ts` | `app/api/v1/npa/loans/route.ts` |
| `app/api/npa/summary/route.ts` | `app/api/v1/npa/summary/route.ts` |
| `app/api/npa/history/route.ts` | `app/api/v1/npa/history/route.ts` |

All four old routes are **auth-guarded** (confirmed), but keeping them creates two live URL surfaces for the same logic. If auth or business logic is updated in only one set, the other becomes a stale vulnerability. The `/api/npa/*` path also bypasses the `v1` versioning middleware.

---

## Files to Delete

```
app/api/npa/upgrade/route.ts
app/api/npa/loans/route.ts
app/api/npa/summary/route.ts
app/api/npa/history/route.ts
```

After deletion, remove the now-empty directories:

```
app/api/npa/upgrade/
app/api/npa/loans/
app/api/npa/summary/
app/api/npa/history/
app/api/npa/             ← delete parent if empty
```

---

## Step-by-Step Instructions for AI Agent

1. **Search all callers** — before deleting, grep the entire codebase for any references to the old paths:

   ```
   grep -r "/api/npa/" --include="*.ts" --include="*.tsx" --include="*.dart" .
   ```

   Expected: only the route files themselves. If any frontend component, API client, or Flutter Dart file references `/api/npa/` (not `/api/v1/npa/`), update those references to `/api/v1/npa/` first.

2. **Update all callers** found in step 1:
   - In TypeScript/TSX files: change `fetch('/api/npa/...')` → `fetch('/api/v1/npa/...')`
   - In Flutter Dart files: update `ApiEndpoints` constants or inline strings

3. **Delete the four shadow route files** listed above.

4. **Delete empty directories** left behind.

5. **TypeScript build check:**
   ```
   npx tsc --noEmit
   ```
   Must pass with zero errors.

6. **Smoke test** (manual or automated):
   - `GET /api/v1/npa/summary` returns 200 with valid JSON
   - `GET /api/npa/summary` returns 404 (route deleted)

---

## Verification

- `GET /api/npa/summary` → **404 Not Found**
- `GET /api/v1/npa/summary` → **200 OK**
- `npx tsc --noEmit` → **0 errors**
