# FEAT-03 — Mobile: Read-Only Accounting UI

**Priority:** 🔴 HIGH  
**Category:** Feature — Mobile Parity  
**Effort:** 2–3 days (Flutter)

---

## Background

The web app has 19 premium accounting pages (Chart of Accounts, Journal Entries, Trial Balance, P&L, Balance Sheet, Aged Receivables, Bank Reconciliation, etc.). The Flutter mobile app has zero accounting UI. For field managers who need to check financial position on mobile, this is a critical gap.

**Scope (phase 1 — read-only):**
- Trial Balance summary
- Journal Entry list with filter by date/status
- Journal Entry detail (debit/credit lines)
- Chart of Accounts list

**Out of scope (phase 1):**
- Creating/editing journal entries on mobile (complex, defer)
- Bank reconciliation on mobile (desktop-class feature)

---

## API Endpoints Already Available

The following web APIs already exist and work for mobile (they use NextAuth session which mobile can't use — but the mobile v1 auth middleware can be applied):

| Endpoint | What it returns |
|---|---|
| `GET /api/v1/accounting/trial-balance` | Account balances for a period |
| `GET /api/v1/accounting/journal` | JE list with pagination |
| `GET /api/v1/accounting/journal/[id]` | JE detail with lines |
| `GET /api/v1/accounting/accounts` | Chart of Accounts |

**Problem:** These routes use `auth()` (NextAuth web session), not `requireMobileContext`. The mobile JWT token is rejected. Each route needs a dual-auth guard.

---

## Step-by-Step Instructions for AI Agent (Backend First)

### Step 1 — Add mobile auth support to accounting routes

The pattern for dual-auth (web session OR mobile JWT) already exists elsewhere in the codebase. Find an example:

```
grep -rn "requireMobileContext\|auth()" app/api/v1 --include="route.ts" -l
```

Then find a route that supports BOTH (there may not be one yet). Create a helper in `lib/api/dualAuth.ts`:

```typescript
import { auth } from '@/lib/auth';
import { requireMobileContext } from '@/lib/api/v1-auth';
import { NextRequest } from 'next/server';

export type ApiActor = {
  tenantId: string;
  userId:   string;
  role:     string;
  branchId: string | null;
  appType:  string | null;
};

/**
 * Resolve actor from either a web NextAuth session OR a mobile JWT.
 * Returns null if neither is valid.
 */
export async function resolveActor(req: NextRequest): Promise<ApiActor | null> {
  // 1. Try mobile JWT first (Authorization: Bearer <jwt>)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const mobileAuth = await requireMobileContext(req);
    if (!mobileAuth.response) return mobileAuth.context;
    // If mobile auth failed but there's a Bearer header, don't fall through to web auth
    return null;
  }

  // 2. Try web session (cookie-based)
  const session = await auth();
  if (!session?.user?.tenantId) return null;
  const u = session.user as any;
  return {
    tenantId: u.tenantId,
    userId:   u.id,
    role:     u.role ?? 'viewer',
    branchId: u.branchId ?? null,
    appType:  u.appType ?? null,
  };
}
```

### Step 2 — Update accounting API routes to use `resolveActor`

For each accounting route that needs mobile access, replace:

```typescript
const session = await auth();
if (!session?.user?.tenantId) return fail('Unauthorized', 401);
const tenantId = session.user.tenantId as string;
```

With:

```typescript
import { resolveActor } from '@/lib/api/dualAuth';

const actor = await resolveActor(req);
if (!actor) return fail('Unauthorized', 401);
const { tenantId } = actor;
```

Apply to: trial-balance route, journal list route, journal detail route, accounts list route.

### Step 3 — Flutter: Add accounting section to nav

In `mobile/lib/navigation/` (or wherever the bottom nav / drawer is defined), add an "Accounting" item that is:
- Hidden if `premiumAccountingEnabled == false` (check from a settings API call or local storage)
- Visible only to roles: `admin`, `superadmin`, `accountant`

### Step 4 — Flutter: Trial Balance screen

Create `mobile/lib/screens/accounting/trial_balance_screen.dart`:

```dart
// Fetch from GET /api/v1/accounting/trial-balance?from=YYYY-MM-DD&to=YYYY-MM-DD
// Display as a ListView of account rows with debit/credit columns
// Total row at bottom
// Period selector at top (month picker)
```

Use the existing `ApiService` pattern from `mobile/lib/services/api_service.dart`.

### Step 5 — Flutter: Journal Entry list screen

Create `mobile/lib/screens/accounting/journal_list_screen.dart`:

```dart
// Fetch from GET /api/v1/accounting/journal?page=1&pageSize=20
// ListView of journal entries: entryNo, date, narration, status, amount
// Tap → detail screen
// Filter chips: All / Posted / Draft
```

### Step 6 — Flutter: Journal Entry detail screen

Create `mobile/lib/screens/accounting/journal_detail_screen.dart`:

```dart
// Fetch from GET /api/v1/accounting/journal/[id]
// Show: header info (date, narration, ref, status)
// Table of lines: account name, debit, credit
// Total row with balance check (should be zero)
```

---

## Verification

- Mobile JWT token accepted on `GET /api/v1/accounting/trial-balance`
- Web session still works on same route (no regression)
- Flutter trial balance screen shows accounts and balances
- `flutter analyze` → 0 issues
- `npx tsc --noEmit` → 0 errors
