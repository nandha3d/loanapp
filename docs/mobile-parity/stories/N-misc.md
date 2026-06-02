# N — KYC flows · Subscription · Notification log · Loan statement (mobile)

**Priority:** P2/P3 · grouped smaller stories.

---
## N1 — KYC review: Aadhaar OTP + Video KYC flows (P2)
**Persona:** Admin.
- **Verified:** endpoints `app/api/v1/kyc/queue/route.ts`, `app/api/v1/kyc/[customerId]/review/route.ts`. Mobile `kyc/kyc_review_screen.dart` exists (manual review). Missing: Aadhaar OTP eKYC + Video KYC sub-flows. Web ref: `app/(dashboard)/[module]/customers/[id]/` KYC section + `customerProfile.kyc*` (i18n already translated incl. `sendAadhaarOtp`, `verifyOtp`, `initiateVideoKyc`, `kycMethod_*`).
- **Impl:** the OTP/video flows call Digio-backed endpoints; add Bearer routes mirroring the web KYC actions (send OTP, verify OTP, initiate video, fetch verified details). Mobile: method picker (gated on `kyc_method` setting + subscription), OTP entry, video link launcher, verified-details display.
- **AC:** OTP send/verify round-trips; video link opens; verified Aadhaar name/dob/address shown; premium-gated.

---
## N3 — Notification log (P3)
- Mobile `notifications_screen.dart` lists notifications; web also has `notifications/log`. Add a log screen + endpoint if none (`/api/v1/notifications/log`) showing sent/failed/pending with timestamps. (Tie-in with **J5**.)

---
## N4 — Subscription / Billing view (P2)
**Persona:** Superadmin.
- Web: `app/(dashboard)/[module]/subscription/page.tsx`. Mobile: none. 
- **Impl:** `GET /api/v1/subscription` (plan, status, limits, usage, trialEndsAt, addons) — read from `TenantSubscription`. Screen `subscription_screen.dart` (read-only first). Plan change later (ties to L3).
- **AC:** shows current plan, limits vs usage (active loans/agents/branches), addons, trial/expiry date.

---
## D5 — Loan statement PDF (P2)
**Persona:** Admin/Borrower.
- Web generates a statement PDF (find the web route, e.g. `/api/statements/...` or in loan detail). Mobile has no statement.
- **Impl:** Bearer `GET /api/v1/loans/[id]/statement` returning a PDF (reuse the `@react-pdf/renderer` pattern from `app/api/v1/receipts/[entryId]/route.ts`; copy the statement layout from the web statement component). Mobile: "Statement" button on `loan_detail_screen.dart` → fetch bytes via Dio (`responseType: bytes`) → `Printing.layoutPdf` (same pattern as receipt in `collection_screen.dart`).
- **AC:** statement matches web content; opens in share/print sheet; subscription-gated like receipts.

---
## B — Dashboard polish (P2)
- **B3:** add range filter to the collection trend (call dashboard/analytics endpoint with range param).
- **B4:** defaulter alerts + route performance + recent activity cards (data from `/api/v1/dashboard`).
- **B5:** wire agent greeting/hit-rate/pending-today (i18n keys already added: `dashboard.goodMorning`, `hitRate`, `pendingToday`, etc.).
- **AC:** all numbers from `/api/v1/dashboard`; no Dart math.

## Files touched (per sub-story)
- Respective `app/api/v1/**` (additive) + `mobile/lib/features/**` screen + `app_strings.dart`.
