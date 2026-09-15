# 🚗 Auto Finance Module: Comprehensive Gap Analysis & Execution Blueprint

This document compares the requirements and UI/UX flows defined in `docs/UI_UX & Feature Specification Blueprint_ Auto Finance System.pdf` against our existing **Auto Finance Module** across the Web Dashboard (`app/(dashboard)/[module]/loans`, `/vehicles`), the Mobile Field App (`mobile/lib/features/loans`), and the Database Schema (`prisma/schema.prisma`).

---

## 📊 Executive Summary & Readiness Matrix

| Section / Blueprint Module | Current Implementation Level | Key Gaps Identified | Priority |
| :--- | :--- | :--- | :--- |
| **1. Global UI & Navigation** | 🟢 **Near Complete (85%)** | Quick actions menu lacks a dedicated **Day Closing trigger** badge/modal directly in the top bar. | Medium |
| **2. Auth & User Management** | 🟢 **Near Complete (90%)** | `Collection Agent` role constraint restricts UI, but fine-grained **Login Time Window** (`startTime` - `endTime`) validation is missing. | Medium |
| **3. Dashboard Interfaces** | 🟡 **Partial (60%)** | Lacks dedicated **"Today's Due List"** action modal, **"Promised Customers"** widget from Call Logs, and **Day Closing** gate/trigger button. | 🔥 High |
| **4. Loan Origination Wizard** | 🟡 **Partial (55%)** | Vehicle capture is split into a separate `/vehicles` page rather than an inline **4-Step HP Ledger Create Wizard**; missing Broker/Dealer dropdowns & insurance charges in loan form. | 🔥 High |
| **5. Search & Universal Filter** | 🟡 **Partial (70%)** | Universal directory has search (`q`) and filters (`status`), but lacks multi-parameter permutation panel (Active/Closed/Seized × 2-Wheeler/4-Wheeler × Dealer × Broker) and Grid/List toggle. | Medium |
| **6. Customer 360° Profile** | 🟡 **Partial (65%)** | Loan detail has timeline and Nach Panel, but lacks **Tabbed Navigation** (Due Chart / Guarantors / Asset Photos / Prints) and **Dynamic Split-Row Due Chart** for partial payments. | 🔥 High |
| **7. Payment & Settlements** | 🟡 **Partial (70%)** | Receipt modal works, but lacks automatic **Bulk Amount Allocation** (oldest overdue first + auto-clearing penalties + remainder to upcoming dues) and digital SMS bill trigger. | 🔥 High |
| **8. Recovery & Asset Mgt** | 🔴 **Needs Work (40%)** | Only tracks `repoFlag: Boolean` on `Vehicle`. Lacks dedicated **Seize Modal** (yard location, seizing charges, agent) & **Release Modal** (moves charges to Hand Loan ledger). | 🔥 High |
| **9. Pending Lists & Reports** | 🟡 **Partial (65%)** | Has report builders, but missing dedicated **Pending Task Manager** sub-tabs (Missing Photos/RC/IDs, GPS, Termination Accounts, Non-Transaction Months 6-12m). | Medium |
| **10. Mobile Field App** | 🟢 **Strong (80%)** | Has `loans_screen.dart`, `loan_detail_screen.dart`, and GPS pings, but needs **Route/Area Manager** customer list screen and instant **Put Bill (Receipt)** input right on the profile header. | Medium |

---

## 🔍 Detailed Section-by-Section Gap Analysis

### 1. Global UI Elements & Navigation
* **Blueprint Requirement:** Top/Side Navigation Bar with links to Dashboards, Masters, Pending List, Accounts, EMI Receipt/Settlement, Reports. Quick Actions Menu with universal search bar, **Day Closing trigger**, and Notifications (Reminders).
* **Current State:** Our top bar and sidebar (`app/(dashboard)/[module]/layout.tsx`) dynamically render module links and notification badges (`SystemNotification`).
* **Gap:** The **Quick Actions Menu** lacks a direct **"Day Closing Trigger"** action or status badge warning agents when daily ledgers must be finalized.
* **Action Required:**
  1. Add a **Day Closing Status Badge & Quick Trigger Modal** (`/api/v1/operations/day-close`) in the top navigation bar when `appType === 'autofinance'`.

---

### 2. Authentication & User Management (`Masters -> Users`)
* **Blueprint Requirement:** Login Screen & User Creation Form with role dropdown (`Super Admin`, `Office Staff`, `Collection Agent`), multi-branch access checkboxes, and **Allowed Login Time Window (Start Time - End Time)**.
* **Current State:** `model User` has `role` (`superadmin`, `admin`, `agent`, `staff`) and `UserBranchModule` handles multi-branch mapping.
* **Gap:** There is no schema or authentication guard for **Allowed Login Time Window (`allowedLoginStart: String?`, `allowedLoginEnd: String?`)** on `User`.
* **Action Required:**
  1. Add `allowedLoginStart String?` and `allowedLoginEnd String?` (or `Time` fields) to `model User` inside `prisma/schema.prisma`.
  2. Enforce time-window checks in `lib/api/v1-auth.ts` (`requireMobileContext`) and login server actions for collection agents (`role === 'agent'`).

---

### 3. Dashboard Interfaces (Super Admin vs. Staff/Admin)
* **Blueprint Requirement:**
  * **Super Admin:** KPI Cards (`Active Loans`, `Closed Loans`, `Seized Vehicles`, `Total Principal Balance`, `Cash in Hand`, `Fixed Deposits`). Middle row Today's Operations (`Loans Disposed`, `Settlement Received`, `Interest Received`, `P&L Today`). Graphical widgets (`Month-over-Month Principal vs. Interest collection flow`).
  * **Staff/Admin:** Operational dashboard with **"Today's Due List"** widget (clickable opening modal to view ledger, trigger call, add remark), **"Promised Customers"** widget (from Call History logs), **EMI Calculator widget**, and **"Day Closing" Button** which blocks next day's pending list view until end-of-day ledgers are processed.
* **Current State:** `app/(dashboard)/[module]/page.tsx` renders basic KPI cards and recent loans/collections.
* **Gap:**
  * No dedicated **Today's Due List modal** with quick-action triggers (`Call`, `Remark`, `Ledger`).
  * No **Promised Customers widget** querying promise-to-pay (`PTP`) dates from call logs.
  * No interactive **EMI Calculator utility widget** on the dashboard.
  * No mandatory **Day Closing Gate/Action** on the staff dashboard.
* **Action Required:**
  1. Build `TodayDueListWidget.tsx` and `PromisedCustomersWidget.tsx` on the dashboard.
  2. Implement `EmiCalculatorModal.tsx` accessible directly from the dashboard quick action toolbar.
  3. Create `model DayClosingLog` to track daily reconciliation and gate staff from viewing next-day pending lists before closing.

---

### 4. Loan Origination Flow (HP Ledger Create Wizard)
* **Blueprint Requirement:** Multi-step form wizard for new Hire Purchase (HP) vehicle loans:
  * **Step 1 (Basic & Vehicle Details):** Customer Name, Mobile, Address, Vehicle Number, Geo-Code map link. File Uploaders: Customer Photo, RC Book PDF/Image, Vehicle Photo.
  * **Step 2 (Financial Configuration):** Vehicle Value (₹), Down Payment (₹), Loan Amount (₹), Interest Rate (flat/diminishing toggle), Issue Date, First Due Date, Tenure months. Auto-Calculated Principal, Interest, Monthly EMI + **"Round off EMI amount"** checkbox.
  * **Step 3 (Charges, Penalties & Payouts):** Grace Period (days), Penalty Amount Per Day (₹), Hand Loan / Extra Charges (for insurance/RTO), **Broker Name & Dealer Name Dropdowns**, Payment Splitter (Mode 1 + Amount, Mode 2 + Amount), Document Charges, Broker Commission.
  * **Step 4 (Guarantor Details):** Guarantors 1, 2, 3 (Names, Phone, Aadhaar). **Auto-check logic** displaying any existing loans/defaults linked to the entered Aadhaar.
* **Current State:**
  * `LoanForm.tsx` currently captures generic loans or ProductFinanceItems (`category, productName, brand, modelNo, serialNo, dealerName`).
  * For auto finance (`appType === 'autofinance'`), vehicle capture (`registrationNo, chassisNo, engineNo, rcDocPath, vehicleType`) is currently isolated in `/vehicles/new/VehicleForm.tsx`.
* **Gap:**
  * Lacks a unified **4-Step HP Origination Wizard** in `LoanForm.tsx` when `appType === 'autofinance'`.
  * Missing fields: `brokerId`, `dealerId`, `insuranceCharge`, `documentCharge`, `brokerCommission`, and **Guarantor Aadhaar auto-check warning logic**.
* **Action Required:**
  1. Add `brokerId String?`, `dealerId String?`, `insuranceCharge Decimal?`, `documentCharge Decimal?`, and `brokerCommission Decimal?` to `model Loan`.
  2. Implement a step-by-step wizard in `app/(dashboard)/[module]/loans/new/LoanForm.tsx` specific to `autofinance` that embeds Vehicle details + Guarantor check in one unified transaction (`prisma.$transaction`).
  3. Build an API endpoint `/api/guarantors/check-aadhar` to warn agents instantly if a guarantor Aadhaar has linked NPA/default loans.

---

### 5. Search & Universal Filter Page (`Universal Directory`)
* **Blueprint Requirement:** Universal directory with partial search bar (`Account No`, `Name`, `Mobile No`, or `Vehicle No`). Filter panel supporting 72+ permutations (`Active`, `Closed`, `Seized`, `Vehicle Type: 2W/4W`, `Dealer Name`, `Broker Name`). View toggles (`Grid Card View` vs. `List Table View`).
* **Current State:** `app/(dashboard)/[module]/loans/page.tsx` supports search (`q`) and status tabs (`active`, `closed`, `npa`).
* **Gap:** Missing multi-attribute permutation filter panel (filtering by `Vehicle Type`, `Dealer`, `Broker`, `Seized status`) and the **Grid vs. List view toggle**.
* **Action Required:**
  1. Expand `loans/page.tsx` search query to match `vehicle.registrationNo`.
  2. Add a comprehensive `FilterPanel.tsx` component allowing combined filtering across `status`, `vehicleType`, `dealerId`, and `brokerId`.
  3. Add a stateful toggle (`viewMode: 'table' | 'grid'`) in the loans directory.

---

### 6. Customer 360° Profile (`Single View Interface`)
* **Blueprint Requirement:** Header Panel (`Name`, `Loan Number`, `Vehicle Number`, Status Badge). Quick Action Toolbar (`Receipt`, `Edit Details`, `Settlement`, `Re-Loan`, `Seize Vehicle`, `SMS/Call`). **Tabbed Navigation:**
  * **Tab 1: Ledger/Due Chart (Default):** Table with columns `Due Date`, `Receipt No`, `Paid Date`, `Principal`, `Interest`, `Penalty`, `Balance`. Color coding: **Red Row** (Overdue), **Green Row** (Upcoming), **White Row** (Paid). **Dynamic Split-Rows:** If partial payment is made, the UI automatically splits that month's row into two (`one White for paid amount`, `one Red for remaining balance`).
  * **Tab 2: Guarantor Info:** Photos & contact details of all linked guarantors.
  * **Tab 3: Asset Photos:** Vehicle photos & RC book viewer.
  * **Tab 4: Documents & Prints:** One-click generation/printing of **Legal Ledger Sheet**, **Due Card (Pocket Card)**, **Seizing Letter**, and **NOC**.
* **Current State:** `LoanDetailClient.tsx` has a clean header and Nach panel, but renders instalments in a standard flat table.
* **Gap:**
  * Instalment table lacks **Dynamic Partial Payment Row-Splitting** (`White` paid split + `Red` remaining balance split).
  * Lacks dedicated tabs for **Asset Photos** and **Documents/Prints** (Pocket Card, Legal Ledger, NOC, Seizing Letter).
* **Action Required:**
  1. Upgrade `LoanDetailClient.tsx` with 4 distinct tabs (`Ledger Chart`, `Guarantors`, `Asset Photos`, `Documents & Prints`).
  2. Implement the **Dynamic Split-Row logic** in `LoanScheduleTable.tsx`: when an `Instalment` row has `paidAmount > 0 && paidAmount < totalInstalment`, split visually into a completed white sub-row and an overdue red sub-row for the balance.
  3. Create PDF/HTML print templates for `Due Card (Pocket Card)` and `Seizing Letter`.

---

### 7. Payment Gateway & Collections (`EMI Receipt` & `Settlement Modal`)
* **Blueprint Requirement:**
  * **EMI Receipt Form Modal:** Inputs: `Amount Paid (₹)`. System auto-fills accrued penalty. Admin can override/zero-out penalty field. **Bulk Amount Allocation Logic:** Submitting a bulk amount (e.g. ₹10,000) automatically allocates funds to the **oldest overdue rows first**, clears penalties, and applies remainder to upcoming dues. Generates printable/SMS Digital Bill.
  * **Settlement & Account Closure Modal:** Displays `Total Principal Due + Total Interest Due + Total Penalty Due = Final Settlement Amount`. Editable fields for flat discounts on Interest or Penalty before closure. Action: `[Close Account]` or `[Convert to Re-Loan]`.
* **Current State:** `recordLoanPayment` (`lib/loans/actions.ts`) processes payments, and `forecloseLoan` handles closures with `foreclosureDiscount`.
* **Gap:**
  * Receipt collection does not explicitly showcase an interactive **Bulk Allocation Waterfall breakdown** inside the UI modal before confirmation.
  * Lacks a one-click **"Convert to Re-Loan" (Refinance/Rollover)** action button directly in the Settlement modal.
* **Action Required:**
  1. Add a **Waterfall Allocation Preview** to the EMI Receipt modal so agents see exactly which old instalments and penalties will be cleared when typing a bulk amount.
  2. Add a `[Convert to Re-Loan]` action sheet that closes the current loan and pre-populates a new HP Ledger form with the remaining settlement balance.

---

### 8. Recovery & Asset Management (`Seize Vehicle` & `Release Vehicle` Modals)
* **Blueprint Requirement:**
  * **Seize Vehicle Modal:** Inputs: `Date of Seize`, `Seized By (Agent Dropdown)`, `Godown/Yard Location`, `Seizing Charges (₹)`, `Remarks`. Action: Submitting changes global account status to **`"Seized"` (Red badge)**.
  * **Release Vehicle Modal:** Triggers a receipt form to collect `Seizing Charges` (moves charges to `Hand Loan` / extra charges ledger) and reverts status to `Active`.
* **Current State:** `model Vehicle` currently only tracks simple flags: `repoFlag: Boolean`, `repoFlaggedAt: DateTime?`, `repoFlaggedById: String?`.
* **Gap:**
  * Missing yard/godown storage location, seizing agent tracking, and itemized **Seizing Charges (₹)** in the database schema.
  * No dedicated **Seize Vehicle Modal** & **Release Vehicle Workflow** linking recovery costs to the loan ledger.
* **Action Required:**
  1. Create `model VehicleRecovery` (or add fields to `Vehicle`):
     ```prisma
     model VehicleRecovery {
       id             String   @id @default(cuid())
       tenantId       String   @map("tenant_id")
       vehicleId      String   @map("vehicle_id")
       loanId         String   @map("loan_id")
       seizedAt       DateTime @map("seized_at")
       seizedById     String   @map("seized_by_id")
       yardLocation   String   @map("yard_location")
       seizingCharges Decimal  @map("seizing_charges") @db.Decimal(12, 2)
       remarks        String?  @db.Text
       status         String   @default("seized") // 'seized' | 'released'
       releasedAt     DateTime? @map("released_at")
       releaseReceiptId String? @map("release_receipt_id")
     }
     ```
  2. Build `SeizeVehicleModal.tsx` and `ReleaseVehicleModal.tsx` inside the Customer 360° Profile toolbar.
  3. Ensure vehicle seizure sets `Loan.status = 'seized'` and visualizes a bold red header badge.

---

### 9. Pending Lists & Reports
* **Blueprint Requirement:**
  * **Pending Task Manager:** Sub-tabs for `Missing Photos`, `Missing Gov IDs / RC Book`, `Missing GPS Locations`, and `Termination Accounts (Tenure over, balance remains)`. Filter engine: `Date ranges`, `Due ranges (5th to 10th)`, `Non-Transaction Months (No payments in 6-12 months)`. Export Options: `CSV`, `PDF`, `Print`.
  * **Report Center:** `Bill Report` (all receipts with cancelled bills greyed/struck through), `HP & Collection Graph` (Monthly Bar/Line chart of Disbursements vs. Collections), `HP Balance Sheet` (exact Principal, Interest, Penalty balances per customer), `Auditor Exports`.
* **Current State:** `lib/reports/builders/disbursement.ts` and `cash-flow.ts` exist.
* **Gap:** No unified **Pending Task Manager (`/pending-tasks`)** page with those exact 4 sub-tabs and non-transaction inactivity filtering (`6-12 months`).
* **Action Required:**
  1. Build `app/(dashboard)/[module]/pending-tasks/page.tsx` with queries identifying:
     - Loans missing `rcDocPath` or customer photos.
     - Loans past their `endDate` with `totalPayable > totalCollected` (Termination Accounts).
     - Loans with zero payment entries in the last 6+ months (`Non-Transaction Months`).

---

### 10. Mobile Field Collection App (`Android/iOS`)
* **Blueprint Requirement:**
  * **Screen 1 (Login & Home):** Large search bar optimized for partial vehicle number entry at traffic signals.
  * **Screen 2 (Route/Area Manager):** List of assigned geographical areas (`"100 Feet Road"`). Clicking opens default customers in that route.
  * **Screen 3 (Customer Mobile Profile):** Customer Name, Photo, Balance, Last Paid Date. Action Icons: `[Phone Icon]` (Call), `[WhatsApp Icon]` (Chat). Forms/Actions: `Tag GPS` (save phone coordinates), `Add Remark` (notes + next promise date picker), **`Put Bill (Receipt)`** (input field for Cash Collected -> Submit, syncs immediately), and `View Ledger` (mobile-optimized Red/Green/White Due Chart).
* **Current State:**
  * `mobile/lib/features/loans/loan_detail_screen.dart` and `new_loan_screen.dart` provide rich features.
  * GPS pinging and offline/sync (`dio_client.dart`) are implemented.
* **Gap:**
  * Lacks a dedicated **Route/Area Manager screen (`route_customers_screen.dart`)** grouping active loans by collection area.
  * The header needs quick-tap **Phone / WhatsApp icons** and a dedicated instant **"Put Bill (Quick Receipt)" inline card** directly on `loan_detail_screen.dart`.
* **Action Required:**
  1. Build `mobile/lib/features/loans/route_customers_screen.dart` grouped by `loan.customer.route.name`.
  2. Add **Quick Put Bill (Receipt)** widget and direct `url_launcher` triggers (`tel:` and `https://wa.me/`) to the top card of `loan_detail_screen.dart`.

---

## 🚀 Recommended Execution Roadmap

1. **Phase 1: Schema & Backend Foundation (Prisma + Server Actions)**
   - Add `VehicleRecovery` table for seizure/release tracking (`yardLocation`, `seizingCharges`, `seizedById`).
   - Add `brokerId`, `dealerId`, `insuranceCharge`, `documentCharge`, `brokerCommission` to `model Loan`.
   - Add `allowedLoginStart`, `allowedLoginEnd` to `model User`.
2. **Phase 2: Loan Origination Wizard & Customer 360° Upgrade**
   - Refactor `LoanForm.tsx` (`autofinance`) into the 4-Step HP Ledger Create Wizard.
   - Upgrade `LoanDetailClient.tsx` with 4 tabs and Dynamic Split-Row Due Chart (`Red` / `Green` / `White`).
   - Build `SeizeVehicleModal.tsx` and `ReleaseVehicleModal.tsx`.
3. **Phase 3: Dashboard & Pending Task Manager**
   - Build `TodayDueListWidget`, `PromisedCustomersWidget`, and `EmiCalculatorModal` on the staff dashboard.
   - Build `/pending-tasks` page with tabs for `Missing RC/Photos`, `Termination Accounts`, and `Non-Transaction 6-12m`.
4. **Phase 4: Mobile Field App Polish (`loans`)**
   - Implement `route_customers_screen.dart` and the **Quick Put Bill** inline card on `loan_detail_screen.dart`.
