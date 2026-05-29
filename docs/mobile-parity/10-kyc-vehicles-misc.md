# 10 · KYC, Vehicles, Subscription & Misc

## KYC Review Queue — ❌ missing
- **Web:** `kyc-review` queue; verify/reject KYC; methods: manual upload, Aadhaar OTP, Video KYC.
- **Mobile:** none.
- **API needed:** `GET /api/v1/kyc/queue`, `POST /api/v1/kyc/[customerId]/verify|reject`, OTP/video session endpoints.
- **Acceptance:** reviewer can clear the KYC queue from mobile.

## Vehicles — 🟡 partial
- **Web:** list, detail, **new** (`vehicles/new`).
- **Mobile:** `vehicles_screen.dart`, `vehicle_detail_screen.dart`; v1 `GET /vehicles`, `GET /vehicles/[id]`.
- **Gap:** ❌ create/edit vehicle (no POST/PATCH listed).
- **API needed:** `POST /api/v1/vehicles`, `PATCH /api/v1/vehicles/[id]`.

## Subscription / Billing — ❌ missing
- **Web:** plan, invoices, packages.
- **Mobile:** none (`GET /api/v1/packages` exists).
- **API needed:** `GET /api/v1/subscription` (current plan + invoices); reuse `/packages`.
- Likely **P3** (admin-only, rarely used on mobile).

## Notifications — 🟡 partial
- **Web:** list + **log** (`notifications/log`).
- **Mobile:** `notifications_screen.dart`; v1 `GET /notifications`, `fcm-token`.
- **Gap:** notification **log/history** view; mark-all-read.

## Branch / Module requests — ❌ missing
- **Web:** `branch-requests`, `module-requests` admin flows.
- **Mobile:** none. **P3.**

## Agent dashboard — 🟡
- Web has agent-specific dashboard; mobile dashboard should branch by role (the v1 dashboard already scopes by agent). Verify the mobile dashboard shows agent-appropriate cards.

> Items here are mostly **P2–P3**; KYC review and vehicle create are the highest-value.
