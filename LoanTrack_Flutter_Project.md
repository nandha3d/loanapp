# LoanTrack Mobile — Flutter Project Document

**Version:** 1.0 | **Date:** May 2026
**Type:** Microlending & Chit Fund Management Platform
**Target Platforms:** Android, iOS
**Framework:** Flutter

---

## STRICT IMPLEMENTATION RULES

> These rules apply to every section of this document. An AI agent MUST follow all of them without deviation.

1. **No hallucination.** Every field, endpoint, model, and behaviour defined here is the single source of truth. Do not invent fields, endpoints, or logic not listed.
2. **No assumptions.** If a value is not specified, leave it unset or ask. Do not guess defaults.
3. **Exact types.** Use the exact Dart types defined in Section 3. Do not substitute or widen types.
4. **Exact endpoints.** Use the exact API paths in Section 2.4. Do not create new endpoints.
5. **Exact roles.** Enforce RBAC exactly as defined in Section 5. No role may access more than its column allows.
6. **Exact package versions.** Use the versions in Section 2.1. Do not upgrade or downgrade silently.
7. **Feature scope.** Only build features listed in Section 4. Do not add unrequested features.
8. **Priority order.** Build in sprint order (Section 8). Do not skip sprints.
9. **Security rules.** Follow every rule in Section 9.3 without exception.
10. **Offline rules.** The collection module MUST implement offline support exactly as Section 6 defines.

---

## 1. Executive Summary

LoanTrack is a **multi-tenant microlending and chit fund management platform**.

- **Current state:** Exists as a Next.js web application.
- **Goal:** Build a native Flutter mobile app for Android and iOS.
- **Primary users:** Field agents (daily collection) and branch admins/superadmins (oversight and approvals).

### 1.1 Business Context

The web platform manages:
- Loan disbursement
- Instalment collection
- Chit funds
- Agent routes

**Gap:** Field agents lack a native mobile interface.

**Flutter app must deliver:**
- Offline-capable daily collection workflows for field agents
- Real-time dashboards and KPIs for branch admins and superadmins
- Push notifications for pending instalments and approvals
- Multi-tenant and multi-branch operations with role-based access
- Integration with existing REST/server-action backend via a new API layer

### 1.2 Project Scope

| Module | Web Status | Flutter Priority |
|---|---|---|
| Authentication & 2FA | Complete | P1 — Must Have |
| Dashboard & KPIs | Complete | P1 — Must Have |
| Customer Management | Complete | P1 — Must Have |
| Loan Management | Complete | P1 — Must Have |
| Daily Collection | Complete | P1 — Must Have |
| Penalties & Overdue | Complete | P2 — Should Have |
| Approvals Workflow | Complete | P2 — Should Have |
| Analytics & Reports | Complete | P2 — Should Have |
| Chit Fund Management | Complete | P2 — Should Have |
| Accounting & Ledger | Complete | P3 — Nice to Have |
| Settings & Admin | Complete | P3 — Nice to Have |
| Subscription & Billing | Complete | P3 — Nice to Have |

**RULE:** P1 modules MUST be completed before any P2 work begins. P2 before P3.

---

## 2. Technical Architecture

### 2.1 Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Mobile Framework | Flutter | 3.22+ |
| Language | Dart | 3.4+ |
| State Management | Riverpod | 2.5+ |
| Navigation | go_router | 13+ |
| HTTP Client | dio + retrofit | Latest |
| Local DB / Cache | Hive + Isar | Latest |
| Auth Storage | flutter_secure_storage | 9+ |
| Push Notifications | firebase_messaging | Latest |
| Charts & Analytics | fl_chart | Latest |
| PDF Generation | pdf / printing | Latest |
| Camera / Photo | image_picker | Latest |
| Biometrics | local_auth | Latest |
| UPI Intent | url_launcher | Latest |
| Connectivity | connectivity_plus | Latest |
| Testing | flutter_test + mockito | Latest |

**RULE:** Do not use any package not in this list without explicit approval.

### 2.2 Project Directory Structure

```
lib/
├── core/
│   ├── auth/
│   ├── network/
│   ├── router/
│   ├── theme/
│   └── utils/
├── data/
│   ├── models/
│   ├── repositories/
│   └── services/         # API services (Dio/Retrofit)
├── features/
│   ├── dashboard/
│   ├── customers/
│   ├── loans/
│   ├── collection/
│   ├── approvals/
│   ├── analytics/
│   ├── chits/
│   └── settings/
├── shared/
│   ├── widgets/
│   ├── constants/
│   └── extensions/
├── main.dart
└── app.dart
```

**RULE:** Every new file MUST be placed in the directory matching its layer. No files outside this structure.

### 2.3 Architecture Pattern

Use **Repository Pattern with Clean Architecture**. Three strict layers:

| Layer | Contents | Responsibilities |
|---|---|---|
| Presentation | Flutter Widgets + Riverpod Notifiers | UI state only |
| Domain | Use Cases, Entities, Repository Interfaces | Business logic only |
| Data | Dio/Retrofit services, Hive cache, Repository Implementations | Data access only |
| Core | DI setup, router, auth interceptor, error handling | Cross-cutting concerns |

**RULE:** A layer MUST NOT import from a layer above it. Data → Domain → Presentation only.

### 2.4 Backend Integration

**Base URL:** `/api/v1`

**Authentication:** All requests MUST include a JWT bearer token.

**Required headers on every request:**
- `Authorization: Bearer <jwt_token>`
- `X-Tenant-Slug: <tenant_slug>`
- `X-Branch-Id: <branch_id>` (or as query param where applicable)

**Standard JSON response envelope:**
```json
{
  "data": <payload>,
  "error": <string|null>,
  "pagination": <object|null>
}
```

**HTTP verb rules:**
- `GET` — list or detail only
- `POST` — create only
- `PATCH` — update only
- `DELETE` — soft delete only

#### API Endpoints

| API Group | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/2fa` |
| Customers | `GET /customers`, `GET /customers/:id`, `GET /customers/:id/loans` |
| Loans | `GET /loans`, `GET /loans/:id`, `GET /loans/:id/instalments`, `POST /loans/new` |
| Collection | `GET /collection/today`, `GET /collection/:date`, `POST /collection/entry` |
| Penalties | `GET /penalties`, `PATCH /penalties/:id/settle` |
| Approvals | `GET /approvals`, `PATCH /approvals/:id/approve`, `PATCH /approvals/:id/reject` |
| Analytics | `GET /analytics/summary`, `GET /analytics/collections`, `GET /analytics/agents` |
| Chits | `GET /chits`, `GET /chits/:id`, `GET /chits/:id/members`, `GET /chits/:id/auctions` |
| Settings | `GET /settings`, `GET /routes`, `GET /packages` |
| Reports | `GET /reports/daily`, `GET /reports/agent`, `GET /reports/overdue` |

**RULE:** Do not call any endpoint not listed above. Do not create new endpoints client-side.

---

## 3. Core Data Models

> All models map directly to the Prisma schema and API responses. Use exact field names and types.

### 3.1 User & Auth

```dart
class User {
  final String id;           // CUID, NOT NULL
  final String name;         // NOT NULL
  final String phone;        // NOT NULL, unique per tenant
  final String? email;       // NULLABLE
  final String username;     // NOT NULL, unique per tenant
  final UserRole role;       // NOT NULL — see enum below
  final String? branchId;    // NULLABLE — null means access to all branches
  final String appType;      // NOT NULL — "microlending" | "chit"
  final String status;       // NOT NULL — "active" | "suspended"
  final bool totpEnabled;    // NOT NULL — 2FA flag
}

enum UserRole {
  developer,
  superadmin,
  admin,
  agent,
}
```

### 3.2 Customer

```dart
class Customer {
  final String id;                        // NOT NULL
  final String customerCode;              // NOT NULL, auto-generated
  final String name;                      // NOT NULL
  final String phone;                     // NOT NULL
  final String? address;                  // NULLABLE
  final String status;                    // NOT NULL — "active" | "pending_review" | "suspended"
  final String? routeId;                  // NULLABLE
  final String? agentId;                  // NULLABLE — assigned agent
  final int? creditScore;                 // NULLABLE — range: 0–100
  final List<KycDocument> kycDocuments;   // NOT NULL, may be empty list
  final List<Guarantor> guarantors;       // NOT NULL, may be empty list
  final List<Loan> loans;                 // NOT NULL, may be empty list
}
```

### 3.3 Loan

```dart
class Loan {
  final String id;                        // NOT NULL
  final String loanCode;                  // NOT NULL
  final String customerId;               // NOT NULL
  final double principalAmount;          // NOT NULL
  final double disbursedAmount;          // NOT NULL
  final double interestRate;             // NOT NULL — percentage
  final String frequency;               // NOT NULL — "daily" | "weekly" | "monthly"
  final String status;                  // NOT NULL — "pending_review" | "active" | "overdue" | "closed"
  final DateTime startDate;             // NOT NULL
  final DateTime? endDate;              // NULLABLE
  final int instalmentCount;            // NOT NULL
  final double penaltyRate;             // NOT NULL
  final List<Instalment> instalments;   // NOT NULL, may be empty list
}
```

### 3.4 Instalment

```dart
class Instalment {
  final String id;                 // NOT NULL
  final String loanId;             // NOT NULL
  final int instalmentNo;          // NOT NULL — 1-based index
  final DateTime dueDate;          // NOT NULL
  final double dueAmount;          // NOT NULL
  final double receivedAmount;     // NOT NULL — default: 0
  final String status;             // NOT NULL — "upcoming" | "paid" | "partial" | "missed"
  final DateTime? paidAt;          // NULLABLE
  final String? paymentMode;       // NULLABLE — "cash" | "upi" | "bank"
}
```

**RULE:** Do not add fields not listed. Do not rename fields. Nullable fields MUST use `?` in Dart. Non-nullable fields MUST NOT be nullable.

---

## 4. Feature Modules

> Build each module exactly as described. Do not add screens, forms, or actions not listed.

### 4.1 Authentication Module

**Purpose:** Entry point for all users. Handles login, 2FA, session, and biometrics.

**Screens to build:**
1. Login screen — inputs: `username` (String), `password` (String)
2. TOTP 2FA verification screen — input: 6-digit TOTP code
3. Biometric authentication screen — triggered on app re-open (FaceID / Fingerprint)

**Behaviours:**
- Store token securely using `flutter_secure_storage`
- Auto-logout when token expires OR when a `401` response is received
- Biometric unlock uses `local_auth` package
- On successful login, fetch `/auth/me` and store user object

### 4.2 Dashboard Module

**Purpose:** Role-aware KPI overview.

**Screens to build:**
1. Dashboard screen (role-aware — see RBAC in Section 5)

**UI components required:**
- KPI cards: `Total Customers`, `Active Loans`, `Today's Collection`, `Overdue Amount`
- Today's instalment list with a quick collect action per item
- Weekly collection trend — bar chart using `fl_chart`
- Pending approvals count badge
- Recent activity feed
- Route-wise outstanding amounts list

### 4.3 Customer Module

**Purpose:** Full customer lifecycle management.

**Screens to build:**
1. Customer list screen — with search, route filter, status filter
2. Customer profile screen — shows: personal info, KYC docs, guarantors, credit score
3. Customer loan history screen — lists all loans for the customer
4. New customer form — includes photo capture (`image_picker`) and KYC document upload

**Actions:**
- Change customer status: `active` / `suspend` / `pending_review`

### 4.4 Loan Module

**Purpose:** Loan application, disbursement, and lifecycle management.

**Screens to build:**
1. Loan list screen — filters: status, frequency
2. Loan detail screen — shows: amortisation schedule, payment history, collateral
3. New loan form — fields: customer selection, package selection, custom terms
4. Loan approval screen — ONLY for `admin` and `superadmin` roles

**Actions:**
- Approve or reject loan (admin/superadmin only)
- Edit or restructure a loan
- Record payment at instalment level

### 4.5 Collection Module (Agent-Primary)

**Purpose:** Daily instalment collection for field agents. MUST be optimised for speed and offline use.

**Screens to build:**
1. Today's collection list — grouped by route
2. Quick collect screen — tap to mark instalment as `paid` (mode: `cash` or `upi`)
3. Partial payment screen — record `receivedAmount` less than `dueAmount`
4. Cash handover summary screen — shown at end of day
5. Offline sync status screen — shows pending/synced/failed entries

**Actions:**
- Launch UPI payment intent using `url_launcher`
- Record collection entry via `POST /collection/entry`
- Queue entries offline (Isar) when network unavailable
- Sync queue when connectivity restored
- Show overdue instalments with days-overdue count

**Offline behaviour:** See Section 6 for exact rules.

### 4.6 Penalties Module

**Purpose:** Track and settle penalties for missed instalments.

**Screens to build:**
1. Pending penalties list — grouped by loan/customer
2. Penalty settlement screen — select payment mode

**Behaviour:**
- Penalty amounts are auto-calculated from the loan's `penaltyRate` field
- Settlement calls `PATCH /penalties/:id/settle`

### 4.7 Approvals Module

**Purpose:** Centralised approval queue.

**Screens to build:**
1. Pending approvals list — items: loans, customers, branch requests
2. Approval detail screen — with Approve / Reject action and review note input
3. Approval history log screen

**RULE:** This module is only visible to `admin`, `superadmin`, `developer` roles (see Section 5).

### 4.8 Analytics Module

**Purpose:** Charts and business insights. Visible to admin roles only.

**Screens to build:**
1. Analytics dashboard screen

**Charts required (all using `fl_chart`):**
- Collection trend: bar chart, selectable by daily / weekly / monthly
- Agent performance: comparison bar chart
- Overdue vs on-time ratio: donut chart
- Route-wise collection: summary list or bar chart
- Disbursement vs repayment: line chart over time

### 4.9 Chit Fund Module

**Purpose:** Manage chit fund groups. Only relevant for `appType = "chit"`.

**Screens to build:**
1. Chit group list screen
2. Chit group detail screen
3. Member management screen — add/remove members
4. Auction recording screen — one record per cycle
5. Monthly subscription tracking screen

**Data field to check:** `User.appType === "chit"` — hide this module for `appType = "microlending"`.

### 4.10 Reports Module

**Purpose:** Generate and export financial reports.

**Screens to build:**
1. Reports selection screen — choose report type and date range
2. Report preview screen

**Report types:**
- Daily collection report → `GET /reports/daily`
- Agent-wise report → `GET /reports/agent`
- Overdue report → `GET /reports/overdue`

**Export:**
- PDF export using `pdf` + `printing` packages
- Date range filter available on all reports

### 4.11 Settings Module

**Purpose:** Admin-level configuration.

**Screens to build:**
1. Route management screen — create, edit, delete routes, assign agents
2. Loan package management screen
3. Penalty rate configuration screen
4. UPI QR code upload screen — using `image_picker`
5. 2FA enable/disable screen
6. User management screen — ONLY for `superadmin` role

---

## 5. Role-Based Access Control (RBAC)

| Module | developer | superadmin / admin | agent |
|---|---|---|---|
| Dashboard | Full + system stats | Full | Own routes only |
| Customers | Full | Full | Own customers only |
| Loans | Full | Full + Approve | View + Collect only |
| Collection | Full | Full | Own routes only |
| Approvals | Full | Full | HIDDEN |
| Analytics | Full | Full | HIDDEN |
| Chits | Full | Full | View only |
| Reports | Full | Full | HIDDEN |
| Settings | Full | Partial (no user mgmt) | HIDDEN |
| User Management | Full | Partial (no dev tools) | HIDDEN |

**RULE — Module visibility logic:**
1. After login, call `GET /auth/me` and retrieve `user.enabledModules`.
2. Hide any navigation item for a module NOT present in `enabledModules`.
3. The server is the authority. Do not hard-code module lists client-side.
4. Additionally apply the RBAC table above to restrict actions within visible modules.

---

## 6. Offline Support Strategy

**Scope:** The Collection module MUST work offline. All other modules may show a "no network" error.

### 6.1 Cached Data (Hive)

Cache the following at app open (when network is available):
- Today's instalment list — per agent
- Customer and loan reference data — per agent's assigned customers
- Route assignments — for offline navigation

**RULE:** Cache is read-only when offline. Do not allow editing cached data directly.

### 6.2 Offline Collection Queue (Isar)

When a collection entry is submitted without network connectivity:

1. Save entry to a local Isar queue with status `pending`.
2. Assign an idempotency key: format = `collectionDate + ":" + instalmentId`
3. When connectivity is restored (detected via `connectivity_plus`), sync all `pending` entries to `POST /collection/entry`.
4. On successful sync, update local entry status to `synced`.
5. On server rejection, update local entry status to `failed` and notify user.

**Sync status values:** `pending` | `synced` | `failed`

**UI requirement:** Display sync status indicator on each collection entry in the list.

### 6.3 Conflict Resolution

- The idempotency key (`collectionDate:instalmentId`) prevents duplicate submissions server-side.
- If the server returns a conflict (instalment already marked as paid), mark local entry as `failed` with reason `"already_paid"`.
- Show a visible conflict notification to the user.
- Do NOT silently discard or auto-resolve conflicts.

---

## 7. Push Notifications

**Provider:** Firebase Cloud Messaging (FCM) via `firebase_messaging` package.

**Backend behaviour:** The server stores FCM tokens per user device and triggers pushes via Firebase Admin SDK.

**Flutter app MUST:**
1. Request notification permission on first launch.
2. Register and send FCM device token to the backend on login.
3. Handle background and foreground notification payloads.
4. Route the user to the correct screen based on notification type.

| Notification Type | Trigger | Target Role |
|---|---|---|
| Overdue Instalment | Daily cron at 9 AM | Agent assigned to route |
| Pending Approval | On new loan/customer submitted | admin / superadmin |
| Collection Reminder | Day-start for today's schedule | agent |
| Penalty Created | On penalty auto-creation | admin |
| Cash Handover Due | End-of-day reminder | agent |
| Approval Resolved | On approve/reject action | Requester (any role) |

---

## 8. Development Timeline

**Team size:** 2 developers
**Total estimated duration:** 19 weeks (~5 months)

| Sprint | Duration | Deliverables | Priority |
|---|---|---|---|
| Sprint 1 | 2 weeks | Project setup, auth module, navigation, role gates | P1 |
| Sprint 2 | 2 weeks | Dashboard module, Customer list + detail | P1 |
| Sprint 3 | 2 weeks | Loan list + detail + new loan form | P1 |
| Sprint 4 | 2 weeks | Collection module + offline queue | P1 |
| Sprint 5 | 2 weeks | Penalties module, Approvals workflow | P2 |
| Sprint 6 | 2 weeks | Analytics charts, Reports + PDF export | P2 |
| Sprint 7 | 2 weeks | Chit Fund module | P2 |
| Sprint 8 | 2 weeks | Settings module, push notifications, biometrics | P3 |
| Sprint 9 | 2 weeks | QA, bug fixes, performance tuning | P1–P3 |
| Sprint 10 | 1 week | App store submission, production release | — |

**RULE:** Do not start Sprint N+1 until Sprint N deliverables are complete and reviewed.

---

## 9. Quality & Testing Strategy

### 9.1 Testing Levels

| Level | Scope | Coverage Target |
|---|---|---|
| Unit Tests | Repository methods, use cases, utility functions | 70% minimum |
| Widget Tests | Collection list, loan form, login screen | All critical components |
| Integration Tests | Login flow, collect instalment flow, new customer flow | All P1 journeys |
| Manual QA | Role-based flows, offline/online transitions, edge cases | All sprints |

**Testing packages:** `flutter_test` + `mockito`

### 9.2 Performance Targets

| Metric | Target |
|---|---|
| App cold start time | Under 3 seconds |
| Collection list render (200 items) | Under 500ms |
| Scroll performance on lists | Smooth 60fps |
| All async operations | MUST show loading state — no silent waits |

### 9.3 Security Rules

> These are MANDATORY. No exceptions.

1. **JWT storage:** Store ONLY in `flutter_secure_storage` (uses Keychain on iOS, Keystore on Android).
2. **No plain storage:** NEVER store sensitive data in `SharedPreferences` or any unencrypted storage.
3. **Certificate pinning:** Enable for all API requests.
4. **Biometric lock:** Lock app and require biometric re-auth when app resumes from background.
5. **2FA:** Implement TOTP support matching the web implementation exactly.
6. **Auto-logout:** Trigger on token expiry OR on any `401` response from the API.

---

## Appendix: Enum Reference

```dart
// User roles — used in RBAC
enum UserRole { developer, superadmin, admin, agent }

// Loan frequency
// Values: "daily" | "weekly" | "monthly"

// Loan status
// Values: "pending_review" | "active" | "overdue" | "closed"

// Customer status
// Values: "active" | "pending_review" | "suspended"

// Instalment status
// Values: "upcoming" | "paid" | "partial" | "missed"

// Payment mode
// Values: "cash" | "upi" | "bank"

// User status
// Values: "active" | "suspended"

// App type
// Values: "microlending" | "chit"

// Offline sync status (local only, not in API)
// Values: "pending" | "synced" | "failed"
```

---

*Document ends. Build only what is defined above. Any feature, field, endpoint, or behaviour not listed here is out of scope.*
