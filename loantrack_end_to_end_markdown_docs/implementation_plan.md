# Implementation Plan — Tenant Subscription-based Foreclosure Add-on Module

Implement a secure, robust, and subscription-gated **Foreclosure / Early Settlement** feature for **LoanTrack**, allowing admins to preview calculations, apply discretionary discounts, settle outstanding penalties, waive future payments, return security cheques, and download professional settlement letter PDFs.

This feature is designed as a premium developer-controlled **SaaS Tenant Subscription Add-on**, mirroring the established architecture of `receiptPdfAllowed` and `npaEnabled`.

---

## User Review Required

> [!IMPORTANT]
> **Subscription Gating Strategy:** We are introducing a new database column `foreclosureEnabled` to the `TenantSubscription` model. This allows developers to activate this specific feature on a per-tenant/per-subscription basis. 
> 
> **Coexistence of Preclose & Foreclosure:** The codebase currently has a simple `precloseLoanAdmin` action which collects a lump sum and waives the rest. The new Foreclosure module adds comprehensive live-breakdowns, accrued penalties calculation, settlement discounts, and a formal **Settlement Letter PDF**. We will gate the new **Early Settlement** button under the `foreclosureEnabled` flag. The old preclose button will remain or can be phased out depending on configuration.

---

## Open Questions

> [!NOTE]
> 1. **Default State:** By default, new tenants and existing trial subscriptions will have `foreclosureEnabled = false`. Developers can explicitly toggle it to `true` from the developer billing portal (`/admin/billing/[tenantId]`).
> 2. **Library Dependency:** The Settlement Letter PDF uses `@react-pdf/renderer` for high-quality, lightweight server-side rendering, which is already installed and used for receipt PDFs in the codebase.

---

## Proposed Changes

### 1. Schema Updates

#### [MODIFY] [schema.prisma](file:///v:/pers/Freelance/loanapp/prisma/schema.prisma)
- Add premium add-on field to `TenantSubscription`:
  ```prisma
  foreclosureEnabled Boolean @default(false) @map("foreclosure_enabled")
  ```
- Add the foreclosure tracking fields to `Loan` to track historical audits:
  ```prisma
  closureType       String?           @map("closure_type") // 'normal' | 'foreclosure' | 'written_off'
  foreclosureAmount Decimal?          @map("foreclosure_amount") @db.Decimal(12, 2)
  foreclosureDiscount Decimal?        @map("foreclosure_discount") @db.Decimal(12, 2)
  foreclosureById   String?           @map("foreclosure_by_id")
  ```
- Establish User-Loan relation for approval tracking:
  - Add to `User`: `foreclosedLoans Loan[] @relation("LoanForecloser")`
  - Add to `Loan`: `foreclosedBy User? @relation("LoanForecloser", fields: [foreclosureById], references: [id])`

---

### 2. Live Calculation Engine (Core)

#### [NEW] [foreclosure.ts](file:///v:/pers/Freelance/loanapp/lib/foreclosure.ts)
- Implement `calculateForeclosure(loanId: string, tenantId: string, discount: number)` which:
  - Fetches the loan, instalments, and penalties safely within the tenant scope.
  - Caches and calculates paid instalments, outstanding principal, gross/net penalties due, and caps any discretionary discount.
  - Produces formatted line items for UI display.
  - Returns `canForeclose: boolean` with clear validation rules (e.g. loan must be active/overdue, not already closed).

---

### 3. API Endpoints (Gated)

#### [NEW] [route.ts](file:///v:/pers/Freelance/loanapp/app/api/loans/[id]/foreclosure-calc/route.ts)
- Live calculations preview API:
  - Authenticate using `requireApiContext(['admin', 'superadmin', 'developer'])`.
  - Fetch subscription and assert `sub.foreclosureEnabled === true`. Return `403 Forbidden` if missing.
  - Calculate using the engine and return the JSON response.

#### [NEW] [route.ts](file:///v:/pers/Freelance/loanapp/app/api/loans/[id]/settlement-letter/route.ts)
- Live PDF download endpoint:
  - Verify API context and validate role (Admin+).
  - Verify subscription has `foreclosureEnabled === true`.
  - Render `SettlementLetterPDF` using `@react-pdf/renderer` inside `renderToBuffer` and stream it as an attachment (`settlement-LNXXXX.pdf`).

---

### 4. React-PDF Settlement Layout

#### [NEW] [settlementLetter.tsx](file:///v:/pers/Freelance/loanapp/lib/settlementLetter.tsx)
- Build a beautiful, professional, and compact double-column layout for the loan closure letter.
- Displays:
  - Lender header and branding details (dynamically loaded via tenant settings).
  - Addressee customer details.
  - Comprehensive itemized table (Original Principal, Collected to Date, Net Accrued Penalty, Applied Discount, and Final Settle Amount).
  - Signatures, stamp spaces, and borrower acknowledgement lines.
  - Gated using tenant-specific currency formatting.

---

### 5. Server Actions

#### [MODIFY] [actions.ts](file:///v:/pers/Freelance/loanapp/app/(dashboard)/[module]/loans/[id]/actions.ts)
- Add `forecloseLoan(formData: FormData)` server action:
  - Authenticate the session and verify role (agent role prohibited).
  - Check the subscription:
    ```ts
    const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
    if (!sub || !sub.foreclosureEnabled) {
      return { success: false, error: 'Foreclosure add-on is not active under your plan subscription.' };
    }
    ```
  - Perform calculations safely.
  - Run database transaction:
    1. Update `Loan` status to `closed`, update `closedAt`, `closureType`, `foreclosureAmount`, `foreclosureDiscount`, and `foreclosureById`.
    2. Waive remaining upcoming instalments (status → `waived`).
    3. Settle all pending penalties.
    4. Optionally mark active security cheques as returned if the admin confirms.
    5. Log detailed parameters to `AuditLog`.
  - Trigger SMS / WhatsApp loan closed notification using `notifyLoanClosed`.
  - Revalidate related cache paths.

---

### 6. UI & Dashboard Alignment

#### [MODIFY] [page.tsx](file:///v:/pers/Freelance/loanapp/app/(dashboard)/[module]/loans/[id]/page.tsx)
- Fetch `foreclosureEnabled = sub?.foreclosureEnabled || false` and pass it down as a prop to `LoanDetailClient`.

#### [MODIFY] [LoanDetailClient.tsx](file:///v:/pers/Freelance/loanapp/app/(dashboard)/[module]/loans/[id]/LoanDetailClient.tsx)
- Receive the `foreclosureEnabled` prop.
- Render the secondary "Early Settlement" button in the admin actions panel ONLY when `foreclosureEnabled` is true, and the loan is `active` or `overdue`.
- Build the beautiful interactive Foreclosure Modal:
  - Fetches calculations from preview API.
  - Displays interactive live discount fields, caps the maximum allowed discount, displays security cheque return confirmation checklists, and alerts on the irreversible nature of the waiver.
  - Links directly to the Preview PDF route.

---

### 7. Developer Subscription Control Panel

#### [MODIFY] [SubscriptionForm.tsx](file:///v:/pers/Freelance/loanapp/app/admin/billing/[tenantId]/SubscriptionForm.tsx)
- Add a new add-on toggle switch inside the form:
  ```tsx
  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
    <input
      type="checkbox"
      name="foreclosureEnabled"
      value="true"
      defaultChecked={subscription?.foreclosureEnabled || false}
    />
    Allow Foreclosure & Early Settlement (Settlement Letters, Discretionary Discounts)
  </label>
  ```

#### [MODIFY] [billingActions.ts](file:///v:/pers/Freelance/loanapp/app/admin/billing/billingActions.ts)
- Parse `foreclosureEnabled = formData.get('foreclosureEnabled') === 'true'` and update the database subscription record.

---

### 8. Internationalization (i18n)

#### [MODIFY] [en.ts](file:///v:/pers/Freelance/loanapp/i18n/en.ts), [ta.ts](file:///v:/pers/Freelance/loanapp/i18n/ta.ts), [hi.ts](file:///v:/pers/Freelance/loanapp/i18n/hi.ts)
- Add dictionaries translation support under `loanDetail` keys:
  ```ts
  earlySettlement: 'Early Settlement',
  foreclose: 'Confirm Early Settlement',
  settlementDiscount: 'Settlement Discount',
  settlementAmount: 'Total Settlement Amount',
  remainingWaived: 'remaining instalments will be waived',
  settlementNotes: 'Reason / Notes',
  previewLetter: 'Preview Letter',
  foreclosureWarning: 'This action is irreversible.',
  ```

---

## Verification Plan

### Automated Tests
1. **Schema Check:** Run `npx prisma db push` or `prisma migrate` to apply new fields. Verify schema validation passes.
2. **Compile-time Check:** Run `npm run build` to verify Next.js builds flawlessly without typescript errors.

### Manual Verification
1. **Developer Billing Control:** Log in as developer, visit `/admin/billing/[tenantId]`. Turn **ON** the "Allow Foreclosure & Early Settlement" toggle and save.
2. **Feature Access:** Go to an active loan detail page, verify the "Early Settlement" button appears.
3. **Calculation Preview:** Click "Early Settlement", enter a discount, verify live updates.
4. **PDF Letter Generation:** Click "Preview Letter" to view the generated PDF settlement letter.
5. **Execution:** Confirm settlement, verify loan updates to `closed` with waved instalments, settled penalties, and active cheques returned. Verify audit logs.
6. **Feature Lockout:** Go back to the developer billing page, turn **OFF** the toggle, save, and verify that all foreclosure routes and buttons are blocked.
