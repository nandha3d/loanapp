/**
 * Generates: tests/e2e/accounting/AccountingTestCases.xlsx
 * Run: npx tsx tests/e2e/accounting/generate-testcases-excel.ts
 */
import * as XLSX from 'xlsx';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TC {
  id: string;
  module: string;
  feature: string;
  subFeature: string;
  title: string;
  type: 'Positive' | 'Negative' | 'Edge' | 'UI' | 'Role';
  priority: 'P0' | 'P1' | 'P2';
  role: string;
  precondition: string;
  steps: string;
  expected: string;
  actualResult: string;
  status: string;
  remarks: string;
}

// ─── Test Cases ───────────────────────────────────────────────────────────────
const cases: Omit<TC, 'actualResult' | 'status' | 'remarks'>[] = [

  // ════════════════════════════════════════════════════
  //  01 — NAVIGATION & AUTH GUARDS
  // ════════════════════════════════════════════════════
  {
    id: 'AC-NAV-001', module: 'Accounting', feature: 'Navigation', subFeature: 'Premium Nav Bar',
    title: 'Premium nav bar renders with all 15 links',
    type: 'UI', priority: 'P0', role: 'Superadmin',
    precondition: 'User logged in. Premium accounting enabled for tenant.',
    steps: '1. Navigate to /{module}/accounting/premium\n2. Inspect nav bar (.pa-nav)',
    expected: 'Nav bar visible. All 15 links present: Overview, Journal, Accounts, P&L, Balance Sheet, Cash Flow, Trial Balance, Tax & GST, Budget, Bank Rec, Vendors, Approvals, Periods, Export, Settings.',
  },
  {
    id: 'AC-NAV-002', module: 'Accounting', feature: 'Navigation', subFeature: 'Active State',
    title: 'Active nav link highlighted on current page',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'User on Overview page.',
    steps: '1. Navigate to /accounting/premium\n2. Check .pa-link.pa-active class',
    expected: '"Overview" link has .pa-active class. Indigo underline visible.',
  },
  {
    id: 'AC-NAV-003', module: 'Accounting', feature: 'Navigation', subFeature: 'Active State',
    title: 'Active state switches when navigating to Journal',
    type: 'UI', priority: 'P2', role: 'Superadmin',
    precondition: 'User on any accounting page.',
    steps: '1. Click "Journal" in nav bar\n2. Check active state',
    expected: '"Journal" link has .pa-active class. URL = /accounting/premium/journal.',
  },
  {
    id: 'AC-NAV-004', module: 'Accounting', feature: 'Navigation', subFeature: 'Auth Guard',
    title: 'Unauthenticated access redirects to /login',
    type: 'Negative', priority: 'P0', role: 'Unauthenticated',
    precondition: 'No session cookie present.',
    steps: '1. Open browser in incognito\n2. Go to /{module}/accounting/premium',
    expected: 'Redirect to /login page. Accounting page NOT rendered.',
  },
  {
    id: 'AC-NAV-005', module: 'Accounting', feature: 'Navigation', subFeature: 'Auth Guard',
    title: 'Agent role redirected to dashboard',
    type: 'Role', priority: 'P0', role: 'Agent',
    precondition: 'User with role=agent logged in.',
    steps: '1. Navigate to /accounting/premium',
    expected: 'Redirect to /{module}/dashboard. Accounting layout NOT rendered.',
  },
  {
    id: 'AC-NAV-006', module: 'Accounting', feature: 'Navigation', subFeature: 'Premium Gate',
    title: 'Module disabled → shows upgrade prompt',
    type: 'UI', priority: 'P1', role: 'Admin',
    precondition: 'Premium accounting disabled for tenant in AccountingSettings.',
    steps: '1. Navigate to /accounting/premium',
    expected: '"Full Accounting Suite" upgrade card shown. No nav tabs. "Request Access" button links to module-requests.',
  },
  {
    id: 'AC-NAV-007', module: 'Accounting', feature: 'Navigation', subFeature: 'Nav Click',
    title: 'Clicking Vendors in nav navigates correctly',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'User on Overview.',
    steps: '1. Click "Vendors" in nav bar',
    expected: 'URL becomes /accounting/premium/vendors. Vendors tab active.',
  },

  // ════════════════════════════════════════════════════
  //  02 — CHART OF ACCOUNTS
  // ════════════════════════════════════════════════════
  {
    id: 'AC-COA-001', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Page Load',
    title: 'CoA page renders toolbar, search, class filter, table',
    type: 'UI', priority: 'P0', role: 'Superadmin',
    precondition: 'User on /accounting/premium/coa',
    steps: '1. Navigate to /coa\n2. Inspect page elements',
    expected: 'Search input, class dropdown, "Show inactive" checkbox, "Reseed" button, "Add Account" button, and ac-table all visible.',
  },
  {
    id: 'AC-COA-002', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Reseed',
    title: 'Reseed populates default Chart of Accounts',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'CoA may be empty.',
    steps: '1. Click "Reseed"\n2. Wait for response',
    expected: '"Reseeded: X created, Y skipped." alert shown. Table populates with default accounts (1xxx Assets, 2xxx Liabilities, 3xxx Equity, 4xxx Income, 5xxx Expenses).',
  },
  {
    id: 'AC-COA-003', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Search',
    title: 'Search by account code filters rows',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Accounts exist in table.',
    steps: '1. Type a known code (e.g. "1110") in search box',
    expected: 'Table filters to only rows containing "1110". Other accounts hidden.',
  },
  {
    id: 'AC-COA-004', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Search',
    title: 'Search by account name (case-insensitive)',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'Accounts exist.',
    steps: '1. Type "cash" (lowercase) in search box',
    expected: 'All accounts whose name contains "cash" (case-insensitive) are shown.',
  },
  {
    id: 'AC-COA-005', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Filter',
    title: 'Class filter "expense" shows only expense accounts',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Expense accounts exist.',
    steps: '1. Select "expense" from class dropdown',
    expected: 'All visible rows show "expense" badge. No asset/liability/equity/income accounts shown.',
  },
  {
    id: 'AC-COA-006', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Filter',
    title: 'Show inactive toggle reveals dimmed inactive rows',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'At least one inactive account exists.',
    steps: '1. Check "Show inactive" checkbox',
    expected: 'Inactive account rows appear with opacity < 1 (dimmed). Row count increases.',
  },
  {
    id: 'AC-COA-007', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Add Account',
    title: 'Add Account modal: empty code shows validation error',
    type: 'Negative', priority: 'P1', role: 'Superadmin',
    precondition: 'Add Account modal open.',
    steps: '1. Click "Add Account"\n2. Leave Code empty\n3. Fill Name\n4. Click Save',
    expected: 'HTML5 required validation fires on Code field. Modal stays open. No account created.',
  },
  {
    id: 'AC-COA-008', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Add Account',
    title: 'Add Account: create new expense account successfully',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Unique 4-digit code available.',
    steps: '1. Click "Add Account"\n2. Fill Code (e.g. 9100), Name, Class=expense\n3. Click Save',
    expected: 'Modal closes. Success alert "Saved." shown. New account appears in table with expense badge.',
  },
  {
    id: 'AC-COA-009', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Add Account',
    title: 'Add Account: duplicate code shows "duplicateCode" error',
    type: 'Negative', priority: 'P1', role: 'Superadmin',
    precondition: 'Account with same code already exists.',
    steps: '1. Click "Add Account"\n2. Enter existing code\n3. Click Save',
    expected: 'Error message "duplicateCode" or "already exists" shown. Modal stays open. No new account created.',
  },
  {
    id: 'AC-COA-010', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Edit Account',
    title: 'Edit Account: modal pre-fills existing name, no code field',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'Account exists.',
    steps: '1. Click ✎ button on account row',
    expected: 'Modal opens with title "Edit Account". Name field pre-filled. Code field NOT shown (code immutable after create).',
  },
  {
    id: 'AC-COA-011', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Edit Account',
    title: 'Edit Account: rename succeeds',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Account exists.',
    steps: '1. Open edit modal\n2. Change Name field\n3. Click Save',
    expected: 'Modal closes. New name visible in table row.',
  },
  {
    id: 'AC-COA-012', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Deactivate',
    title: 'Deactivate account → row becomes dimmed',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Non-system account exists with no active children.',
    steps: '1. Click ✕ button on account row\n2. Check "Show inactive"',
    expected: '"Done." alert. Row becomes dimmed (opacity < 1) when "Show inactive" is enabled.',
  },
  {
    id: 'AC-COA-013', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Deactivate',
    title: 'Deactivate account with active children → "has_active_children" error',
    type: 'Negative', priority: 'P1', role: 'Superadmin',
    precondition: 'Parent account has active child accounts.',
    steps: '1. Click ✕ on parent account',
    expected: '"has_active_children" error shown. Account remains active.',
  },
  {
    id: 'AC-COA-014', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Reactivate',
    title: 'Reactivate deactivated account → row fully opaque',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'Inactive account visible (Show inactive checked).',
    steps: '1. Click ↩ button on inactive row',
    expected: '"Done." alert. Row opacity becomes 1.0 (fully opaque). Account is active again.',
  },
  {
    id: 'AC-COA-015', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Add Child',
    title: 'Add child account from parent row ⊕ button',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'Parent account exists.',
    steps: '1. Click ⊕ button on parent row\n2. Fill Code & Name\n3. Save',
    expected: 'Child account created. Indented under parent in tree. ParentId set correctly.',
  },
  {
    id: 'AC-COA-016', module: 'Accounting', feature: 'Chart of Accounts', subFeature: 'Tree',
    title: 'Tree expand/collapse with ▾/▸ button',
    type: 'UI', priority: 'P2', role: 'Superadmin',
    precondition: 'Parent account has children.',
    steps: '1. Click ▾ to collapse\n2. Click ▸ to expand',
    expected: 'Children rows hidden on collapse. Re-shown on expand. Parent row itself stays visible.',
  },

  // ════════════════════════════════════════════════════
  //  03 — JOURNAL ENTRIES
  // ════════════════════════════════════════════════════
  {
    id: 'AC-JNL-001', module: 'Accounting', feature: 'Journal', subFeature: 'List Page',
    title: 'Journal list renders table, filters, New Entry button',
    type: 'UI', priority: 'P0', role: 'Superadmin',
    precondition: 'User on /journal',
    steps: '1. Navigate to /journal',
    expected: 'Date range (From/To), status filter select, search input, "New Entry" link, ac-table with headers: Date, Entry No, Narration, Status, Debit, Credit.',
  },
  {
    id: 'AC-JNL-002', module: 'Accounting', feature: 'Journal', subFeature: 'New Entry',
    title: 'Entry date defaults to today on new entry form',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'User opens /journal/new',
    steps: '1. Navigate to /journal/new\n2. Read Entry Date field value',
    expected: 'Entry Date = today\'s date (YYYY-MM-DD).',
  },
  {
    id: 'AC-JNL-003', module: 'Accounting', feature: 'Journal', subFeature: 'New Entry',
    title: 'Post button disabled when entry is unbalanced',
    type: 'Negative', priority: 'P0', role: 'Superadmin',
    precondition: 'New entry form open.',
    steps: '1. Fill Dr on line 1 (e.g. 500), leave Cr = 0\n2. Inspect Post Entry button',
    expected: 'Post Entry button is disabled. ⚠ imbalance indicator shows "Dr 500 ≠ Cr 0".',
  },
  {
    id: 'AC-JNL-004', module: 'Accounting', feature: 'Journal', subFeature: 'New Entry',
    title: 'Post button enabled when balanced',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'New entry form with 2 lines.',
    steps: '1. Set Dr line1 = 1000, Cr line2 = 1000\n2. Inspect Post Entry button',
    expected: 'Post Entry button enabled. ✔ Balanced indicator shown in green.',
  },
  {
    id: 'AC-JNL-005', module: 'Accounting', feature: 'Journal', subFeature: 'New Entry',
    title: 'Add Line appends a new table row',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'New entry form with default 2 lines.',
    steps: '1. Click "Add line"',
    expected: 'Third row added to lines table. Row count = 3.',
  },
  {
    id: 'AC-JNL-006', module: 'Accounting', feature: 'Journal', subFeature: 'New Entry',
    title: 'Remove line ✕ button not shown when rows = 2 (minimum)',
    type: 'UI', priority: 'P2', role: 'Superadmin',
    precondition: 'New entry form with exactly 2 lines.',
    steps: '1. Inspect ✕ buttons on lines',
    expected: 'No ✕ button visible on either row when count = 2.',
  },
  {
    id: 'AC-JNL-007', module: 'Accounting', feature: 'Journal', subFeature: 'New Entry',
    title: 'Remove line ✕ removes the row when > 2 lines',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Entry has 3+ lines.',
    steps: '1. Add a 3rd line\n2. Click ✕ on it',
    expected: 'Row removed. Count back to 2.',
  },
  {
    id: 'AC-JNL-008', module: 'Accounting', feature: 'Journal', subFeature: 'Save Draft',
    title: 'Save Draft allowed even when unbalanced',
    type: 'Positive', priority: 'P1', role: 'Admin',
    precondition: 'New entry with narration, Dr only (no Cr).',
    steps: '1. Fill Dr on line 1\n2. Click "Save Draft"',
    expected: 'Redirects to detail page. Status badge = "draft". No entryNo assigned.',
  },
  {
    id: 'AC-JNL-009', module: 'Accounting', feature: 'Journal', subFeature: 'Post Entry',
    title: 'Post balanced entry → redirects to detail, entryNo assigned (JE-YYYYNN-XXXX)',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Accounts exist. Period not locked.',
    steps: '1. Fill balanced entry (Dr 2500 = Cr 2500)\n2. Click Post Entry',
    expected: 'Redirects to /journal/{id}. EntryNo = JE-{FY}-{seq} format. Status = "posted". Narration visible.',
  },
  {
    id: 'AC-JNL-010', module: 'Accounting', feature: 'Journal', subFeature: 'Post Entry',
    title: 'Admin posting JE under adminJeCap → directly posted',
    type: 'Role', priority: 'P0', role: 'Admin',
    precondition: 'adminJeCap = 50,000 (default). Amount = 1,000.',
    steps: '1. Post balanced JE of 1,000 as admin',
    expected: 'Status = "posted". No approval required.',
  },
  {
    id: 'AC-JNL-011', module: 'Accounting', feature: 'Journal', subFeature: 'Post Entry',
    title: 'Admin posting JE over adminJeCap → pending_approval',
    type: 'Role', priority: 'P0', role: 'Admin',
    precondition: 'adminJeCap = 50,000. Amount = 75,000.',
    steps: '1. Post balanced JE of 75,000 as admin',
    expected: 'Status = "pending_approval". AccountingApproval row created. ApproverRole = superadmin.',
  },
  {
    id: 'AC-JNL-012', module: 'Accounting', feature: 'Journal', subFeature: 'Detail Page',
    title: 'Detail page: meta strip shows Status, Source, Created By, Approved By',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'Posted journal entry exists.',
    steps: '1. Open any posted JE detail page',
    expected: 'Labels visible: Status, Source, Created By. If approved: "Approved By" also shown. Correct values displayed.',
  },
  {
    id: 'AC-JNL-013', module: 'Accounting', feature: 'Journal', subFeature: 'Detail Page',
    title: 'Detail page: lines table with account codes, Dr, Cr columns',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'Posted JE with ≥2 lines.',
    steps: '1. Open JE detail',
    expected: 'Table headers: #, Account, Description, Debit, Credit. Each line shows account code + name in monospace.',
  },
  {
    id: 'AC-JNL-014', module: 'Accounting', feature: 'Journal', subFeature: 'Detail Page',
    title: 'Detail page: totals footer shows Total Dr = Total Cr',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Posted balanced JE.',
    steps: '1. Open JE detail\n2. Check totals footer',
    expected: '"Total Dr: X" and "Total Cr: X" — both equal.',
  },
  {
    id: 'AC-JNL-015', module: 'Accounting', feature: 'Journal', subFeature: 'Detail Page',
    title: '"Back to Journal Entries" link returns to list',
    type: 'UI', priority: 'P2', role: 'Superadmin',
    precondition: 'On JE detail page.',
    steps: '1. Click "Back to Journal Entries" link',
    expected: 'Navigates to /journal list page.',
  },
  {
    id: 'AC-JNL-016', module: 'Accounting', feature: 'Journal', subFeature: 'Reversal',
    title: 'Reverse entry: cancel prompt → no reversal created',
    type: 'Negative', priority: 'P1', role: 'Superadmin',
    precondition: 'Posted JE. Role = superadmin.',
    steps: '1. Click Reverse button\n2. Cancel the browser prompt (reason dialog)',
    expected: 'No reversal created. Status remains "posted". Page unchanged.',
  },
  {
    id: 'AC-JNL-017', module: 'Accounting', feature: 'Journal', subFeature: 'Reversal',
    title: 'Reverse entry: with reason → creates reversal, status = "reversed"',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Posted JE exists.',
    steps: '1. Click Reverse\n2. Enter reason in prompt\n3. Confirm',
    expected: '"Reversal created: {id}" message. Page reloads. Status = "reversed". "Reversed by" link shown pointing to reversal entry.',
  },
  {
    id: 'AC-JNL-018', module: 'Accounting', feature: 'Journal', subFeature: 'Reversal',
    title: 'Reversal entry is a mirror (Dr↔Cr swapped)',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Reversal just created.',
    steps: '1. Click "Reversed by" link to open reversal JE\n2. Compare lines',
    expected: 'Reversal JE has same accounts. Dr and Cr are swapped vs original. Source type = "reversal". narration = "Reversal of {entryNo}: {reason}".',
  },
  {
    id: 'AC-JNL-019', module: 'Accounting', feature: 'Journal', subFeature: 'Reversal',
    title: 'Reverse button NOT shown on already-reversed entry',
    type: 'Negative', priority: 'P1', role: 'Superadmin',
    precondition: 'JE with status = "reversed".',
    steps: '1. Open reversed JE detail',
    expected: 'Reverse button not visible.',
  },
  {
    id: 'AC-JNL-020', module: 'Accounting', feature: 'Journal', subFeature: 'Filters',
    title: 'Filter by status "posted" shows only posted entries',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Multiple entries with different statuses.',
    steps: '1. Select "posted" from status dropdown',
    expected: 'All visible rows show "posted" status badge.',
  },
  {
    id: 'AC-JNL-021', module: 'Accounting', feature: 'Journal', subFeature: 'Filters',
    title: 'Date range filter excludes out-of-range entries',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Entries exist for current month.',
    steps: '1. Set From = 2099-01-01, To = 2099-01-31',
    expected: 'Zero rows shown. Empty state placeholder.',
  },
  {
    id: 'AC-JNL-022', module: 'Accounting', feature: 'Journal', subFeature: 'Filters',
    title: 'Search by narration returns matching entry',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Entry with known unique narration exists.',
    steps: '1. Type unique narration string in search\n2. Press Enter or wait',
    expected: 'Only matching entry shown in table.',
  },

  // ════════════════════════════════════════════════════
  //  04 — VENDORS & BILLS
  // ════════════════════════════════════════════════════
  {
    id: 'AC-VND-001', module: 'Accounting', feature: 'Vendors', subFeature: 'Page',
    title: 'Vendors page renders Vendors and Bills tabs',
    type: 'UI', priority: 'P0', role: 'Admin',
    precondition: 'User on /vendors',
    steps: '1. Navigate to /vendors',
    expected: 'Two tabs visible: "Vendors" and "Bills". Vendors tab active by default. "Add Vendor" button present.',
  },
  {
    id: 'AC-VND-002', module: 'Accounting', feature: 'Vendors', subFeature: 'Create Vendor',
    title: 'Create vendor: name required validation',
    type: 'Negative', priority: 'P0', role: 'Admin',
    precondition: 'Add Vendor modal open.',
    steps: '1. Click Add Vendor\n2. Leave Name empty\n3. Click Save',
    expected: 'HTML5 required validation. Modal stays open.',
  },
  {
    id: 'AC-VND-003', module: 'Accounting', feature: 'Vendors', subFeature: 'Create Vendor',
    title: 'Create vendor: invalid GSTIN format rejected',
    type: 'Negative', priority: 'P0', role: 'Admin',
    precondition: 'Add Vendor modal open.',
    steps: '1. Fill Name\n2. Enter invalid GSTIN (e.g. "11INVALID000")\n3. Click Save',
    expected: '"gstin_invalid" error shown. Vendor NOT created.',
  },
  {
    id: 'AC-VND-004', module: 'Accounting', feature: 'Vendors', subFeature: 'Create Vendor',
    title: 'Create vendor: invalid PAN format rejected',
    type: 'Negative', priority: 'P0', role: 'Admin',
    precondition: 'Add Vendor modal open.',
    steps: '1. Fill Name\n2. Enter invalid PAN (e.g. "BADPAN")\n3. Click Save',
    expected: '"pan_invalid" error shown. Vendor NOT created.',
  },
  {
    id: 'AC-VND-005', module: 'Accounting', feature: 'Vendors', subFeature: 'Create Vendor',
    title: 'Create vendor: valid GSTIN (27AAPFU0939F1ZV) and PAN accepted',
    type: 'Positive', priority: 'P0', role: 'Admin',
    precondition: 'Vendor with that GSTIN/PAN does not exist.',
    steps: '1. Fill Name, GSTIN=27AAPFU0939F1ZV, PAN=AAPFU0939F\n2. Click Save',
    expected: 'Vendor created. Appears in list. GSTIN and PAN stored correctly.',
  },
  {
    id: 'AC-VND-006', module: 'Accounting', feature: 'Vendors', subFeature: 'Create Vendor',
    title: 'Create vendor with name only (minimal required fields)',
    type: 'Positive', priority: 'P1', role: 'Admin',
    precondition: 'Vendor modal open.',
    steps: '1. Fill only Name field\n2. Click Save',
    expected: 'Vendor created. GSTIN/PAN/phone shown as empty. isActive=true.',
  },
  {
    id: 'AC-VND-007', module: 'Accounting', feature: 'Vendors', subFeature: 'Deactivate',
    title: 'Deactivate vendor removes from active list',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Vendor exists.',
    steps: '1. Click ✕ deactivate button on vendor row',
    expected: 'Vendor isActive=false. Row disappears from active vendors list.',
  },
  {
    id: 'AC-VND-008', module: 'Accounting', feature: 'Bills', subFeature: 'Create Bill',
    title: 'Create bill with no lines → "bill_no_lines" error',
    type: 'Negative', priority: 'P0', role: 'Admin',
    precondition: 'At least one vendor exists.',
    steps: '1. Click Add Bill\n2. Fill vendor, bill no, dates\n3. No lines added\n4. Click Save',
    expected: '"bill_no_lines" error shown. Bill NOT created.',
  },
  {
    id: 'AC-VND-009', module: 'Accounting', feature: 'Bills', subFeature: 'Create Bill',
    title: 'Create bill with valid line → status = draft',
    type: 'Positive', priority: 'P0', role: 'Admin',
    precondition: 'Vendor and expense account exist.',
    steps: '1. Click Add Bill\n2. Fill all fields + 1 line (account, amount=5000)\n3. Click Save',
    expected: 'Bill created with status="draft". Appears in Bills tab with correct amount.',
  },
  {
    id: 'AC-VND-010', module: 'Accounting', feature: 'Bills', subFeature: 'Create Bill',
    title: 'Duplicate bill number → "bill_no_duplicate" error',
    type: 'Negative', priority: 'P1', role: 'Admin',
    precondition: 'Bill with same number already exists.',
    steps: '1. Click Add Bill\n2. Use same bill number\n3. Click Save',
    expected: '"bill_no_duplicate" error. Bill NOT created.',
  },
  {
    id: 'AC-VND-011', module: 'Accounting', feature: 'Bills', subFeature: 'Post Bill',
    title: 'Post bill → status changes from draft to unpaid, JE created',
    type: 'Positive', priority: 'P0', role: 'Admin',
    precondition: 'Draft bill exists. Vendor payable account (2110) in CoA.',
    steps: '1. Click "Post" on draft bill row',
    expected: 'Bill status = "unpaid". JournalEntry created (sourceType="bill"). Account 2110 credited.',
  },
  {
    id: 'AC-VND-012', module: 'Accounting', feature: 'Bills', subFeature: 'Pay Bill',
    title: 'Full payment → bill status changes to "paid"',
    type: 'Positive', priority: 'P0', role: 'Admin',
    precondition: 'Unpaid bill. Bank account exists.',
    steps: '1. Click Pay on unpaid bill\n2. Enter full outstanding amount, date, bank account\n3. Click Pay',
    expected: 'Bill status = "paid". paidAmount = totalAmount. Payment JE created (sourceType="bill_payment").',
  },
  {
    id: 'AC-VND-013', module: 'Accounting', feature: 'Bills', subFeature: 'Pay Bill',
    title: 'Partial payment → bill status changes to "partial"',
    type: 'Positive', priority: 'P1', role: 'Admin',
    precondition: 'Unpaid bill with amount 5000.',
    steps: '1. Click Pay\n2. Enter 2000 (partial)\n3. Click Pay',
    expected: 'Bill status = "partial". paidAmount = 2000. Outstanding = 3000.',
  },
  {
    id: 'AC-VND-014', module: 'Accounting', feature: 'Bills', subFeature: 'Pay Bill',
    title: 'Overpayment rejected with "overpayment" error',
    type: 'Negative', priority: 'P0', role: 'Admin',
    precondition: 'Unpaid bill outstanding = 5000.',
    steps: '1. Click Pay\n2. Enter 999999 (overpayment)\n3. Click Pay',
    expected: '"overpayment" error shown. Bill status unchanged. No JE created.',
  },
  {
    id: 'AC-VND-015', module: 'Accounting', feature: 'Bills', subFeature: 'Cancel Bill',
    title: 'Cancel bill → status = "cancelled" (superadmin only)',
    type: 'Role', priority: 'P1', role: 'Superadmin',
    precondition: 'Unpaid or draft bill exists.',
    steps: '1. Click Cancel on bill row',
    expected: 'Bill status = "cancelled". Row shows cancelled badge.',
  },
  {
    id: 'AC-VND-016', module: 'Accounting', feature: 'Bills', subFeature: 'Post Bill',
    title: 'Admin posts bill over adminBillCap → pending_approval',
    type: 'Role', priority: 'P0', role: 'Admin',
    precondition: 'adminBillCap = 1,00,000. Bill amount = 1,50,000.',
    steps: '1. Click Post on high-value draft bill as admin',
    expected: 'Bill status = "pending_approval". Approval row created.',
  },
  {
    id: 'AC-VND-017', module: 'Accounting', feature: 'Vendors', subFeature: 'Ageing Report',
    title: 'Ageing report modal renders with 0-30, 30-60, 60-90, 90+ columns',
    type: 'UI', priority: 'P1', role: 'Admin',
    precondition: 'At least one unpaid/partial bill exists.',
    steps: '1. Click Ageing button in Bills tab',
    expected: 'Modal opens. Table shows vendor rows with bucket columns: 0-30, 30-60, 60-90, 90+ days. Total column present.',
  },
  {
    id: 'AC-VND-018', module: 'Accounting', feature: 'Vendors', subFeature: 'Bill GST',
    title: 'Bill with GST rate: gstAmount calculated correctly',
    type: 'Positive', priority: 'P1', role: 'Admin',
    precondition: 'Bill line with gstRate=18.',
    steps: '1. Create bill with amount=1000, gstRate=18\n2. Save',
    expected: 'gstAmount = 180. totalAmount = 1180.',
  },

  // ════════════════════════════════════════════════════
  //  05 — APPROVALS
  // ════════════════════════════════════════════════════
  {
    id: 'AC-APR-001', module: 'Accounting', feature: 'Approvals', subFeature: 'List',
    title: 'Approvals page renders table with filter controls',
    type: 'UI', priority: 'P0', role: 'Superadmin',
    precondition: 'User on /approvals',
    steps: '1. Navigate to /approvals',
    expected: 'ac-table visible. Status filter and entity type filter present. Columns: Type, Amount, Level, Status, Requested.',
  },
  {
    id: 'AC-APR-002', module: 'Accounting', feature: 'Approvals', subFeature: 'Filter',
    title: 'Filter by status "pending" shows only pending rows',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Mixed approval statuses exist.',
    steps: '1. Select "pending" from status filter',
    expected: 'All visible rows show "pending" status.',
  },
  {
    id: 'AC-APR-003', module: 'Accounting', feature: 'Approvals', subFeature: 'Filter',
    title: 'Filter by entity type "journal_entry"',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'Both JE and bill approvals exist.',
    steps: '1. Select "journal_entry" from entity type filter',
    expected: 'Only JE approvals shown.',
  },
  {
    id: 'AC-APR-004', module: 'Accounting', feature: 'Approvals', subFeature: 'Approve',
    title: 'Approve pending entry — modal shows optional note textarea',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'Pending approval exists.',
    steps: '1. Click Approve on pending row',
    expected: 'Approve modal opens with optional note textarea.',
  },
  {
    id: 'AC-APR-005', module: 'Accounting', feature: 'Approvals', subFeature: 'Approve',
    title: 'Approve without note → entity posted',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Pending L1 approval, amount ≤ twoLevelApprovalThreshold.',
    steps: '1. Click Approve\n2. Leave note empty\n3. Click Confirm',
    expected: 'Approval status = "approved". Underlying entity status = "posted". No L2 row created.',
  },
  {
    id: 'AC-APR-006', module: 'Accounting', feature: 'Approvals', subFeature: 'Approve',
    title: 'Approve with note → note stored in reviewNote',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'Pending approval exists.',
    steps: '1. Click Approve\n2. Enter note\n3. Click Confirm',
    expected: 'Approval approved. reviewNote = entered text.',
  },
  {
    id: 'AC-APR-007', module: 'Accounting', feature: 'Approvals', subFeature: 'L2 Routing',
    title: 'L1 approve large amount → L2 approval row created',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Amount > twoLevelApprovalThreshold (5,00,000). Approver = superadmin (not developer).',
    steps: '1. Approve L1 for large JE',
    expected: 'L1 status = "approved". New L2 approval row created with level=2, approverRole="developer".',
  },
  {
    id: 'AC-APR-008', module: 'Accounting', feature: 'Approvals', subFeature: 'Reject',
    title: 'Reject requires non-empty note (validation)',
    type: 'Negative', priority: 'P0', role: 'Superadmin',
    precondition: 'Pending approval exists.',
    steps: '1. Click Reject\n2. Leave note empty\n3. Click Confirm',
    expected: 'HTML5 required validation. Modal stays open. No rejection.',
  },
  {
    id: 'AC-APR-009', module: 'Accounting', feature: 'Approvals', subFeature: 'Reject',
    title: 'Reject with note → approval rejected, entity status updated',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Pending JE approval exists.',
    steps: '1. Click Reject\n2. Enter note\n3. Click Confirm',
    expected: 'Approval status = "rejected". JE status = "rejected". Bill (if bill type) status = "draft".',
  },
  {
    id: 'AC-APR-010', module: 'Accounting', feature: 'Approvals', subFeature: 'Role',
    title: 'Admin sees only own submissions in approvals list',
    type: 'Role', priority: 'P0', role: 'Admin',
    precondition: 'Multiple users have submitted approvals.',
    steps: '1. Login as admin\n2. Navigate to /approvals',
    expected: 'Only approvals where requestedById = current admin user shown.',
  },
  {
    id: 'AC-APR-011', module: 'Accounting', feature: 'Approvals', subFeature: 'Role',
    title: 'Admin role cannot approve/reject (no approve/reject buttons)',
    type: 'Role', priority: 'P0', role: 'Admin',
    precondition: 'Admin views pending approval in list.',
    steps: '1. Login as admin\n2. View pending approval row',
    expected: 'Approve and Reject buttons not visible. Only Cancel button shown (for own submissions).',
  },
  {
    id: 'AC-APR-012', module: 'Accounting', feature: 'Approvals', subFeature: 'Cancel',
    title: 'Requester can cancel own pending approval',
    type: 'Positive', priority: 'P1', role: 'Admin',
    precondition: 'Admin has a pending approval they submitted.',
    steps: '1. Click Cancel on own pending approval',
    expected: 'Approval status = "cancelled".',
  },

  // ════════════════════════════════════════════════════
  //  06 — PERIOD LOCK
  // ════════════════════════════════════════════════════
  {
    id: 'AC-PER-001', module: 'Accounting', feature: 'Period Lock', subFeature: 'Page',
    title: 'Periods page renders 12-month table for current FY',
    type: 'UI', priority: 'P0', role: 'Superadmin',
    precondition: 'User on /period-lock',
    steps: '1. Navigate to /period-lock',
    expected: 'FY selector visible. Table with 12 rows (one per month). Columns: Period, Status, Net Profit, Actions.',
  },
  {
    id: 'AC-PER-002', module: 'Accounting', feature: 'Period Lock', subFeature: 'Auto-Create',
    title: 'Auto-creates 12 periods when none exist for FY',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'No AccountingPeriod rows for current FY.',
    steps: '1. Navigate to /period-lock',
    expected: '12 periods auto-created (Apr–Mar). All status = "open".',
  },
  {
    id: 'AC-PER-003', module: 'Accounting', feature: 'Period Lock', subFeature: 'Soft Lock',
    title: 'Soft lock open period → status = "soft_locked"',
    type: 'Positive', priority: 'P1', role: 'Superadmin',
    precondition: 'Open period exists.',
    steps: '1. Click "Soft Lock" on open period',
    expected: 'Period status = "soft_locked". PeriodLock audit entry created.',
  },
  {
    id: 'AC-PER-004', module: 'Accounting', feature: 'Period Lock', subFeature: 'Lock',
    title: 'Hard lock soft-locked period → status = "locked"',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Soft-locked period exists.',
    steps: '1. Click "Lock" on soft-locked period',
    expected: 'Period status = "locked". lockedAt set.',
  },
  {
    id: 'AC-PER-005', module: 'Accounting', feature: 'Period Lock', subFeature: 'Unlock',
    title: 'Unlock period: reason < 10 chars → "no_reason" error',
    type: 'Negative', priority: 'P0', role: 'Superadmin',
    precondition: 'Locked period exists.',
    steps: '1. Click Unlock\n2. Enter reason "short"\n3. Click Confirm',
    expected: '"no_reason" error or "at least 10 characters" message. Modal stays open. Period remains locked.',
  },
  {
    id: 'AC-PER-006', module: 'Accounting', feature: 'Period Lock', subFeature: 'Unlock',
    title: 'Unlock period: valid reason (≥10 chars) → status = "open"',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Locked period exists.',
    steps: '1. Click Unlock\n2. Enter "Unlocking for correction"\n3. Confirm',
    expected: 'Period status = "open". PeriodLock audit entry added.',
  },
  {
    id: 'AC-PER-007', module: 'Accounting', feature: 'Period Lock', subFeature: 'Close',
    title: 'Close period: confirm → status = "closed", closing JE created',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Open/locked period. Income and expense entries exist.',
    steps: '1. Click "Close Period"\n2. Click Confirm in modal',
    expected: 'Period status = "closed". Closing JE created (sourceType="period_close") zeroing income/expense accounts into retained earnings (3300).',
  },
  {
    id: 'AC-PER-008', module: 'Accounting', feature: 'Period Lock', subFeature: 'Close',
    title: 'Close empty period (no P&L entries): status = "closed", no JE',
    type: 'Edge', priority: 'P2', role: 'Superadmin',
    precondition: 'Open period with zero posted JEs.',
    steps: '1. Click Close Period\n2. Confirm',
    expected: 'Period status = "closed". closingJEId = null (no JE needed).',
  },
  {
    id: 'AC-PER-009', module: 'Accounting', feature: 'Period Lock', subFeature: 'Reopen',
    title: 'Reopen closed period: reason < 10 chars → "no_reason" error',
    type: 'Negative', priority: 'P0', role: 'Superadmin',
    precondition: 'Closed period exists.',
    steps: '1. Click Reopen\n2. Enter "too short"\n3. Confirm',
    expected: '"no_reason" error. Modal stays open. Period remains closed.',
  },
  {
    id: 'AC-PER-010', module: 'Accounting', feature: 'Period Lock', subFeature: 'Reopen',
    title: 'Reopen closed period: creates reversal of closing JE',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Closed period with closingJEId.',
    steps: '1. Click Reopen\n2. Enter valid reason\n3. Confirm',
    expected: 'Period status = "open". Reversal JE created. closingJEId = null.',
  },
  {
    id: 'AC-PER-011', module: 'Accounting', feature: 'Period Lock', subFeature: 'Lock Block',
    title: 'Posting JE in locked period blocked (role = admin)',
    type: 'Negative', priority: 'P0', role: 'Admin',
    precondition: 'Period locked. Date within locked period.',
    steps: '1. Post balanced JE with date in locked period as admin',
    expected: '"period_locked" error shown. JE NOT created.',
  },
  {
    id: 'AC-PER-012', module: 'Accounting', feature: 'Period Lock', subFeature: 'Lock Block',
    title: 'Developer can post JE in locked period (bypass)',
    type: 'Role', priority: 'P1', role: 'Developer',
    precondition: 'Period locked.',
    steps: '1. Post balanced JE with locked period date as developer',
    expected: 'JE created and posted successfully.',
  },
  {
    id: 'AC-PER-013', module: 'Accounting', feature: 'Period Lock', subFeature: 'FY Switch',
    title: 'FY selector switches between fiscal years',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'Multiple FYs exist.',
    steps: '1. Select different FY from selector',
    expected: 'Table updates to show that FY\'s periods.',
  },
  {
    id: 'AC-PER-014', module: 'Accounting', feature: 'Period Lock', subFeature: 'Audit Log',
    title: 'Audit log tab shows lock/unlock/close/reopen actions',
    type: 'Positive', priority: 'P2', role: 'Superadmin',
    precondition: 'Period actions have been performed.',
    steps: '1. Click Audit Log tab',
    expected: 'Audit log table shows entries for soft_lock, lock, unlock, close, reopen actions.',
  },

  // ════════════════════════════════════════════════════
  //  07 — REPORTS
  // ════════════════════════════════════════════════════
  {
    id: 'AC-RPT-001', module: 'Accounting', feature: 'P&L Report', subFeature: 'Render',
    title: 'P&L renders Income, Expense sections and Net Profit row',
    type: 'UI', priority: 'P0', role: 'Admin',
    precondition: 'User on /pnl',
    steps: '1. Navigate to /pnl',
    expected: '"Income/Revenue" section, "Expense" section, "Net Profit/Loss" row. Date range controls visible.',
  },
  {
    id: 'AC-RPT-002', module: 'Accounting', feature: 'P&L Report', subFeature: 'Data',
    title: 'P&L calculates correct net profit',
    type: 'Positive', priority: 'P0', role: 'Admin',
    precondition: 'Posted income and expense JEs exist in the date range.',
    steps: '1. Set date range\n2. View Net Profit',
    expected: 'Net Profit = Total Income - Total Expenses. Values match sum of posted JE lines for income/expense accounts.',
  },
  {
    id: 'AC-RPT-003', module: 'Accounting', feature: 'Balance Sheet', subFeature: 'Render',
    title: 'Balance Sheet renders Assets, Liabilities, Equity sections',
    type: 'UI', priority: 'P0', role: 'Admin',
    precondition: 'User on /balance-sheet',
    steps: '1. Navigate to /balance-sheet',
    expected: 'Three sections: Assets, Liabilities, Equity. "As of" date input visible.',
  },
  {
    id: 'AC-RPT-004', module: 'Accounting', feature: 'Balance Sheet', subFeature: 'Balance Check',
    title: 'Assets = Liabilities + Equity (accounting equation)',
    type: 'Positive', priority: 'P0', role: 'Admin',
    precondition: 'Posted entries exist.',
    steps: '1. View balance sheet totals',
    expected: 'Total Assets = Total Liabilities + Total Equity.',
  },
  {
    id: 'AC-RPT-005', module: 'Accounting', feature: 'Trial Balance', subFeature: 'Render',
    title: 'Trial Balance: Dr total = Cr total',
    type: 'Positive', priority: 'P0', role: 'Admin',
    precondition: 'Posted JEs exist.',
    steps: '1. Navigate to /trial-balance\n2. Check totals row',
    expected: 'Total Debit row = Total Credit row.',
  },
  {
    id: 'AC-RPT-006', module: 'Accounting', feature: 'Trial Balance', subFeature: 'Filter',
    title: 'Hide zero-balance accounts toggle reduces row count',
    type: 'Positive', priority: 'P2', role: 'Admin',
    precondition: 'Some accounts have zero balance.',
    steps: '1. Check "hide zero balance"\n2. Count rows',
    expected: 'Fewer rows shown vs. all-accounts view.',
  },
  {
    id: 'AC-RPT-007', module: 'Accounting', feature: 'Cash Flow', subFeature: 'Render',
    title: 'Cash Flow page renders Operating activities section',
    type: 'UI', priority: 'P1', role: 'Admin',
    precondition: 'User on /cashflow',
    steps: '1. Navigate to /cashflow',
    expected: '"Operating Activities" section visible. Date controls present.',
  },
  {
    id: 'AC-RPT-008', module: 'Accounting', feature: 'Export', subFeature: 'Render',
    title: 'Export page renders report type selector and export button',
    type: 'UI', priority: 'P1', role: 'Admin',
    precondition: 'User on /export',
    steps: '1. Navigate to /export',
    expected: 'Format/type selector, date range, Export/Download button all visible.',
  },

  // ════════════════════════════════════════════════════
  //  08 — SETTINGS
  // ════════════════════════════════════════════════════
  {
    id: 'AC-SET-001', module: 'Accounting', feature: 'Settings', subFeature: 'Tabs',
    title: 'Settings page renders ≥3 tabs',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'User on /settings',
    steps: '1. Navigate to /settings',
    expected: 'At least 3 tabs visible. Save button present.',
  },
  {
    id: 'AC-SET-002', module: 'Accounting', feature: 'Settings', subFeature: 'General',
    title: 'General tab: base currency and FY start month fields visible',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'General tab active.',
    steps: '1. Click General tab',
    expected: '"Base Currency" input and "Fiscal Year Start Month" selector visible.',
  },
  {
    id: 'AC-SET-003', module: 'Accounting', feature: 'Settings', subFeature: 'Approval Limits',
    title: 'Approval tab: JE cap, Bill cap, L2 threshold fields visible',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'Approval tab.',
    steps: '1. Click Approval/Limits tab',
    expected: 'adminJeCap, adminBillCap, twoLevelApprovalThreshold fields all visible with current values.',
  },
  {
    id: 'AC-SET-004', module: 'Accounting', feature: 'Settings', subFeature: 'Save',
    title: 'Save settings shows success/error feedback',
    type: 'Positive', priority: 'P0', role: 'Superadmin',
    precondition: 'Settings page loaded.',
    steps: '1. Click Save',
    expected: '"Saved" or success indicator appears. No 500 error.',
  },
  {
    id: 'AC-SET-005', module: 'Accounting', feature: 'Settings', subFeature: 'Toggle',
    title: 'Custom Toggle component changes background color on click',
    type: 'UI', priority: 'P2', role: 'Superadmin',
    precondition: 'Features tab with toggle visible.',
    steps: '1. Note toggle background color\n2. Click toggle\n3. Note new color',
    expected: 'Background color changes (e.g. grey → #6366f1 indigo). State tracked in React state.',
  },

  // ════════════════════════════════════════════════════
  //  09 — DASHBOARD
  // ════════════════════════════════════════════════════
  {
    id: 'AC-DSH-001', module: 'Accounting', feature: 'Dashboard', subFeature: 'KPI Cards',
    title: 'Dashboard renders 4 KPI cards: Revenue, Expenses, Net Profit, Outstanding AP',
    type: 'UI', priority: 'P0', role: 'Admin',
    precondition: 'User on /accounting/premium',
    steps: '1. Navigate to /accounting/premium',
    expected: '4 KPI cards visible with labels. Values shown in ₹ format.',
  },
  {
    id: 'AC-DSH-002', module: 'Accounting', feature: 'Dashboard', subFeature: 'Delta',
    title: 'KPI delta shows % change or "✦ New this period" when prev=0',
    type: 'UI', priority: 'P1', role: 'Admin',
    precondition: 'Some KPIs have prev-period data; others do not.',
    steps: '1. View KPI deltas',
    expected: 'Non-zero prev: shows "▲ X.X% vs prev period". Zero prev: shows "✦ New this period".',
  },
  {
    id: 'AC-DSH-003', module: 'Accounting', feature: 'Dashboard', subFeature: 'Cashflow Chart',
    title: 'Cashflow chart renders SVG when data exists',
    type: 'UI', priority: 'P1', role: 'Admin',
    precondition: 'Cash/bank account JEs posted.',
    steps: '1. View cashflow section on dashboard',
    expected: 'AreaChart SVG rendered via recharts. Legend shows cashflow series.',
  },
  {
    id: 'AC-DSH-004', module: 'Accounting', feature: 'Dashboard', subFeature: 'Pending Section',
    title: 'Pending approvals section shows count and list',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'At least one pending approval.',
    steps: '1. View dashboard',
    expected: '"Pending Approvals" section shows pending items. Links to approval detail.',
  },

  // ════════════════════════════════════════════════════
  //  10 — EDGE CASES
  // ════════════════════════════════════════════════════
  {
    id: 'AC-EDG-001', module: 'Accounting', feature: 'Edge Cases', subFeature: 'Modal UX',
    title: 'AcModal closes on ESC key press',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'Any modal is open (e.g. Add Account).',
    steps: '1. Open modal\n2. Press ESC key',
    expected: 'Modal closes without saving.',
  },
  {
    id: 'AC-EDG-002', module: 'Accounting', feature: 'Edge Cases', subFeature: 'Modal UX',
    title: 'AcModal closes on backdrop click',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'Any modal is open.',
    steps: '1. Open modal\n2. Click outside the modal dialog',
    expected: 'Modal closes without saving.',
  },
  {
    id: 'AC-EDG-003', module: 'Accounting', feature: 'Edge Cases', subFeature: 'Alert UX',
    title: 'AcAlert dismisses on ✕ click',
    type: 'UI', priority: 'P2', role: 'Superadmin',
    precondition: 'Success alert visible (e.g. after Reseed).',
    steps: '1. Click ✕ on alert',
    expected: 'Alert disappears.',
  },
  {
    id: 'AC-EDG-004', module: 'Accounting', feature: 'Edge Cases', subFeature: 'Double Submit',
    title: 'Double-clicking Post Entry does not create duplicate JE',
    type: 'Edge', priority: 'P0', role: 'Superadmin',
    precondition: 'Balanced entry ready to post.',
    steps: '1. Click Post Entry twice rapidly',
    expected: 'Exactly one JE created. useTransition prevents re-submit while pending.',
  },
  {
    id: 'AC-EDG-005', module: 'Accounting', feature: 'Edge Cases', subFeature: 'Empty Table',
    title: 'AcTable shows empty-state placeholder when no rows',
    type: 'UI', priority: 'P2', role: 'Superadmin',
    precondition: 'Filtered to a date range with no entries.',
    steps: '1. Filter journal to future date range (2099)',
    expected: 'Empty state shown (no data message or empty tbody).',
  },
  {
    id: 'AC-EDG-006', module: 'Accounting', feature: 'Edge Cases', subFeature: 'Narration Length',
    title: 'Narration 500 characters saved without error',
    type: 'Edge', priority: 'P2', role: 'Superadmin',
    precondition: 'New JE form.',
    steps: '1. Enter 500-char narration\n2. Balance and save draft',
    expected: 'Draft saved successfully. No truncation error.',
  },
  {
    id: 'AC-EDG-007', module: 'Accounting', feature: 'Edge Cases', subFeature: 'Zero Amount JE',
    title: 'JE with all-zero amounts: Post button disabled',
    type: 'Negative', priority: 'P0', role: 'Superadmin',
    precondition: 'New JE form, no amounts entered.',
    steps: '1. Do not fill any debit/credit\n2. Inspect Post button',
    expected: 'Post button disabled. "empty_entry" would be returned by server if submitted.',
  },
  {
    id: 'AC-EDG-008', module: 'Accounting', feature: 'Edge Cases', subFeature: 'Live Totals',
    title: 'Totals footer updates live as amounts entered',
    type: 'UI', priority: 'P1', role: 'Superadmin',
    precondition: 'New JE form.',
    steps: '1. Type 3000 in Dr column of line 1\n2. Check tfoot',
    expected: 'Total Dr shows 3,000 immediately without page reload.',
  },
];

// ─── Build Worksheet ──────────────────────────────────────────────────────────
const HEADERS = [
  'Test Case ID', 'Module', 'Feature', 'Sub-Feature', 'Title',
  'Type', 'Priority', 'Role', 'Precondition',
  'Test Steps', 'Expected Result',
  'Actual Result', 'Status', 'Remarks',
];

type ColKey = typeof HEADERS[number];
const COL_WIDTHS: Record<string, number> = {
  'Test Case ID': 16,
  'Module': 14,
  'Feature': 20,
  'Sub-Feature': 22,
  'Title': 55,
  'Type': 12,
  'Priority': 10,
  'Role': 14,
  'Precondition': 35,
  'Test Steps': 50,
  'Expected Result': 55,
  'Actual Result': 30,
  'Status': 12,
  'Remarks': 30,
};

const rows = cases.map(tc => [
  tc.id,
  tc.module,
  tc.feature,
  tc.subFeature,
  tc.title,
  tc.type,
  tc.priority,
  tc.role,
  tc.precondition,
  tc.steps,
  tc.expected,
  '',   // Actual Result — filled during execution
  '',   // Status — Pass/Fail/Blocked/N.A.
  '',   // Remarks
]);

const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);

// Column widths
ws['!cols'] = HEADERS.map(h => ({ wch: COL_WIDTHS[h] ?? 20 }));

// Freeze header row
ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;

// Header style — bold, coloured
const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '4338CA' } },  // indigo-700
  alignment: { wrapText: true, vertical: 'center', horizontal: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  },
};

HEADERS.forEach((_, ci) => {
  const cellAddr = XLSX.utils.encode_cell({ r: 0, c: ci });
  if (ws[cellAddr]) ws[cellAddr].s = headerStyle;
});

// Priority colour mapping
const PRIORITY_COLORS: Record<string, string> = { P0: 'FEE2E2', P1: 'FEF9C3', P2: 'DCFCE7' };
const TYPE_COLORS: Record<string, string> = {
  'Positive': 'D1FAE5', 'Negative': 'FEE2E2', 'Edge': 'FEF3C7',
  'UI': 'DBEAFE', 'Role': 'EDE9FE',
};

rows.forEach((row, ri) => {
  const priority = row[6] as string;
  const type = row[5] as string;

  HEADERS.forEach((_, ci) => {
    const cellAddr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
    if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };

    let bgColor = 'FFFFFF';
    if (ci === 6 && PRIORITY_COLORS[priority]) bgColor = PRIORITY_COLORS[priority];
    if (ci === 5 && TYPE_COLORS[type]) bgColor = TYPE_COLORS[type];
    if (ri % 2 === 1 && bgColor === 'FFFFFF') bgColor = 'F8FAFC';

    ws[cellAddr].s = {
      alignment: { wrapText: true, vertical: 'top' },
      fill: { fgColor: { rgb: bgColor } },
      border: {
        top: { style: 'thin', color: { rgb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
        left: { style: 'thin', color: { rgb: 'E5E7EB' } },
        right: { style: 'thin', color: { rgb: 'E5E7EB' } },
      },
    };
  });
});

// ─── Summary Sheet ────────────────────────────────────────────────────────────
const features = [...new Set(cases.map(c => c.feature))];
const summaryCols = ['Feature', 'P0', 'P1', 'P2', 'Total', 'Positive', 'Negative', 'Edge/UI/Role'];
const summaryData = features.map(feat => {
  const sub = cases.filter(c => c.feature === feat);
  return [
    feat,
    sub.filter(c => c.priority === 'P0').length,
    sub.filter(c => c.priority === 'P1').length,
    sub.filter(c => c.priority === 'P2').length,
    sub.length,
    sub.filter(c => c.type === 'Positive').length,
    sub.filter(c => c.type === 'Negative').length,
    sub.filter(c => !['Positive','Negative'].includes(c.type)).length,
  ];
});
summaryData.push([
  'TOTAL',
  cases.filter(c => c.priority === 'P0').length,
  cases.filter(c => c.priority === 'P1').length,
  cases.filter(c => c.priority === 'P2').length,
  cases.length,
  cases.filter(c => c.type === 'Positive').length,
  cases.filter(c => c.type === 'Negative').length,
  cases.filter(c => !['Positive','Negative'].includes(c.type)).length,
]);

const wsSummary = XLSX.utils.aoa_to_sheet([summaryCols, ...summaryData]);
wsSummary['!cols'] = summaryCols.map(() => ({ wch: 16 }));

// ─── Write Workbook ───────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Test Cases');
XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

const outPath = path.join(__dirname, 'AccountingTestCases.xlsx');
XLSX.writeFile(wb, outPath, { bookType: 'xlsx', cellStyles: true });

console.log(`✅  Written: ${outPath}`);
console.log(`   Sheets: Test Cases (${cases.length} rows) + Summary`);
console.log(`   P0: ${cases.filter(c=>c.priority==='P0').length}  P1: ${cases.filter(c=>c.priority==='P1').length}  P2: ${cases.filter(c=>c.priority==='P2').length}`);
