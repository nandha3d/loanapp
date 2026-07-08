# Step 9 — Branch Security, RBAC, and Mobile Parity

## Goal

Ensure all chit-fund backend actions, API routes, UI actions, and mobile flows enforce tenant + branch + role access consistently.

Current risk found:

- Some routes check tenant but not branch.
- Mobile APIs must not allow a branch user to access another branch's chit group by guessing an ID.
- Web server actions and mobile APIs should behave consistently.

## Files to inspect/update

```txt
lib/api/v1-auth.ts
lib/branch.ts
lib/access.ts
lib/moduleGate.ts
app/(dashboard)/[module]/chits/actions.ts
app/api/v1/chits/route.ts
app/api/v1/chits/[id]/route.ts
app/api/v1/chits/[id]/auctions/route.ts
app/api/v1/chits/[id]/members/route.ts
app/api/v1/chits/[id]/payments/route.ts
app/api/v1/chits/subscriptions/[id]/miss/route.ts
mobile/lib/data/services/chit_service.dart
mobile/lib/features/chits/*.dart
```

## Security principles

Every chit query must enforce:

```txt
tenantId = current tenant
appType = current app/module
branchId = active branch / allowed branch, unless superadmin/developer has tenant-wide access
deletedAt = null where applicable
```

Every write action must enforce:

```txt
role allows action
module chitfunds is enabled
tenant matches
branch matches
entity status allows action
```

## Shared helper

If `scopedBranchWhere(ctx)` already exists, use it everywhere.

For web server actions, create equivalent helper if missing:

```ts
export async function getChitScope() {
  const tenantId = await getDefaultTenantId();
  const appType = await getUserAppType();
  const branchId = await getActiveBranchId();
  await requireModule(tenantId, 'chitfunds');
  return { tenantId, appType, branchId };
}

export function chitGroupWhere(scope: { tenantId: string; appType: string; branchId?: string | null }, extra: any = {}) {
  return {
    tenantId: scope.tenantId,
    appType: scope.appType,
    deletedAt: null,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...extra,
  };
}
```

Create:

```txt
lib/chits/access.ts
```

## Required route security updates

### `GET /api/v1/chits`

Must filter by:

```ts
where: {
  tenantId: ctx.tenantId,
  appType: ctx.appType,
  deletedAt: null,
  ...scopedBranchWhere(ctx),
}
```

### `GET /api/v1/chits/:id`

Must use `findFirst`, not `findUnique`, with tenant/branch scope:

```ts
where: {
  id,
  tenantId: ctx.tenantId,
  appType: ctx.appType,
  deletedAt: null,
  ...scopedBranchWhere(ctx),
}
```

### `POST /api/v1/chits/:id/auctions`

Must validate:

- Group belongs to tenant/app/branch.
- Auction belongs to group.
- Winner member belongs to same group.
- Winner has not already won.
- Caller role is admin/superadmin/developer.

### `POST /api/v1/chits/:id/payments`

Must validate:

- Group belongs to tenant/app/branch.
- Subscription belongs to member of same group.
- Collector role allows collection.
- Agent can collect only allowed branch/route/customers based on existing app rules.

### `POST /api/v1/chits/subscriptions/:id/miss`

Already uses `scopedBranchWhere(ctx)` in the inspected code. Keep and mirror this pattern everywhere.

## Web server actions

Update all actions in:

```txt
app/(dashboard)/[module]/chits/actions.ts
```

Actions to check:

- `createChitGroup`
- `recordAuctionWinner`
- `recordChitPayment`
- `markPaymentMissed`
- `cancelChitGroup`
- `updateChitGroup`
- new activation/security/report actions from earlier steps

Each should:

1. Get session.
2. Validate role.
3. Get tenant/app/branch scope.
4. Require `chitfunds` module.
5. Use tenant/app/branch-scoped query.
6. Create audit log.

## RBAC matrix

| Action | Agent | Admin | Superadmin | Developer |
|---|---:|---:|---:|---:|
| View chit group list | Yes, scoped | Yes | Yes | Yes |
| Collect subscription | Yes, scoped | Yes | Yes | Yes |
| Mark missed | Optional | Yes | Yes | Yes |
| Create group | No | Yes | Yes | Yes |
| Edit group | No | Yes | Yes | Yes |
| Activate group | No | Yes | Yes | Yes |
| Record auction bid | Optional | Yes | Yes | Yes |
| Confirm auction | No | Yes | Yes | Yes |
| Approve security | No | Optional | Yes | Yes |
| Release payout | No | Optional | Yes | Yes |
| Reverse receipt | No | Yes | Yes | Yes |
| View all branch reports | No | Own branch | Tenant-wide | Tenant-wide |

Make optional items configurable if the business wants stricter control.

## Mobile parity checklist

Mobile APIs should support the same business state as web:

- Compliance status
- Member ticket/agreement/nominee details
- Auction bids and attendance
- Security status
- Payout status
- Collection receipt details
- Penalties
- Reversal visibility

Flutter models to update:

```txt
mobile/lib/data/models/chit.dart
```

Service methods to add/update:

```txt
mobile/lib/data/services/chit_service.dart
```

Recommended methods:

```dart
Future<List<ChitGroup>> getChits();
Future<ChitGroupDetail> getChitDetail(String id);
Future<void> collectSubscriptionPayment(...);
Future<void> markSubscriptionMissed(String subscriptionId);
Future<void> addAuctionBid(...);
Future<void> markAuctionAttendance(...);
Future<void> confirmAuction(...);
Future<void> submitSecurity(...);
Future<void> releasePayout(...);
```

## Security tests

Create:

```txt
tests/chits/chitSecurity.test.ts
```

Test cases:

1. User from Tenant A cannot access Tenant B chit group.
2. Branch A admin cannot access Branch B chit group.
3. Agent cannot create chit group.
4. Agent cannot confirm auction.
5. Agent cannot release payout.
6. Admin cannot update deleted group.
7. Mobile API rejects guessed subscription ID from another branch.
8. Report builder does not leak other branch data.
9. Winner member must belong to same group.
10. Payment subscription must belong to same group.

## Acceptance criteria

- All chit APIs use tenant/app/branch-scoped queries.
- All server actions enforce role and module access.
- Mobile and web return consistent data.
- Security tests pass.
- No direct `findUnique({ id })` write path exists for chit entities without scope validation.

## Implementation prompt for coding agent

```txt
Implement Step 9 for the LoanTrack chit-fund module.

Audit every chit web server action and mobile API route for tenant, appType, branch, module, role, and deletedAt security. Create shared chit access helpers if needed. Replace unsafe findUnique-by-id flows with scoped findFirst validation before update/delete/posting.

Update mobile models/services to match the web business workflow for compliance, members, auctions, security, payouts, receipts, and penalties. Add tests/chits/chitSecurity.test.ts covering cross-tenant, cross-branch, role abuse, guessed ID abuse, and report leakage.
```
