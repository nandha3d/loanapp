# 01 · Customers

## Web scope
- List with search, status filter, agent/branch scope, pagination.
- Detail: profile, KYC docs/verification (manual upload, Aadhaar OTP, Video KYC), security cheques, guarantors, loans, credit-score gauge (300–850).
- **Create (full):** photo, name, phone, **PAN**, email, Aadhaar, address, route, agent, **company/business details** (companyName, businessType, GST, companyPan, regNo, address, phone, email, designation, monthly income, **company logo**), KYC docs (multi), guarantors (multi w/ photos), security cheques.
- **Edit (full):** same fields; admin direct, agent via approval request.
- Suspend / reset borrower password.

## Mobile current
- List (`customers_screen.dart`), detail (`customer_detail_screen.dart`), create (`new_customer_screen.dart` — name/phone/aadhaar/address/route/agent + KYC docs + guarantors + photo).
- **Edit (basic – NEW this pass):** name/phone/address/aadhaar via PATCH. Route/agent/company/docs hidden in edit (API PATCH doesn't support them).
- Credit score: now canonical 300–850 + grade (parity).
- Suspend/unsuspend works.

## Gaps
1. 🟡 **Create** lacks company/business fields, PAN, email, company logo (web added these recently).
2. 🟡 **Edit** can't change route/agent, company fields, photo, KYC docs, guarantors (PATCH field-limited).
3. ❌ Reset borrower password action.
4. ❌ KYC verification actions (OTP / video) — see [10-kyc-vehicles-misc.md](10-kyc-vehicles-misc.md).
5. 🟡 Security cheques not shown/edited on mobile detail.

## API needed
- Extend `PATCH /api/v1/customers/[id]` field allowlist (`CUSTOMER_UPDATE_FIELDS`) to include `pan, email, companyName, businessType, gstNumber, companyPan, companyRegNo, companyAddress, companyPhone, companyEmail, designation, occupation, monthlyIncome, routeId, agentId` (with validation), so mobile edit reaches parity. *(API-only change.)*
- `POST /api/v1/customers/[id]/reset-password` (admin) for borrower password reset.
- Surface `securityCheques` (already included in detail GET) in the mobile model + UI.

## Acceptance
- Mobile create captures the same fields as web create.
- Mobile edit can update the same fields as web edit (admins); agents create approval requests.
- Score shows identical value/grade to web. ✅ done.
