# L — Admin Panel (mobile)

**Priority:** P2 · **Persona:** Superadmin / Admin.

## Stories
- **L1** Branch management (create, assign superadmin).
- **L2** Team/users management (create agents/admins, roles).
- **L3** Billing + invoices + plan changes.
- **L4** Branch-requests + module-requests approval flows.

## Verified facts
- Web: `app/admin/{branches,team,users,billing,module-requests,branch-requests,settings,affiliates}/**` (session-auth + server actions).
- Mobile today: agent-create only (inline dialog in `new_customer_screen.dart` via `settingsService.createAgent`). No branch/billing/request UI.
- Need **Bearer** mirrors under `app/api/v1/admin/**` (or extend existing v1 routes), gated to superadmin/admin as the web does.

## Implementation (phase)
1. **L2 users/team:** `GET/POST/PATCH /v1/admin/users` (list, create with role, enable/disable). Screen `admin/users_screen.dart`. Reuse `createAgent` for agents; generalise to roles.
2. **L1 branches:** `GET/POST /v1/admin/branches` (create, assign superadmin). Screen `admin/branches_screen.dart`.
3. **L4 requests:** `GET /v1/admin/{branch-requests,module-requests}` + approve/reject → screens; or fold into the Approvals queue (G2) if entityTypes align.
4. **L3 billing:** `GET /v1/admin/billing` (plan, usage, invoices) + change-plan action. Screen `admin/billing_screen.dart`. Read-only first; plan change later.

Copy each mutation's logic from the matching `app/admin/**/actions.ts`; never duplicate pricing math (use catalog/`lib`).

## Acceptance criteria
- [ ] Role-gating matches web (admin vs superadmin).
- [ ] Created users can log in; roles enforced by `_moduleBlocked`.
- [ ] Branch assignment writes `SuperadminBranch` like web register does.
- [ ] Request approve/reject applies side-effects.

## Files touched
- NEW `app/api/v1/admin/**`.
- NEW `mobile/lib/features/admin/**` + service + models + routes.
- `app_strings.dart`.
