# Role-Based Web-to-Mobile UI Mapping

Date: 2026-06-04

This audit compares the web app against the Flutter mobile app at route/page level for `developer`, `superadmin`, `admin`, and `agent`. The web app remains the source of truth. A missing item means no mobile route exists for a web page available to that role. A partial item means mobile has a related route, but the page-level surface is still narrower than web.

Machine-readable source: `docs/mobile-parity/role-ui-map.json`

Repeatable check:

```powershell
npm run ui-map:roles
```

## Role Summary

| Role | Seed login | Web landing | Mobile landing | Missing | Partial |
|---|---|---|---|---:|---:|
| Developer | `developer / dev123` | `/admin` | `/admin` | 0 | 0 |
| Superadmin | `superadmin / super123` | `/portal` | `/portal` | 0 | 3 |
| Admin | `admin / admin123` | `/portal` | `/portal` | 0 | 5 |
| Agent | `karthik / agent123` | `/microlending/agent-dashboard` | `/dashboard` | 0 | 1 |

## Developer

Mobile now covers the developer console routes, tenant/user/branch administration, billing/pricing, affiliates, developer request review queues, tenant settings including the developer-only system tab, and the operational routes.

Remaining route/page gaps: none in the current role map.

Mobile-only:

| Mobile page | Notes |
|---|---|
| `/lock` | Biometric lock/security surface. |

## Superadmin

Mobile now covers the portal, billing/subscription, user and branch administration, module/branch request history, affiliate page, business operations, settings, reports, accounting, approvals, KYC, and notifications.

Partial on mobile:

| Priority | Web page | Mobile page | Gap |
|---|---|---|---|
| P2 | `/microlending/reports/agents` | `/reports` | Reports route exists, but there is no dedicated agent-reports route. |
| P3 | `/microlending/notifications/log` | `/notifications` | Mobile has a notifications list, not the full web notification-log page. |
| P1 | `/microlending/settings` | `/settings` | Mobile covers the major settings pages; remaining route-level gap is deeper web data/settings coverage without a dedicated mobile route. |

Mobile-only:

| Mobile page | Notes |
|---|---|
| `/lock` | Biometric lock/security surface. |
| `/collection` | Mobile includes offline/sync collection behavior. |

## Admin

Mobile now covers portal, team management, dashboard, customers, loans, collection, route tracking, penalties, approvals, KYC, wallet, analytics, reports, accounting, notifications, and the major settings pages.

Partial on mobile:

| Priority | Web page | Mobile page | Gap |
|---|---|---|---|
| P2 | `/microlending/reports/agents` | `/reports` | Reports route exists, but there is no dedicated agent-reports route. |
| P1 | `/microlending/settings` | `/settings` | Mobile covers the major settings pages; remaining route-level gap is deeper web data/settings coverage without a dedicated mobile route. |
| P3 | `/microlending/notifications/log` | `/notifications` | Mobile has a notifications list, not the full web notification-log page. |
| P1 | `/microlending/penalties` | `/penalties` | Route exists, but existing parity notes still mark some filter/waive UX depth as partial. |
| P1 | `/microlending/approvals` | `/approvals` | Route exists, but existing parity notes still mark some request-type coverage as partial. |

Mobile-only:

| Mobile page | Notes |
|---|---|
| `/lock` | Biometric lock/security surface. |
| `/collection` | Mobile includes offline/sync collection behavior. |

## Agent

Mobile covers the field workflows: dashboard, approvals, customers, new customer, collection, notifications, and offline collection behavior.

Partial on mobile:

| Priority | Web page | Mobile page | Gap |
|---|---|---|---|
| P2 | `/microlending/agent-dashboard` | `/dashboard` | Mobile has a shared dashboard rather than a dedicated agent-dashboard route. |

Mobile-only:

| Mobile page | Notes |
|---|---|
| `/lock` | Biometric lock/security surface. |
| `/loans` | Mobile exposes loan browsing; web middleware blocks agent loan pages. |
| `/collection` | Mobile includes offline/sync collection behavior. |

## Automation Notes

`npm run ui-map:roles` validates:

- Node runtime is `v22.22.0` or newer.
- All four roles exist in `role-ui-map.json`.
- Web source files referenced by the map exist.
- Mobile routes referenced by the map can be extracted from `mobile/lib/core/router/app_router.dart`.
- Missing and partial gaps have valid `P0` through `P3` priorities.

The checker can also write a snapshot report:

```powershell
npm run ui-map:roles -- --write-report
```
