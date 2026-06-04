# Role-Based Web-to-Mobile UI Mapping

Date: 2026-06-03

This audit compares the web app against the Flutter mobile app at route/page level for the four staff roles: developer, superadmin, admin, and agent. The web app is treated as the source of truth. A missing item means the web page is available for that role but mobile has no matching route/page. A partial item means mobile has a related route, but the route does not cover the same page-level surface.

Machine-readable source: `docs/mobile-parity/role-ui-map.json`

Repeatable check:

```powershell
npm run ui-map:roles
```

## Role Summary

| Role | Seed login | Web landing | Mobile landing | Missing | Partial |
|---|---|---|---|---:|---:|
| Developer | `developer / dev123` | `/admin` | `/dashboard` | 6 | 2 |
| Superadmin | `superadmin / super123` | `/portal` | `/dashboard` | 8 | 4 |
| Admin | `admin / admin123` | `/portal` | `/dashboard` | 2 | 6 |
| Agent | `karthik / agent123` | `/microlending/agent-dashboard` | `/dashboard` | 1 | 1 |

## Developer

Web landing: `/admin`

Mobile landing: `/dashboard`

Developer has the largest management gap. The web app exposes a platform administration area, tenant billing, pricing catalog, affiliate administration, branch/user administration, and developer-level tenant settings. Mobile exposes the normal app shell and some operational modules, but not a developer panel.

Missing on mobile:

| Priority | Web page | Missing mobile page |
|---|---|---|
| P2 | `/admin` | Developer admin dashboard |
| P2 | `/admin/billing` | Tenant billing |
| P2 | `/admin/billing/pricing` | Pricing catalog |
| P2 | `/admin/affiliates` | Affiliate administration |
| P2 | `/admin/users` | Cross-tenant user management |
| P2 | `/admin/branches` | Branch management |

Partial on mobile:

| Priority | Web page | Mobile page | Gap |
|---|---|---|---|
| P0 | `/microlending/settings` | `/settings/system` | Developer system settings route exists, but parity docs still mark the developer system tab as incomplete. |
| P2 | `/microlending/accounting/premium` | `/accounting` | Web has the premium accounting suite; mobile has only summary accounting. |

Mobile-only:

| Mobile page | Notes |
|---|---|
| `/lock` | Biometric lock/security surface. |

## Superadmin

Web landing: `/portal`

Mobile landing: `/dashboard`

Superadmin can operate the tenant and also use owner-level pages such as portal billing, branches, users, subscription, affiliate, and request workflows. Mobile covers daily operational pages but does not yet cover tenant-owner administration.

Missing on mobile:

| Priority | Web page | Missing mobile page |
|---|---|---|
| P2 | `/portal` | App selector and branch/module launch |
| P2 | `/portal/billing` | Portal billing |
| P2 | `/admin/users` | Tenant user management |
| P2 | `/admin/branches` | Branch management |
| P2 | `/microlending/subscription` | Subscription |
| P2 | `/microlending/branch-requests` | Branch requests |
| P2 | `/microlending/module-requests` | Module requests |
| P3 | `/microlending/affiliate` | Affiliate program |

Partial on mobile:

| Priority | Web page | Mobile page | Gap |
|---|---|---|---|
| P2 | `/microlending/accounting/premium` | `/accounting` | Premium accounting suite reduced to summary screen. |
| P2 | `/microlending/reports/agents` | `/reports` | No dedicated mobile agent reports route. |
| P3 | `/microlending/notifications/log` | `/notifications` | Mobile has notifications list only. |
| P1 | `/microlending/settings` | `/settings` | Mobile settings do not cover the full web settings tabs. |

Mobile-only:

| Mobile page | Notes |
|---|---|
| `/lock` | Biometric lock/security surface. |
| `/collection` | Mobile includes offline/sync collection behavior. |

## Admin

Web landing: `/portal`

Mobile landing: `/dashboard`

Admin mobile coverage is strongest for operational pages: dashboard, customers, loans, collection, route tracking, KYC, wallet, analytics, reports, notifications, and settings all have a related mobile route. The main gaps are team/admin management and depth inside settings, approvals, penalties, reports, accounting, and notification logs.

Missing on mobile:

| Priority | Web page | Missing mobile page |
|---|---|---|
| P3 | `/portal` | App selector |
| P2 | `/admin/team` | Team management |

Partial on mobile:

| Priority | Web page | Mobile page | Gap |
|---|---|---|---|
| P2 | `/microlending/accounting/premium` | `/accounting` | Premium accounting suite reduced to summary screen. |
| P2 | `/microlending/reports/agents` | `/reports` | No dedicated mobile agent reports route. |
| P1 | `/microlending/settings` | `/settings` | Missing several web settings tabs: packages, bulk, bureau, NPA, data, security. |
| P3 | `/microlending/notifications/log` | `/notifications` | Mobile has notifications list only. |
| P1 | `/microlending/penalties` | `/penalties` | Existing parity docs still mark waive/filter coverage as missing. |
| P1 | `/microlending/approvals` | `/approvals` | Existing parity docs still mark full request-type coverage as partial. |

Mobile-only:

| Mobile page | Notes |
|---|---|
| `/lock` | Biometric lock/security surface. |
| `/collection` | Mobile includes offline/sync collection behavior. |

## Agent

Web landing: `/microlending/agent-dashboard`

Mobile landing: `/dashboard`

Agent mobile is field-first. Collection and customer workflows exist on both surfaces, while mobile also includes phone-native collection behavior. The main parity issue is that the web has a dedicated agent dashboard route and an approvals page available to the agent, while mobile uses a shared dashboard and hides approvals for the seeded agent.

Missing on mobile:

| Priority | Web page | Missing mobile page |
|---|---|---|
| P1 | `/microlending/approvals` | Agent approvals |

Partial on mobile:

| Priority | Web page | Mobile page | Gap |
|---|---|---|---|
| P2 | `/microlending/agent-dashboard` | `/dashboard` | Mobile dashboard exists but is not a dedicated route for the web agent dashboard. |

Mobile-only:

| Mobile page | Notes |
|---|---|
| `/lock` | Biometric lock/security surface. |
| `/loans` | Mobile exposes a loans route; web middleware blocks agent loan pages. |
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
