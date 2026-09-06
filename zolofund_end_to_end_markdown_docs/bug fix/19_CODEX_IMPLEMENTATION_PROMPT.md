# Codex Implementation Prompt — ZoloFund v5

> Feed this file directly to Codex. Each section is a self-contained task with exact file paths, current state, and required output.  
> Work through tasks **in order** — later tasks depend on earlier ones.

---

## TASK 1 — Complete REST API Layer (Headless)

### Context
The app currently has a handful of API routes (`/api/customers`, `/api/loans`, `/api/notifications`). Every page reads data through server components and mutates via server actions. A full REST API layer is needed so the app can be consumed headlessly by mobile clients or third parties.
I am giving you my ideas and also implement if anything missing for the headless.
### Standard response wrapper
`lib/utils.ts` already exports `apiSuccess` and `apiError`. Use them in every route:
```ts
return apiSuccess(data);          // { success: true, data }
return apiError('message', 404);  // { success: false, error: 'message' }
```

### Authentication pattern for all API routes
```ts
const session = await auth();
if (!session?.user) return apiError('Unauthorized', 401);
const role = (session.user as any)?.role;
const tenantId = await getDefaultTenantId();
const appType = await getUserAppType();
```

---

### 1.1 — Create `app/api/instalments/route.ts`
```ts
// GET /api/instalments?loanId=&status=&from=&to=
// Auth: admin, superadmin, developer
// Returns instalments scoped by tenantId + appType, filtered by loanId/status/date range
// Include: loan.loanCode, loan.customer.name
```

### 1.2 — Create `app/api/instalments/[id]/route.ts`
```ts
// GET    /api/instalments/:id  — get single instalment
// PATCH  /api/instalments/:id  — update status (admin only). Body: { status, receivedAmount }
// All operations must verify instalment.loan.tenantId === tenantId
```

### 1.3 — Create `app/api/penalties/route.ts`
```ts
// GET /api/penalties?status=&loanId=&routeId=
// Auth: admin, superadmin, developer (agents blocked)
// Scope by tenantId + appType
// Include: loan.loanCode, loan.customer.name, loan.customer.customerCode
```

### 1.4 — Create `app/api/penalties/[id]/route.ts`
```ts
// GET   /api/penalties/:id
// PATCH /api/penalties/:id — Body: { action: 'settle' | 'waive', settledAmount? }
//   settle: set status='settled', settledAmount, settledAt=now()
//   waive:  set status='waived', settledAmount=0, settledAt=now()
// Write AuditLog for both actions
// Verify penalty.loan.tenantId === tenantId before any mutation
```

### 1.5 — Create `app/api/collection/route.ts`
```ts
// GET  /api/collection?date=&agentId=&routeId=
//   Returns DailyCollection records with CollectionEntry children
//   date defaults to today (YYYY-MM-DD)
//   Scope: tenantId + appType
//   Agent role: scoped to their route IDs via getAgentRouteIds()
// POST /api/collection  — Body: { instalmentId, receivedAmount, paymentMode }
//   Same logic as submitCollectionEntry server action
//   Agent: can only submit; cannot edit or delete
```

### 1.6 — Create `app/api/customers/[id]/route.ts`
```ts
// GET    /api/customers/:id  — full profile: customer + loans + kycDocuments + cheques + guarantors
//   Verify customer.tenantId === tenantId
// PATCH  /api/customers/:id  — admin only, allow-list: ['name','phone','address','aadharNumber','kycStatus']
//   Write AuditLog
// DELETE /api/customers/:id  — admin only, soft delete (set status='inactive')
```

### 1.7 — Create `app/api/loans/[id]/route.ts`
```ts
// GET    /api/loans/:id  — loan + instalments + penalties + collateral
//   Verify loan.tenantId === tenantId
// PATCH  /api/loans/:id  — admin only. Body: { status?, notes?, voucherRef? }
// DELETE /api/loans/:id  — admin only, only if status='pending' (not yet active)
```

### 1.8 — Create `app/api/routes/route.ts`
```ts
// GET  /api/routes  — list all routes for tenant+appType, include assignedAgent name
// POST /api/routes  — admin only. Body: { name, description?, assignedAgentId? }
//   Write AuditLog
```

### 1.9 — Create `app/api/packages/route.ts`
```ts
// GET  /api/packages  — list loan packages for tenant+appType
// POST /api/packages  — admin only. Body: { name, principal, deduction, deductionType, frequency, tenure, penaltyRate }
//   deductionType: 'fixed' | 'percentage'
//   If deductionType === 'percentage', store deduction = Math.round(principal * deductionValue / 100)
//   Write AuditLog
```

### 1.10 — Create `app/api/packages/[id]/route.ts`
```ts
// GET    /api/packages/:id
// PATCH  /api/packages/:id  — admin only
// DELETE /api/packages/:id  — admin only, only if no loans reference this package
//   Check: prisma.loan.count({ where: { packageId: id } }) === 0 before deleting
```

### 1.11 — Create `app/api/dashboard/route.ts`
```ts
// GET /api/dashboard  — admin only
// Returns: { activeLoans, overdueLoans, totalCustomers, todayExpected, todayCollected,
//            pendingPenalties, activeAgents, recentLoans[], todayInstalments }
// Scope by tenantId + appType, branch-scoped for admin role
```

### 1.12 — Create `app/api/reports/route.ts`
```ts
// GET /api/reports?type=collection_efficiency|aging|penalty|disbursement|agent_performance&from=&to=
// Returns the same aggregated data that the reports page computes server-side
// Admin only
```

### 1.13 — Create `app/api/approvals/route.ts`
```ts
// GET  /api/approvals?status=pending|approved|rejected
//   Agent: own requests only (where.requestedById = userId)
//   Admin: all requests for tenant
// POST /api/approvals/:id/review  — admin only. Body: { action: 'approve'|'reject', notes? }
//   Same logic as reviewRequest server action (tenant check + allow-list + audit log)
```

### 1.14 — Create `app/api/settings/route.ts`
```ts
// GET  /api/settings  — returns all AppSetting key-value pairs for tenant (admin only)
// POST /api/settings  — admin only. Body: Record<string, string>
//   Upsert each key. Write AuditLog.
```

### 1.15 — Add `app/api/health/route.ts`
```ts
// GET /api/health  — public, no auth
// Returns: { ok: true, version: '1.0.0', timestamp: new Date().toISOString() }
// Used by uptime monitoring
```

---

## TASK 2 — Fix Broken Links
There are some broken link in the UI and logic, i have found some and also you have to go through the code and check if any broken link or logic is there and fix them.
### 2.1 — Penalty customer link uses wrong ID
**File:** `app/(dashboard)/penalties/PenaltiesClient.tsx` line ~141  
**Current:**
```tsx
<Link href={`/customers/${p.customer.id}`}>{p.customer.name}</Link>
```
**Fix:** Customer profile routes use `customerCode`, not `id`:
```tsx
<Link href={`/customers/${p.customer.customerCode}`}>{p.customer.name}</Link>
```

### 2.2 — Penalty loan link uses ID but loan detail routes on ID — verify
**File:** `app/(dashboard)/penalties/PenaltiesClient.tsx` line ~139  
**Current:** `href={/loans/${p.loan.id}}`  
**Check:** `app/(dashboard)/loans/[id]/page.tsx` — confirm the dynamic segment is `id` (not `loanCode`). If the loans detail page uses `loanCode` as the segment, update the link accordingly.

### 2.3 — Dashboard "View All" links missing
**File:** `app/(dashboard)/dashboard/page.tsx`  
**Find** every KPI card or section that has a count but no link to the full list. Add links:
- Overdue loans count → `href="/loans?status=overdue"`
- Pending penalties count → `href="/penalties?status=pending"`
- Pending approvals count → `href="/approvals?status=pending"`
- Active customers count → `href="/customers"`
- Today's collection summary → `href="/collection"`

### 2.4 — Sidebar subscription link only for superadmin but page restricts to superadmin too
**File:** `components/layout/Sidebar.tsx`  
**Current:** `superadminOnly: true` — correct, but also gate the `/subscription` page for `admin` role in middleware or page-level redirect. Currently `subscription/page.tsx` redirects non-superadmin to `/dashboard`. This is fine — just verify the sidebar item is hidden for `admin` and `agent` roles. If not hidden, wrap with the `superadminOnly` check already present.

### 2.5 — Loan detail "back to loans" breadcrumb
**File:** `app/(dashboard)/loans/[id]/LoanDetailClient.tsx`  
Add breadcrumb link back to `/loans` if not already present:
```tsx
<Link href="/loans" className="btn btn-ghost btn-sm">← Back to Loans</Link>
```

### 2.6 — Customer profile loan rows should link to loan detail
**File:** `app/(dashboard)/customers/[id]/CustomerProfileClient.tsx`  
In the Loans tab, each loan row's `loanCode` should be wrapped in `<Link href={/loans/${loan.id}}>`.

---

## TASK 3 — Remove All Hardcoded Values
I want to remove all hardcoded codes from the codebase.
I have found some and also check if any hardcoded codes are there and fix them.
### 3.1 — Hardcoded `₹` in `customers/page.tsx`
**File:** `app/(dashboard)/customers/page.tsx` line 165  
**Current:** `formatCurrency(Number(activeLoan.principal), '₹')`  
**Fix:** The page is a server component. Fetch `currencySymbol` and pass it down:
```ts
// In the page.tsx server component, add:
const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
// Pass to client component or use directly in JSX
```

### 3.2 — Hardcoded `₹` in `ChitGroupForm.tsx`
**File:** `app/(dashboard)/chits/new/ChitGroupForm.tsx` lines 69, 74  
**Current:** `<label>Chit Value (₹) *</label>`  
**Fix:** `ChitGroupForm` needs to accept `currencySymbol: string` as a prop. Update `chits/new/page.tsx` to fetch and pass it:
```ts
// In chits/new/page.tsx
const currencySymbol = await getSetting(tenantId, 'currency_symbol', '₹');
// Pass as prop: <ChitGroupForm currencySymbol={currencySymbol} ... />
```
In the form: `<label>Chit Value ({currencySymbol}) *</label>`

### 3.3 — `UsersClient.tsx` default appType hardcoded
**File:** `app/admin/users/UsersClient.tsx` lines 13, 23  
**Current:** `useState('microlending')` and `setSelectedAppType('microlending')`  
**Fix:** Pass the current tenant's `appType` as a prop from the server component, use it as the default:
```tsx
// In UsersClient.tsx
export default function UsersClient({ users, defaultAppType }: { users: any[], defaultAppType: string }) {
  const [selectedAppType, setSelectedAppType] = useState(defaultAppType);
```
In `app/admin/users/page.tsx`, fetch and pass `defaultAppType`.

### 3.4 — `portal/billing/page.tsx` plan features hardcoded
**File:** `app/portal/billing/page.tsx` lines 9–12  
**Current:**
```ts
const PLAN_FEATURES = {
  trial: { loans: 50, agents: 3, modules: ['microlending'] },
  basic: { loans: 200, agents: 10, modules: ['microlending', 'autofinance'] },
  ...
};
```
**Fix:** Move this object to `lib/appConfig.ts` or a new `lib/plans.ts` file so it's a single source of truth shared between `portal/billing/page.tsx` and `admin/billing/[tenantId]/page.tsx`:
```ts
// lib/plans.ts
export const PLAN_FEATURES: Record<string, { loans: number; agents: number; modules: string[] }> = {
  trial:      { loans: 50,     agents: 3,   modules: ['microlending'] },
  basic:      { loans: 200,    agents: 10,  modules: ['microlending', 'autofinance'] },
  pro:        { loans: 1000,   agents: 50,  modules: ['microlending', 'autofinance', 'chitfunds'] },
  enterprise: { loans: 999999, agents: 999, modules: ['microlending', 'autofinance', 'chitfunds'] },
};
export const PLAN_LABELS: Record<string, string> = { trial:'Trial', basic:'Basic', pro:'Pro', enterprise:'Enterprise' };
export const MODULE_LABELS: Record<string, string> = { microlending:'Micro Lending', autofinance:'Auto Finance', chitfunds:'Chit Funds' };
```
Import from `lib/plans.ts` in both billing pages.

### 3.5 — `app/(dashboard)/subscription/page.tsx` duplicates PLAN_LABELS and MODULE_LABELS
**Fix:** Replace the local `PLAN_LABELS`, `PLAN_COLORS`, `MODULE_LABELS` constants with imports from `lib/plans.ts` (created in 3.4).

### 3.6 — `vehicles/actions.ts` hardcodes `appType: 'autofinance'`
**File:** `app/(dashboard)/vehicles/actions.ts` line ~140  
**Current:** `appType: 'autofinance'` in `systemNotification.create`  
**Fix:** Fetch `appType` from `getUserAppType()` (already imported in the file) — don't hardcode:
```ts
const appType = await getUserAppType();
// use appType in systemNotification.create
```

### 3.7 — `vehicles/page.tsx` and `vehicles/new/page.tsx` hardcode `appType: 'autofinance'`
**Files:** `app/(dashboard)/vehicles/page.tsx` lines 25, 56, 60; `app/(dashboard)/vehicles/new/page.tsx` lines 10, 15  
**Fix:** Replace every `appType: 'autofinance'` with:
```ts
const appType = await getUserAppType(); // already available in each page
```

---

## TASK 4 — Theme Consistency
I want to make the theme consistent with the variable that we defined. 
### 4.1 — Fix hardcoded hex colors in component files
Search for hardcoded hex colors in TSX files and replace with CSS variables. Key offenders:

**`app/(dashboard)/loans/[id]/LoanDetailClient.tsx`** — any `#dcfce7`, `#166534`, `#fef9c3`, `#854d0e`:
```tsx
// Replace status badge inline styles with CSS classes:
// status === 'closed'  → className="badge badge-active"
// status === 'active'  → className="badge badge-pending"  
// status === 'overdue' → className="badge badge-overdue"
// status === 'pending' → className="badge badge-pending"
```

**`app/(dashboard)/loans/new/LoanForm.tsx`** — same hardcoded badge colors in loan history panel (bottom of the file):
```tsx
// Replace:
background: l.status === 'closed' ? '#dcfce7' : '#fef9c3',
color: l.status === 'closed' ? '#166534' : '#854d0e'
// With CSS variable approach:
className={`badge ${l.status === 'closed' ? 'badge-active' : l.status === 'overdue' ? 'badge-overdue' : 'badge-pending'}`}
```

### 4.2 — Add missing badge CSS classes to `globals.css`
**File:** `app/globals.css`  
Add after the existing badge classes:
```css
.badge-overdue  { background: #FEE2E2; color: #991B1B; }
.badge-missed   { background: #FEE2E2; color: #991B1B; }
.badge-active   { background: #DCFCE7; color: #166534; }
.badge-closed   { background: #E0F2FE; color: #075985; }
.badge-partial  { background: #FEF3C7; color: #92400E; }
.badge-info     { background: #E0F2FE; color: #075985; }
```

### 4.3 — Fix `form-computed` background hardcode
**File:** `app/globals.css` line 131  
**Current:** `.form-computed { background: #F8FAFC; ... }`  
**Fix:** Use a CSS variable so it adapts to any future dark mode:
```css
.form-computed { background: var(--bg); border: 1px dashed var(--border); ... }
```

### 4.4 — Add CSS variables for semantic colors that are used inline
**File:** `app/globals.css` — inside `:root {}`  
Add:
```css
--success: #27AE60;
--success-bg: #DCFCE7;
--warning: #F59E0B;
--warning-bg: #FEF3C7;
--danger: #E74C3C;
--danger-bg: #FEE2E2;
--info: #2980B9;
--info-bg: #E0F2FE;
```
Then replace all inline `background: #FEE2E2; color: #991B1B` etc. with `background: var(--danger-bg); color: var(--danger)`.

### 4.5 — `subscription/page.tsx` uses undefined CSS variable
**File:** `app/(dashboard)/subscription/page.tsx`  
**Current:** `background: 'rgba(var(--success-rgb, 39,174,96), 0.1)'`  
**Fix:** After adding `--success-bg` in 4.4, replace with:
```tsx
background: isEnabled ? 'var(--success-bg)' : 'var(--bg)',
border: `1px solid ${isEnabled ? 'var(--success)' : 'var(--border)'}`,
```

---

## TASK 5 — Mobile Responsiveness
I want to make the app responsive for mobile devices. Also make sure any other mobile responsive issues to be fixed in the codebase.
### 5.1 — Extend media queries in `globals.css`
**File:** `app/globals.css` — expand the existing `@media (max-width: 768px)` block:
```css
@media (max-width: 768px) {
  /* existing rules... */

  /* Tables: make them scroll horizontally with a visual hint */
  .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .table-wrapper::after {
    content: '→ scroll';
    display: block;
    text-align: right;
    font-size: .7rem;
    color: var(--text-light);
    padding: 4px 8px;
  }

  /* Cards: reduce padding on mobile */
  .card { padding: 14px 16px; }

  /* KPI grid: already 1 col but reduce gap */
  .kpi-grid { gap: 10px; }

  /* Filter bar: stack vertically */
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-bar input, .filter-bar select { width: 100%; }

  /* Modal: full width on mobile */
  .modal { width: 100%; max-width: 100vw; border-radius: var(--radius) var(--radius) 0 0; 
           max-height: 85vh; position: fixed; bottom: 0; margin: 0; }
  .modal-overlay { align-items: flex-end; }

  /* Page header: stack title and actions */
  .page-header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .header-actions { width: 100%; }
  .header-actions .btn { width: 100%; justify-content: center; }

  /* Form actions: stack buttons */
  .form-actions { flex-direction: column; }
  .form-actions .btn { width: 100%; justify-content: center; }

  /* Topbar: reduce notification dropdown width */
  .notification-dropdown { width: calc(100vw - 32px); right: -16px; }

  /* Collection page cards */
  .collection-entry { flex-direction: column; gap: 8px; }

  /* grid-60-40 (loan form + credit insight) — already 1 col, but hide credit panel on mobile */
  .grid-60-40 > :last-child { display: none; }
}

/* Extra small devices */
@media (max-width: 480px) {
  html { font-size: 13px; }
  .card { padding: 12px; }
  .btn { padding: 8px 14px; }
  .kpi-value { font-size: 1.25rem; }
}
```

### 5.2 — Add mobile sidebar overlay close
**File:** `components/layout/Sidebar.tsx`  
The sidebar opens/closes via `open` CSS class. Add an overlay div so clicking outside closes it on mobile:
```tsx
// After the closing </aside> tag of the sidebar, add:
{isMobileOpen && (
  <div
    className="sidebar-overlay"
    onClick={() => setIsMobileOpen(false)}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      zIndex: 49, display: 'block'
    }}
  />
)}
```
Add to `globals.css`:
```css
@media (min-width: 769px) { .sidebar-overlay { display: none !important; } }
```

### 5.3 — LoanForm credit insight panel — hide on mobile
Done via CSS in 5.1 (`.grid-60-40 > :last-child { display: none }`). No code change needed.

### 5.4 — Collection page: responsive card layout
**File:** `app/(dashboard)/collection/CollectionClient.tsx`  
The collection list rows use inline flex. Add `className="collection-entry"` to the row container so the CSS rule in 5.1 applies. Each entry should stack: customer name → amount → action button.

---

## TASK 6 — Credit Score Logic Review & Fix
I want you to review the credit score logic in `lib/creditScore.ts` and fix any issues you find.
### Current issues in `lib/creditScore.ts`

**Issue 1:** The `totalPaid` calculation only sums `receivedAmount` for `status === 'paid'` instalments. If an instalment was paid partially (status `partial`), `receivedAmount` is excluded. Fix:
```ts
// Replace:
if (i.status === 'paid') totalPaid += Number(i.receivedAmount);
// With:
if (i.status === 'paid' || i.status === 'partial') totalPaid += Number(i.receivedAmount || 0);
```

**Issue 2:** `totalInstalmentsDue` uses `loan.totalInstalments || loan.tenure`. The `Loan` model only has `tenure` — `totalInstalments` doesn't exist. Fix:
```ts
totalInstalmentsDue += loan.tenure || 0;
```

**Issue 3:** The volume bonus divides by 100,000 which means a ₹1 lakh loan gives 20 points — a first-time borrower with a perfect repayment record but a small loan gets heavily penalised. Cap at 10 points and start bonus earlier:
```ts
// Replace:
const volumeBonus = Math.min(20, (totalBorrowed / 100000) * 20);
// With:
const volumeBonus = Math.min(10, (totalBorrowed / 50000) * 10);
totalPoints += volumeBonus;
// Re-adjust weights: punctuality 55%, completion 35%, volume 10%
totalPoints += punctualityRatio * 55;   // was 50
totalPoints += completionRatio * 35;    // was 30
```

**Issue 4:** Score range maps 0–100 points to 300–850. But after weight adjustments, max points = 100, min = 0. The multiplier should be: `(850 - 300) / 100 = 5.5` — this is correct. No change needed.

**Issue 5:** Grade thresholds don't match the 300–850 range well:
```ts
// Replace grade logic with:
let grade: string;
if (score >= 780)      grade = 'Excellent';
else if (score >= 680) grade = 'Good';
else if (score >= 560) grade = 'Fair';
else if (score >= 440) grade = 'Poor';
else                   grade = 'Very Poor';
```

**Issue 6:** No `N/A` case properly handled — a customer with loans but all pending instalments (no paid/missed) gets score 300 which displays as "Very Poor". Add a check:
```ts
// After calculating totalInstalmentsDue:
const hasActivity = loans.some(l => 
  l.instalments?.some((i: any) => i.status === 'paid' || i.status === 'missed' || i.status === 'partial')
);
if (!hasActivity) return { score: 0, grade: 'N/A', stats: { totalBorrowed, totalPaid: 0, punctuality: 0, activeLoans: totalLoans - closedLoans, closedLoans } };
```

---

## TASK 7 — Deduction Type: Percentage or Fixed in New Loan Form
I want to add deduction type: percentage or fixed in new loan form.  Use a toggle in the UI to switch from percentage to fixed and vice versa. 
### 7.1 — Add `deductionType` to `LoanPackage` schema
**File:** `prisma/schema.prisma` — inside `model LoanPackage`:
```prisma
deductionType String @default("fixed") @map("deduction_type") // "fixed" | "percentage"
```
Run: `npx prisma migrate dev --name add_deduction_type`

### 7.2 — Add `deductionType` to `Loan` schema
**File:** `prisma/schema.prisma` — inside `model Loan`:
```prisma
deductionType String @default("fixed") @map("deduction_type")
```
Run migration again or include in same migration.

### 7.3 — Update `LoanForm.tsx` to support percentage/fixed toggle
**File:** `app/(dashboard)/loans/new/LoanForm.tsx`

Add state:
```tsx
const [deductionType, setDeductionType] = useState<'fixed' | 'percentage'>('fixed');
const [deductionInput, setDeductionInput] = useState<number | ''>('');
```

Compute actual deduction from input:
```tsx
const computedDeduction = deductionType === 'percentage'
  ? Math.round((Number(principal) || 0) * (Number(deductionInput) || 0) / 100)
  : Number(deductionInput) || 0;

const netDisbursed = (Number(principal) || 0) - computedDeduction;
```

Add toggle UI before the deduction input field:
```tsx
<div className="form-group">
  <label className="form-label">Deduction Type</label>
  <div style={{ display: 'flex', gap: '8px' }}>
    {(['fixed', 'percentage'] as const).map(type => (
      <button key={type} type="button"
        onClick={() => { setDeductionType(type); setDeductionInput(''); }}
        style={{
          padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          border: deductionType === type ? '2px solid var(--primary)' : '2px solid var(--border)',
          background: deductionType === type ? 'var(--primary-light)' : 'var(--bg)',
          color: deductionType === type ? 'var(--primary-dark)' : 'var(--text)',
          fontWeight: deductionType === type ? 700 : 400,
        }}
      >{type === 'fixed' ? '₹ Fixed Amount' : '% Percentage'}</button>
    ))}
  </div>
</div>

<div className="form-group">
  <label className="form-label">
    {deductionType === 'percentage'
      ? `Deduction % (= ${currencySymbol}${computedDeduction.toLocaleString()})`
      : `Deduction (${currencySymbol})`} *
  </label>
  <input
    type="number"
    name="deductionInput"
    className="form-control"
    placeholder={deductionType === 'percentage' ? 'e.g. 10 (for 10%)' : 'e.g. 3000'}
    value={deductionInput}
    onChange={e => setDeductionInput(e.target.value ? Number(e.target.value) : '')}
    required
  />
</div>
<input type="hidden" name="deduction" value={computedDeduction} />
<input type="hidden" name="deductionType" value={deductionType} />
```

### 7.4 — Update `handlePackageChange` in `LoanForm.tsx`
When a package is selected, also restore its `deductionType`:
```tsx
const handlePackageChange = (id: string) => {
  setPackageId(id);
  if (!id) return;
  const pkg = packages.find(p => p.id === id);
  if (pkg) {
    setPrincipal(Number(pkg.principal));
    setDeductionType(pkg.deductionType || 'fixed');
    setDeductionInput(Number(pkg.deduction));
    setFrequency(pkg.frequency);
    setTenure(pkg.tenure);
    setPenalty(Number(pkg.penaltyRate));
  }
};
```

### 7.5 — Update `loans/actions.ts` — `createLoan`
**File:** `app/(dashboard)/loans/actions.ts`  
Add `deductionType` to the loan create payload:
```ts
const deductionType = (formData.get('deductionType') as string) || 'fixed';
// In prisma.loan.create({ data: { ... } }):
deductionType,
```

### 7.6 — Update settings `createLoanPackage` action
**File:** `app/(dashboard)/settings/actions.ts` — `createLoanPackage`  
```ts
const deductionType = (formData.get('deductionType') as string) || 'fixed';
// In prisma.loanPackage.create:
deductionType,
```

### 7.7 — Update `SettingsClient.tsx` — loan package form
**File:** `app/(dashboard)/settings/SettingsClient.tsx`  
In the Add Package modal form, add a deduction type radio/toggle above the deduction field (same UI pattern as LoanForm). When type is 'percentage', show a `%` hint.

---

## TASK 8 — Save Custom Loan as New Package Template
I want to save custom loan as a new package template. If the user creates a loan with custom settings (not from an existing package), let them save it as a new package template.
### 8.1 — Add "Save as Template" UI to `LoanForm.tsx`
**File:** `app/(dashboard)/loans/new/LoanForm.tsx`

Add state and UI below the loan form's submit button (inside the form, after the existing submit/cancel buttons):
```tsx
const [showSaveTemplate, setShowSaveTemplate] = useState(false);
const [templateName, setTemplateName] = useState('');
const [savingTemplate, setSavingTemplate] = useState(false);
const [templateSaved, setTemplateSaved] = useState(false);
```

Add button to trigger the save UI:
```tsx
{/* After the existing form-actions div */}
{!packageId && principal && deductionInput && tenure && (
  <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>
    {!showSaveTemplate ? (
      <button type="button" className="btn btn-ghost btn-sm" 
        onClick={() => setShowSaveTemplate(true)}
        style={{ color: 'var(--primary)' }}>
        <span className="material-icons-outlined" style={{ fontSize: '16px' }}>bookmark_add</span>
        Save these settings as a reusable template
      </button>
    ) : (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Template name (e.g. 30k Daily 100 days)"
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!templateName.trim() || savingTemplate || templateSaved}
          onClick={async () => {
            if (!templateName.trim()) return;
            setSavingTemplate(true);
            const res = await fetch('/api/packages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: templateName.trim(),
                principal: Number(principal),
                deduction: computedDeduction,
                deductionType,
                frequency,
                tenure: Number(tenure),
                penaltyRate: penalty,
              }),
            });
            setSavingTemplate(false);
            if (res.ok) {
              setTemplateSaved(true);
              setShowSaveTemplate(false);
              // Optionally: reload packages list — or show success message
            }
          }}
        >
          {savingTemplate ? 'Saving...' : 'Save Template'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm"
          onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}>
          Cancel
        </button>
        {templateSaved && (
          <span style={{ color: 'var(--success)', fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check_circle</span>
            Template saved!
          </span>
        )}
      </div>
    )}
  </div>
)}
```

**Note:** This calls `POST /api/packages` from TASK 1.9. The API route must be complete before this works.

### 8.2 — After template saved, refresh package list in LoanForm
The `packages` prop is passed from the server. To show the new template in the dropdown without a page reload, maintain local state:
```tsx
const [localPackages, setLocalPackages] = useState(packages);

// After successful template save in the onClick:
const saved = await res.json();
if (saved.success) {
  setLocalPackages(prev => [...prev, saved.data]);
  setTemplateSaved(true);
  setPackageId(saved.data.id); // auto-select the saved template
}
```
Replace all references to `packages` prop with `localPackages` in the dropdown.

---

<!-- ## TASK 9 — Module Subscription Feature Gating
I want to add module subscription gating to the app which the developer has to give the access to each module and sub module for tenant. Modules means microlending, chit fund, vehicle finance, inventory finance, etc. And also inside each module i want sub module gating. For example in microlending there are loans, repo, etc. There is a master subscription table which will store the subscription details of each tenant. And inside the subscription there are different plans like starter, pro, etc. And inside each plan there are different modules and sub modules. So when the developer creates a new tenant, the developer has to give the access to each module and sub module for tenant. 
### 9.1 — Create `lib/moduleGate.ts`
```ts
import prisma from '@/lib/db';

/**
 * Returns the list of enabled module IDs for a tenant.
 * Falls back to ['microlending'] if no subscription record exists.
 */
export async function getEnabledModules(tenantId: string): Promise<string[]> {
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!sub) return ['microlending'];
  return sub.enabledModules?.split(',').filter(Boolean) || ['microlending'];
}

/**
 * Throws an error if the requested module is not enabled for the tenant.
 */
export async function requireModule(tenantId: string, module: string): Promise<void> {
  const enabled = await getEnabledModules(tenantId);
  if (!enabled.includes(module)) {
    throw new Error(`The "${module}" module is not enabled on your subscription. Please upgrade your plan.`);
  }
}
```

### 9.2 — Gate vehicle pages
**File:** `app/(dashboard)/vehicles/page.tsx` — top of the server component:
```ts
import { requireModule } from '@/lib/moduleGate';
// Inside the component, after tenantId is resolved:
await requireModule(tenantId, 'autofinance');
```

**File:** `app/(dashboard)/vehicles/new/page.tsx` — same pattern.

**File:** `app/(dashboard)/vehicles/actions.ts` — inside `createVehicle`, `flagForRepo`, `clearRepoFlag`:
```ts
await requireModule(tenantId, 'autofinance');
```

### 9.3 — Gate chit fund pages
**File:** `app/(dashboard)/chits/page.tsx`, `chits/new/page.tsx`, `chits/[id]/page.tsx`  
```ts
await requireModule(tenantId, 'chitfunds');
```
**File:** `app/(dashboard)/chits/actions.ts` — inside `createChitGroup`, `recordAuctionWinner`, `recordChitPayment`:
```ts
await requireModule(tenantId, 'chitfunds');
```

### 9.4 — Gate sidebar links by enabled modules
**File:** `components/layout/Sidebar.tsx`

The sidebar receives `appType` as a prop. It needs to also receive `enabledModules`:
```tsx
// In Sidebar props:
enabledModules: string[];

// In DashboardLayout (app/(dashboard)/layout.tsx), fetch and pass:
import { getEnabledModules } from '@/lib/moduleGate';
const enabledModules = await getEnabledModules(tenantId);
// Pass to <Sidebar appType={appType} enabledModules={enabledModules} />
```

In `Sidebar.tsx`, filter nav items:
```tsx
// Current: appTypes filter checks the currently selected appType
// New: also check if the module is in enabledModules

const filteredNav = navItems.filter(item => {
  if (item.adminOnly && role === 'agent') return false;
  if (item.superadminOnly && role !== 'superadmin') return false;
  if (item.developerOnly && role !== 'developer') return false;
  // Module gate: if item requires a specific appType, check it's in enabledModules
  if (item.appTypes && !item.appTypes.some((t: string) => enabledModules.includes(t))) return false;
  return true;
});
```

### 9.5 — Handle `requireModule` errors gracefully (show upgrade prompt)
**File:** `app/(dashboard)/vehicles/page.tsx` and `chits/page.tsx`  
Wrap the `requireModule` call in a try/catch and render an upgrade prompt instead of throwing:
```tsx
try {
  await requireModule(tenantId, 'autofinance');
} catch {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
      <span className="material-icons-outlined" style={{ fontSize: '48px', color: 'var(--border)' }}>lock</span>
      <h3 style={{ margin: '16px 0 8px' }}>Module Not Enabled</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
        The Auto Finance module is not included in your current subscription plan.
      </p>
      <Link href="/subscription" className="btn btn-primary">View Subscription</Link>
    </div>
  );
}
```

### 9.6 — Extend `checkLimit` to also check module access
**File:** `lib/subscription.ts` — update `checkLimit`:
```ts
export async function checkLimit(tenantId: string, resource: 'loans' | 'agents' | 'vehicles' | 'chits') {
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  if (!sub) return;
  if (sub.status !== 'active') throw new Error('Your subscription is inactive.');

  if (resource === 'vehicles') {
    const enabled = sub.enabledModules?.split(',') || [];
    if (!enabled.includes('autofinance')) throw new Error('Auto Finance module not enabled on your plan.');
  }
  if (resource === 'chits') {
    const enabled = sub.enabledModules?.split(',') || [];
    if (!enabled.includes('chitfunds')) throw new Error('Chit Funds module not enabled on your plan.');
  }
  // ... existing loans and agents checks
}
```

### 9.7 — Add module status to dashboard KPI
**File:** `app/(dashboard)/dashboard/page.tsx`  
In the conditional blocks for autofinance/chitfunds, wrap with `enabledModules` check (passed from `getEnabledModules`):
```tsx
// Fetch at top of DashboardPage:
const { getEnabledModules } = await import('@/lib/moduleGate');
const enabledModules = await getEnabledModules(tenantId);

// Then:
{enabledModules.includes('autofinance') && appType === 'autofinance' && (
  // autofinance KPIs
)}
{enabledModules.includes('chitfunds') && appType === 'chitfunds' && (
  // chitfunds KPIs
)}
```

--- -->

## TASK 10 — Additional Fixes from Code Review

### 10.1 — Dashboard page missing agent redirect
**File:** `app/(dashboard)/dashboard/page.tsx`  
Add at the top of `DashboardPage()` after session:
```ts
if (userRole === 'agent') redirect('/collection');
```

### 10.2 — Settings page redirects agent to `/dashboard` instead of `/collection`
**File:** `app/(dashboard)/settings/page.tsx` line 11:
```ts
// Change:
redirect('/dashboard');
// To:
redirect('/collection');
```

### 10.3 — `AUTH_SECRET` is a placeholder
**File:** `.env.local` and `.env`  
Both contain `AUTH_SECRET="replace-with-a-long-random-secret-at-least-32-chars"`. This must be replaced with a real generated secret before any deployment. Add a comment in `README.md`:
```md
## Setup
Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 
and set the output as AUTH_SECRET in .env.local
```

### 10.4 — Deduction label in LoanForm still says ₹ in fixed mode
After TASK 7 implementation, the fixed deduction label should use `currencySymbol` prop, not the hardcoded `₹` fallback in the toggle button label. Update the toggle button text:
```tsx
// Change:
'₹ Fixed Amount'
// To:
`${currencySymbol} Fixed Amount`
```

### 10.5 — Scratch files should be excluded from production
The `scratch/` directory contains debug scripts. Add to `.gitignore` and ensure they're excluded from any build or deploy process:
```
# .gitignore additions:
scratch/
database/*.sql
zolofund_export*.sql
```

---

## Migration Checklist (run after all code changes)

```bash
# 1. Apply schema changes
npx prisma migrate dev --name v5_deduction_type

# 2. Regenerate Prisma client
npx prisma generate

# 3. Verify build
npm run build

# 4. Run seed on fresh DB
npx prisma db seed
```

---

## File Change Summary

| File | Change Type |
|---|---|
| `prisma/schema.prisma` | Add `deductionType` to `LoanPackage` and `Loan` |
| `lib/plans.ts` | NEW — shared plan/module constants |
| `lib/moduleGate.ts` | NEW — `getEnabledModules`, `requireModule` |
| `lib/creditScore.ts` | Fix 6 bugs |
| `lib/subscription.ts` | Extend `checkLimit` for vehicles/chits |
| `middleware.ts` | Already correct — no change |
| `app/globals.css` | Badge classes, semantic vars, mobile queries |
| `app/(dashboard)/loans/new/LoanForm.tsx` | Deduction type toggle, save-as-template |
| `app/(dashboard)/loans/actions.ts` | Pass `deductionType` |
| `app/(dashboard)/settings/SettingsClient.tsx` | Deduction type in package form |
| `app/(dashboard)/settings/actions.ts` | Pass `deductionType` |
| `app/(dashboard)/settings/page.tsx` | Fix redirect target |
| `app/(dashboard)/dashboard/page.tsx` | Add agent redirect, module gate KPIs |
| `app/(dashboard)/vehicles/page.tsx` | Remove hardcoded appType, add module gate |
| `app/(dashboard)/vehicles/new/page.tsx` | Same |
| `app/(dashboard)/vehicles/actions.ts` | Remove hardcoded appType, add module gate |
| `app/(dashboard)/chits/page.tsx` | Add module gate |
| `app/(dashboard)/chits/new/page.tsx` | Add module gate |
| `app/(dashboard)/chits/[id]/page.tsx` | Add module gate |
| `app/(dashboard)/chits/new/ChitGroupForm.tsx` | Accept currencySymbol prop |
| `app/(dashboard)/chits/actions.ts` | Add module gate |
| `app/(dashboard)/customers/page.tsx` | Fix hardcoded ₹ |
| `app/(dashboard)/penalties/PenaltiesClient.tsx` | Fix customer link |
| `app/(dashboard)/subscription/page.tsx` | Import from lib/plans.ts |
| `app/admin/users/UsersClient.tsx` | Accept defaultAppType prop |
| `app/admin/billing/[tenantId]/page.tsx` | Import from lib/plans.ts |
| `app/portal/billing/page.tsx` | Import from lib/plans.ts |
| `components/layout/Sidebar.tsx` | Accept enabledModules, gate module links |
| `app/(dashboard)/layout.tsx` | Fetch and pass enabledModules to Sidebar |
| `app/api/instalments/route.ts` | NEW |
| `app/api/instalments/[id]/route.ts` | NEW |
| `app/api/penalties/route.ts` | NEW |
| `app/api/penalties/[id]/route.ts` | NEW |
| `app/api/collection/route.ts` | NEW |
| `app/api/customers/[id]/route.ts` | NEW |
| `app/api/loans/[id]/route.ts` | NEW |
| `app/api/routes/route.ts` | NEW |
| `app/api/packages/route.ts` | NEW |
| `app/api/packages/[id]/route.ts` | NEW |
| `app/api/dashboard/route.ts` | NEW |
| `app/api/reports/route.ts` | NEW |
| `app/api/approvals/route.ts` | NEW |
| `app/api/settings/route.ts` | NEW |
| `app/api/health/route.ts` | NEW |
