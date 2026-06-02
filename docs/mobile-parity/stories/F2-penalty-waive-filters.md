# F2/F3 — Penalty Waive + Filters (mobile)

**Priority:** P1 · **Persona:** Admin.

## Stories
- **F2** As an **admin**, I want to **waive** a penalty with a reason.
- **F3** As an **admin**, I want **status/route filters** on the penalties list.

## Verified facts
- **Existing:** `app/api/v1/penalties/route.ts` (GET) and `app/api/v1/penalties/[id]/settle/route.ts` (settle). **No waive endpoint exists** → must be created.
- **Web reference for waive logic:** `app/(dashboard)/[module]/penalties/*` (find the server action that waives — copy the exact mutation: it likely sets waived amount, recomputes net, writes audit, may create an approval request). Mirror that logic server-side in a new Bearer route. **Do not** invent the penalty math; copy the web action's computation.
- **Mobile screen:** `mobile/lib/features/penalties/penalties_screen.dart` (already lists + settle).

## Server (new)
Create `app/api/v1/penalties/[id]/waive/route.ts` (POST):
- `requireMobileContext`; role ∈ {admin, superadmin, developer} else 403.
- Body `{ amount?: number, reason: string }` (full or partial waive — match web).
- Load penalty scoped to `ctx.tenantId`; apply the **same mutation the web waive action performs** (read it first); write `auditLog`. Return updated penalty via envelope `ok(...)`.

## Mobile
1. **Service** (`penalties_service.dart` or wherever settle lives): add `waive(id, {amount, reason})` → POST new endpoint.
2. **List filters:** add a filter bar (status chips: all/pending/settled/waived/overdue; route dropdown from `settingsService.routes()`). Filter client-side over the already-fetched list **only for display** (the amounts themselves come from API).
3. **Waive action:** row action → dialog with optional amount + required reason → call service → `ref.invalidate(penaltiesProvider)`; snackbar.
4. Gate waive on admin role.

## i18n
`pen.waive`="Waive" · `pen.waive_reason`="Reason for waive" · `pen.waived`="Penalty waived" · `pen.filter_status`="Status" · `pen.filter_route`="Route" · status labels reuse existing.

## Acceptance criteria
- [ ] Waive (full + partial) updates net outstanding from API response.
- [ ] Reason required; empty blocked.
- [ ] Filters narrow the visible list; counts correct.
- [ ] Waive hidden for agents.
- [ ] Server waive math == web waive math (verified by reading web action).

## Files touched
- NEW `app/api/v1/penalties/[id]/waive/route.ts`.
- penalties service + endpoints const.
- `mobile/lib/features/penalties/penalties_screen.dart`.
- `app_strings.dart`.
