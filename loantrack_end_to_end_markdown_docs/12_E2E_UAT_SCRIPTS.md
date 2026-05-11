# End-to-End UAT Scripts

## Script 1 — Admin Micro Lending Happy Path

**User:** Admin  
**Goal:** Validate customer onboarding, loan creation and reports.

### Steps

1. Login as `admin`.
2. Confirm landing page is `/dashboard`.
3. Go to `/settings`.
4. Create a route named `Test Route A`.
5. Create an agent named `Test Agent A`.
6. Go to `/customers/new`.
7. Create customer:
   - Name: `Test Customer A`
   - Phone: `9876500001`
   - Route: `Test Route A`
   - Agent: `Test Agent A`
8. Confirm customer profile opens.
9. Confirm customer status is `active`.
10. Click `New Loan`.
11. Create loan:
    - Principal: `10000`
    - Deduction: `1000`
    - Frequency: `daily`
    - Tenure: `5`
    - Penalty: `50`
12. Confirm loan detail opens.
13. Confirm 5 instalments are created.
14. Go to `/reports`.
15. Confirm disbursement count and amount updated.

### Expected Result

- Customer, loan and instalments are created successfully.
- Dashboard and reports reflect new data.
- Audit logs exist for customer and loan creation.

---

## Script 2 — Agent Collection Happy Path

**User:** Agent  
**Goal:** Validate field agent collection.

### Preconditions

- Agent is assigned to customer's route.
- Customer has active loan with due instalment today.

### Steps

1. Login as agent.
2. Confirm landing page is `/collection`.
3. Verify customer due instalment appears.
4. Click collect/pay action.
5. Enter received amount equal to due amount.
6. Select payment mode `cash` or `upi`.
7. Add remarks.
8. Submit.
9. Refresh collection page.
10. Login as admin.
11. Open loan detail.
12. Verify instalment is paid.
13. Verify loan total collected increased.
14. Verify daily collection total increased.

### Expected Result

- Collection entry is created.
- Instalment status changes to `paid`.
- Collecting agent ID is recorded.
- Audit log exists.

---

## Script 3 — Agent Creates Customer and Admin Approves

**User:** Agent then Admin  
**Goal:** Validate pending review workflow.

### Steps

1. Login as agent.
2. Open `/customers/new`.
3. Create customer `Pending Customer A`.
4. Confirm customer status is `pending_review`.
5. Logout.
6. Login as admin.
7. Open `/customers`.
8. Find `Pending Customer A`.
9. Click approve.
10. Confirm customer status changes to `active`.

### Expected Result

- Agent-created customer is not directly active.
- Admin approval activates customer.

---

## Script 4 — Agent Edit Request Workflow

**User:** Agent then Admin  
**Goal:** Validate customer edit approval request.

### Steps

1. Login as agent.
2. Open one assigned customer profile.
3. Click `Request Edit`.
4. Request phone/address change with reason.
5. Submit request.
6. Open `/approvals` as agent.
7. Confirm own request is visible as `pending`.
8. Logout and login as admin.
9. Open `/approvals`.
10. Review the request.
11. Approve request.
12. Open customer profile.
13. Confirm approved fields changed.

### Expected Result

- Agent cannot direct edit customer.
- Approval request is created and applied only after admin approval.
- Audit log records approval.

---

## Script 5 — Shared Route Collection

**User:** Admin, Agent A, Agent B  
**Goal:** Validate multiple agents collecting on same route.

### Steps

1. Login as admin.
2. Create route `Shared Route A`.
3. Assign Agent A and Agent B to `Shared Route A` using RouteAgent assignment.
4. Create customer under `Shared Route A`.
5. Create active loan with due instalment.
6. Login as Agent A.
7. Confirm customer appears in collection list.
8. Logout and login as Agent B.
9. Confirm same customer appears in collection list.
10. Agent B submits collection.
11. Admin opens loan detail.
12. Confirm collection entry says collected by Agent B.

### Expected Result

- Both agents can access shared route.
- Collection is stamped to actual collecting agent.

---

## Script 6 — RBAC Negative Journey

**User:** Agent  
**Goal:** Confirm agent cannot access restricted admin pages.

### Steps and Expected Results

| Step | Expected Result |
|---|---|
| Open `/dashboard` | Redirects to `/collection` |
| Open `/loans` | Redirects to `/collection` |
| Open `/reports` | Redirects to `/collection` |
| Open `/penalties` | Redirects to `/collection` |
| Open `/settings` | Redirects to `/collection` |
| Open `/admin/users` | Redirects to `/collection` or `/dashboard` based on middleware |
| Open `/customers/new?edit=<customerId>` | Blocked/redirected; no direct edit |

---

## Script 7 — App Switching and App Isolation

**User:** Super Admin  
**Goal:** Validate app switching and data isolation.

### Steps

1. Login as superadmin.
2. Confirm `/portal` opens.
3. Select Micro Lending.
4. Create or verify Micro Lending customer.
5. Return to `/portal`.
6. Select Auto Finance.
7. Open customers/loans/dashboard.
8. Confirm Micro Lending data is not visible.
9. Return to `/portal`.
10. Select Chit Funds.
11. Confirm app-specific data scope.

### Expected Result

- Active app changes based on selected app.
- Data is scoped to selected app.
- No cross-app customer/loan/package/route leakage.

---

## Script 8 — Penalty Settlement

**User:** Admin  
**Goal:** Validate penalty settlement and waiver.

### Steps

1. Prepare a loan with pending penalty.
2. Login as admin.
3. Open `/penalties`.
4. Filter by pending.
5. Select penalty and enter settlement amount.
6. Submit.
7. Confirm status updates to `settled` or `partial`.
8. Test waive flow for another penalty.

### Expected Result

- Penalty amounts update correctly.
- Status updates correctly.
- Audit log is created.

---

## Script 9 — Settings and Package Configuration

**User:** Admin  
**Goal:** Validate configurable settings.

### Steps

1. Login as admin.
2. Open `/settings`.
3. Update currency symbol.
4. Update customer code prefix.
5. Create a loan package.
6. Create a route.
7. Create an agent.
8. Create customer and verify new prefix/package availability.

### Expected Result

- Settings persist.
- New prefix/package/route is used by later forms.
- Agent is created in same app.

---

## Script 10 — Production Smoke Test

Run after deployment:

1. Open login page.
2. Login as admin.
3. Dashboard loads.
4. Customer list loads.
5. Loan list loads.
6. Collection page loads.
7. Reports page loads.
8. Settings page loads.
9. Logout.
10. Login as agent.
11. Agent lands on collection page.
12. Agent cannot open restricted pages.

Expected result: no runtime errors, redirects correct, data visible only within scope.
