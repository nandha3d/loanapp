# i18n Translation Audit — LoanTrack
**Date:** May 2026 | **Languages:** English (en), Tamil (ta), Hindi (hi)

---

## Summary

Out of **49 TSX files** in the app, only **7 files** actually use the `dict` translation system. The remaining **42 files are 100% hardcoded English**. The i18n dictionary (`en.ts / ta.ts / hi.ts`) covers only 6 content sections but the app has ~14 distinct pages/modules.

| Status | Count | Files |
|---|---|---|
| ✅ Translated (uses `dict`) | 7 | dashboard, collection, loan form, loan edit form, customer form, sidebar, topbar |
| ❌ Hardcoded English | 42 | Everything else |

---

## Page-by-Page Status

### ✅ Fully Translated Pages
| Page | Dict Keys Used |
|---|---|
| `/dashboard` | `dict.dashboard.*` |
| `/collection` (CollectionClient) | `dict.collection.*` |
| `/loans/new` (LoanForm) | `dict.loans.*`, `dict.creditInsights.*` |
| `/loans/[id]/edit` (LoanEditForm) | `dict.loans.*` |
| `/customers/new` (CustomerForm) | `dict.customers.*` |
| Sidebar | `dict.sidebar.*`, `dict.roles.*` |
| Topbar | `dict.sidebar.*`, `dict.customers.*`, `dict.loans.*` |

---

### ❌ Pages with Zero Translation (Hardcoded English)

#### `/loans/[id]` — LoanDetailClient.tsx (43,844 bytes — largest file)
Hardcoded strings found:
`ACTIVITY TRACKER`, `Bank Transfer`, `Cancel`, `Cash`, `Cheque`, `Collected`, `Date`, `Disbursed`, `Frequency`, `Missed Days`, `Net Due`, `No cheques registered`, `No data`, `Notes`, `Outstanding`, `Payment Mode`, `Principal`, `Received`, `Renew`, `Repayable`, `Settle`, `Start Date`, `Status`, `Tenure`, `Time`, `Total Penalty`, `Waive`

#### `/settings` — SettingsClient.tsx (**67 hardcoded labels** — worst offender)
`Actions`, `Administrator`, `All dates and times use this timezone`, `Allow Weekend Collection`, `App Name`, `Assign`, `Assign Agent`, `Auto-mark unpaid instalments at midnight`, `Cancel`, `Create Package`, `Create Route`, `Create User`, `Currency`, `Currency Symbol`, `Customers`, `Daily`, `Deactivate`, `Deduction`, `Deduction Amount`, `Deduction Type`, `Delete`, `Disabled`, `Display name shown in the header`, `Edit`, `Enable collection entries on Saturdays and Sundays`, `Enabled`, `Field Agent`, `Frequency`, `Full Name`, `Loan Packages`, `Midnight Cutoff`, `Monthly`, `No Agent`, `Package Name`, `Password`, `Penalty Config`, `Penalty Rate`, `Per Instalment`, `Phone`, `Primary Agent`, `Routes`, `Save`, `Timezone`, `Users`, `Weekly`, `+ Add User`, `+ Create Package`, `+ Create Route`

#### `/reports` — ReportsClient.tsx (27 hardcoded labels)
`Accrued`, `Agent`, `Aging Bucket`, `All Agents`, `All Routes`, `Apply`, `Collected`, `Collection Progress`, `Count`, `Customers`, `Efficiency`, `Expected`, `Hit Rate`, `New Loans This Period`, `No agents found`, `Performance`, `Route`, `Settled`, `This Month`, `This Week`, `Today`, `Total Penalty`, `Total Principal Out`, `Waived`

#### `/penalties` — PenaltiesClient.tsx (27 hardcoded labels)
`Action`, `All Routes`, `All Status`, `Cancel`, `Clear`, `Customer`, `Enforce Full Penalty`, `Filter`, `Gross Penalty`, `Loan ID`, `Missed Days`, `Net Outstanding`, `Partial`, `Partial Settlement`, `Pending`, `Remarks / Notes`, `Route`, `Settled`, `Status`, `Total Gross Penalty`, `Total Settled`, `Total Waived`, `Waive Entirely`, `Waived`

#### `/customers` (list page) — page.tsx (19 hardcoded labels)
`Actions`, `Active`, `Active Loan`, `All Routes`, `All Status`, `Blacklisted`, `Clear`, `Closed`, `Customer ID`, `Edit`, `Filter`, `Name`, `Overdue`, `Phone`, `Route`, `Score`, `Status`, `View`

#### `/customers/[id]` — CustomerProfileClient.tsx (33 hardcoded labels)
`Aadhaar Number`, `Aadhar Card`, `Action`, `Active / Closed Loans`, `Address`, `Bank Name`, `Cancel`, `Cheque Number`, `Document uploaded via app`, `Frequency`, `Guarantors`, `KYC Documents`, `KYC Status`, `Loan History`, `Loan ID`, `Name`, `Pending`, `Phone`, `Principal`, `Progress`, `Reason for Change`, `Rejected`, `Repayment Consistency`, `Request Customer Edit`, `Security Cheques`, `Start Date`, `Status`, `Total Borrowed`, `Verification Status`, `Verified`, `View`

#### `/loans` (list page) — page.tsx (21 hardcoded labels)
`Action`, `Active`, `All Frequencies`, `All Status`, `Clear`, `Closed`, `Customer`, `Daily`, `Edit`, `Filter`, `Frequency`, `Loan ID`, `Monthly`, `Overdue`, `Principal`, `Progress`, `Settled`, `Start Date`, `Status`, `View`, `Weekly`

#### `/chits` (list page) — page.tsx (18 hardcoded labels)
`Action`, `Active`, `Active Chit Groups`, `All Status`, `Auctions Done`, `Cancelled`, `Chit Value`, `Completed`, `Completed Groups`, `Create First Group`, `Filter`, `Members`, `Monthly`, `Name`, `Start Date`, `Status`, `Total Members`, `View`

#### `/chits/[id]` — ChitGroupDetailClient.tsx (18 hardcoded labels)
`Auctions Completed`, `Cancel`, `Chit Value`, `Customer`, `Date`, `Dividend`, `Due Amount`, `Due Date`, `Member`, `Members Enrolled`, `Monthly Contribution`, `Paid`, `Pending`, `Period`, `Prize`, `Select member`, `Status`, `Winner`

#### `/chits/new` — ChitGroupForm.tsx
`Chit Group Name`, `Chit Value`, `Monthly Contribution`, `Start Date`, `Commission %`, `Create Chit Group`, `Creating...`

#### `/vehicles` (list page) — page.tsx (16 hardcoded labels)
`Action`, `Add First Vehicle`, `All Vehicles`, `Customer`, `Filter`, `Insurance Expiry`, `Loan`, `REPO`, `Registration`, `Repo Flagged`, `Status`, `Total Vehicles`, `Type`, `Vehicle`, `View`

#### `/vehicles/new` — VehicleForm.tsx (14 hardcoded labels)
`Registration No`, `Make / Brand`, `Model`, `Year`, `Color`, `Engine No`, `Chassis No`, `Vehicle Type`, `Insurance Expiry`, `Upload RC Document`, `Upload Insurance`, `Two Wheeler`, `Four Wheeler`, `Save Vehicle`

#### `/vehicles/[id]` — VehicleDetailClient.tsx
`Vehicle Details`, `Registration`, `Make`, `Model`, `Year`, `Color`, `Engine No`, `Chassis No`, `Vehicle Type`, `Insurance Expiry`, `Repo Status`, `Flag for Repo`, `Remove Repo Flag`

#### `/approvals` — ApprovalsClient.tsx (14 hardcoded labels)
`Action`, `Approval Requests`, `Approve & Apply Changes`, `Cancel`, `Changes`, `Date`, `Entity Type`, `Manage agent requests for customer data changes`, `No Requests Found`, `Reject Request`, `Requested By`, `Review`, `Review Notes`, `Status`

#### `/notifications` — NotificationsClient.tsx
Mostly icon-based, but section headers and empty state messages are hardcoded.

#### `/subscription`, `/portal/billing`, `/admin/billing/*`, `/login`
All hardcoded English — these are operational/admin pages but still seen by superadmin users who may prefer Tamil/Hindi.

---

## Dictionary Gaps — Keys in `en.ts` Missing from `ta.ts` / `hi.ts`

| en.ts key | Tamil (ta.ts) | Hindi (hi.ts) |
|---|---|---|
| `customers.title` | ✅ Present | ✅ Present |
| `loans.newLoan` | ✅ Present | ✅ Present |
| All other keys | ✅ Match | ✅ Match |

**Good news:** The existing 6 sections (`dashboard`, `customers`, `sidebar`, `roles`, `loans`, `creditInsights`, `collection`) are **fully consistent** across all 3 languages. No keys are missing or untranslated within the covered sections.

---

## Missing Dictionary Sections (Not in en.ts at all)

These entire modules have no i18n keys defined — they need new sections added to all 3 language files:

| Module | Approx. keys needed |
|---|---|
| `penalties` | ~20 keys |
| `approvals` | ~15 keys |
| `reports` | ~25 keys |
| `settings` | ~50 keys |
| `vehicles` | ~20 keys |
| `chits` | ~25 keys |
| `loanDetail` | ~30 keys |
| `customerProfile` | ~30 keys |
| `loansList` | ~15 keys |
| `customersList` | ~15 keys |
| **Total** | **~245 keys** |

---

## How the Dict System Works (for reference)

The layout (`app/(dashboard)/layout.tsx`) correctly loads `getDictionary(tenantId)` and passes `dict` to `<Sidebar>` and `<Topbar>`. Individual page server components that need translations must:

1. Call `getDictionary(tenantId)` themselves, OR receive `dict` as a prop from their parent page
2. Pass `dict` down to their Client Components

Pages like `dashboard/page.tsx` and `collection/page.tsx` do this correctly. The majority of pages skip step 1 entirely.

---

## Recommended Fix Strategy

**Phase 1 — Add missing dict sections to all 3 language files** (~245 keys across 10 new sections in `en.ts`, `ta.ts`, `hi.ts`)

**Phase 2 — Update each page.tsx** to call `getDictionary(tenantId)` and pass `dict` as prop to its Client Component

**Phase 3 — Replace hardcoded strings in Client Components** with `dict.sectionName.keyName`

Priority order (by user impact):
1. `loanDetail` — highest traffic, most hardcoded strings
2. `customerProfile` — core agent workflow
3. `loansList` + `customersList` — daily views
4. `penalties` + `approvals` — admin daily use
5. `settings` — admin setup (67 labels!)
6. `reports` — management use
7. `chits` + `vehicles` — module-specific
