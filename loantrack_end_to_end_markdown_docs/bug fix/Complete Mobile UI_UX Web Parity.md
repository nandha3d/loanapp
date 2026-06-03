# Complete Mobile UI/UX Web Parity

## Summary
- Implement full mobile UI/UX parity for `developer`, `superadmin`, `admin`, and `agent`, using the web app as source of truth.
- Build the missing experiences as mobile-native Flutter screens, not desktop table copies.
- Include the full premium accounting suite in mobile, per your choice.
- Keep web UI unchanged, but add/extend `/api/v1` backend endpoints where mobile currently cannot call web-only server actions.

## Key Changes

### Mobile App
- Rework role-based navigation in `V:\pers\Freelance\loanapp\mobile\lib\core\router\app_router.dart` and the mobile More/dashboard areas so each role sees the same functional areas available on web.
- Add mobile management hubs:
  - Developer hub: tenants, plans/pricing, modules/add-ons, affiliate settings/rewards, system settings, billing/subscription oversight.
  - Superadmin hub: users, branches, billing, package/module requests, approvals, reports, settings.
  - Admin hub: team/agents, branch-scoped users, approvals, penalties, reports, settings.
  - Agent view: preserve field-first UX while exposing every agent-allowed web workflow.
- Upgrade existing partial screens instead of duplicating them:
  - approvals
  - penalties
  - settings/system/payment/notification
  - accounting
  - reports
  - loan/customer detail flows
- Add mobile-native UI patterns for dense operational workflows:
  - filter chips
  - compact list rows
  - detail sheets
  - role-gated action menus
  - tabbed management pages
  - create/edit forms
  - empty/loading/error states
  - confirmation flows for destructive or financial actions

### Backend API
- Add mobile-callable `/api/v1` endpoints for web-only workflows currently backed by server actions.
- Required API areas:
  - admin users/team management
  - branch management
  - billing/subscription management
  - branch requests
  - module/package requests
  - developer pricing/modules/add-ons
  - affiliate configuration and rewards
  - advanced settings groups
  - notification logs
  - loan statements/PDF access where needed
  - full premium accounting workflows
- Use existing mobile auth helpers from `V:\pers\Freelance\loanapp\lib\api\v1-auth.ts`.
- Preserve tenant, branch, and role scoping exactly as the web app expects.
- Do not expose developer-only or superadmin-only operations to lower roles.

### Premium Accounting
- Replace the current summary-style mobile accounting screen with the full suite:
  - dashboard
  - chart of accounts
  - ledgers
  - journal entries
  - payment vouchers
  - contra entries
  - debit/credit notes
  - bank reconciliation
  - trial balance
  - profit/loss
  - balance sheet
  - cash flow
  - TDS/GST-style reports if present on web
  - import/export flows
  - approval/reversal/edit flows where web supports them
- Use mobile layouts optimized for review and action:
  - summary cards only where useful
  - searchable ledgers
  - drill-down transaction detail
  - bottom-sheet actions
  - date-range and branch filters
  - guarded financial edit confirmations

### Mapping And Checker
- Update the existing role UI map so it reflects actual implementation, not only gaps.
- Keep `V:\pers\Freelance\loanapp\docs\mobile-parity\ROLE-UI-MAPPING.md` as the human-readable matrix.
- Keep `V:\pers\Freelance\loanapp\docs\mobile-parity\role-ui-map.json` as the machine-readable source for parity checks.
- Extend the parity checker so missing/partial items fail only when the implementation claims parity.

## Test Plan
- Reconfirm Node runtime before browser checks:
  - `node -v` must be `v22.22.0+`
  - confirm Browser/Codex runtime is not using old `v22.17.0`
- Run:
  - `npm run ui-map:roles`
  - `npm run typecheck`
  - targeted Playwright role smoke for `developer`, `superadmin`, `admin`, `agent`
  - `flutter analyze`
  - `flutter test`
- Add Flutter tests for:
  - role-based navigation visibility
  - admin/developer management service parsing
  - accounting service parsing and failure states
  - settings save/load flows
- Add API tests or Playwright/API checks for:
  - role access denial
  - tenant isolation
  - branch isolation
  - create/edit/delete or approve/reject workflows
- Run mobile visual verification on emulator for all four roles and capture the main dashboard, More menu, management hub, settings, approvals, reports, and accounting screens.

## Assumptions
- “Complete” means workflow/page parity with mobile-appropriate UX, not pixel-identical web layout.
- Web UI remains unchanged.
- Backend `/api/v1` additions are allowed because mobile cannot safely reuse many web server actions directly.
- Existing web business rules are source of truth.
- Existing mobile offline/field workflows should remain intact.
- Borrower portal remains out of scope unless separately requested.
