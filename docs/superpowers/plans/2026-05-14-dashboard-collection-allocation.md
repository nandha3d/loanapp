# Dashboard Collection Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct repayment allocation across loan schedules and rebuild dashboard/collection views from the corrected outstanding and overdue data.

**Architecture:** Add a pure repayment allocation helper that converts total loan collections into per-instalment status. Payment actions will create a collection entry, then reallocate all instalments for the loan oldest-first so partials, overpayments, overdue, and future advances are reflected consistently. Dashboard and collection pages will query allocated instalments instead of relying on loan status or penalty rows alone.

**Tech Stack:** Next.js 16 App Router, Prisma, Server Actions, TypeScript, CSS/SVG charts without adding a chart dependency.

---

### Task 1: Repayment Allocation Test

**Files:**
- Create: `tests/repaymentAllocation.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add test command**

Run repayment tests with `npm run test:repayments`.

- [ ] **Step 2: Write failing test**

Verify the example: day 1 pays 44, day 2 pays 110, day 3 pays 500 against 110-per-day instalments. Expected result: instalments 1-5 paid, instalment 6 partial with 104, remaining future instalments upcoming.

### Task 2: Allocation Helper

**Files:**
- Create: `lib/repayments.ts`

- [ ] **Step 1: Implement pure allocation**

Sort instalments by due date and instalment number. Apply total collected oldest-first. Return received amount, status, overdue amount, and days overdue.

- [ ] **Step 2: Implement DB reallocator**

Inside a transaction, sum collection entries for a loan, apply allocation, update all instalments, then update loan `paidCount`, `totalCollected`, and `status`.

### Task 3: Payment Mutations

**Files:**
- Modify: `app/(dashboard)/collection/actions.ts`
- Modify: `app/(dashboard)/loans/[id]/actions.ts`
- Modify: `app/api/collection/route.ts`

- [ ] **Step 1: Replace selected-row increment logic**

Create the collection/payment entry, then call the DB reallocator for the loan.

- [ ] **Step 2: Add allocation remarks**

When a submitted payment covers multiple instalments, store a readable note in the collection entry and audit payload.

### Task 4: Dashboard Metrics and Charts

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Calculate live receivable metrics**

Use instalments to calculate today expected, today collected, overdue count, overdue amount, and route performance.

- [ ] **Step 2: Add charts**

Render a collection trend chart and route overdue/collection chart with CSS/SVG-friendly markup.

### Task 5: Collection Page Split and Filters

**Files:**
- Modify: `app/(dashboard)/collection/page.tsx`
- Modify: `app/(dashboard)/collection/CollectionClient.tsx`

- [ ] **Step 1: Split datasets**

Pass `todayInstalments` and `overdueInstalments` separately.

- [ ] **Step 2: Add filters**

Client filters by due date, customer, route/line, and status.

- [ ] **Step 3: Show overdue details**

Show days overdue and outstanding amount after allocation.

### Task 6: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run tests**

Run `npm run test:repayments` and `npm run test:security`.

- [ ] **Step 2: Run build**

Run `npm run build`.
