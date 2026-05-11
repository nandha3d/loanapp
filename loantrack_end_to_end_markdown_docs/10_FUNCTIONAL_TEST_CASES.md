# Functional Test Cases

## 1. Login and Landing

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-FUNC-001 | Admin login | Login with admin credentials | Redirects to `/dashboard` |
| LT-FUNC-002 | Agent login | Login with agent credentials | Redirects to `/collection` |
| LT-FUNC-003 | Invalid login | Enter invalid password | Error is shown, no session created |
| LT-FUNC-004 | Inactive user login | Set user status inactive and login | Login blocked |
| LT-FUNC-005 | Superadmin login | Login as superadmin | Redirects to `/portal` |

---

## 2. Customer Management

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-CUST-001 | Admin creates customer | Admin opens `/customers/new`, enters details and submits | Customer created with `active` status |
| LT-CUST-002 | Agent creates customer | Agent creates customer | Customer created with `pending_review` status |
| LT-CUST-003 | Customer code generation | Create multiple customers | Codes increment based on counter |
| LT-CUST-004 | Customer list search | Search by name/phone/customer code | Matching customers shown |
| LT-CUST-005 | Route filter | Filter by route | Only that route's customers shown |
| LT-CUST-006 | Admin edits customer | Admin edits name/phone/address | Changes saved |
| LT-CUST-007 | Agent direct edit blocked | Agent attempts edit URL | Redirected or blocked |
| LT-CUST-008 | Customer profile view | Open customer detail | Loans, cheques, route and profile displayed |
| LT-CUST-009 | Agent customer scope | Agent opens customer list | Only assigned/shared route customers shown |
| LT-CUST-010 | Pending customer approval | Admin approves pending customer | Status changes to `active` |

---

## 3. Approval Workflow

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-APP-001 | Agent requests edit | Agent submits customer edit request | ApprovalRequest created with `pending` |
| LT-APP-002 | Admin approves request | Admin approves pending request | Customer changes applied |
| LT-APP-003 | Admin rejects request | Admin rejects request with notes | Request status becomes `rejected`, customer unchanged |
| LT-APP-004 | Agent views own requests | Agent opens `/approvals` | Only own requests are shown |
| LT-APP-005 | Approval audit | Approve/reject request | AuditLog entry created |

---

## 4. Loan Management

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-LOAN-001 | Create loan from customer | Admin creates loan | Loan and instalments created |
| LT-LOAN-002 | Loan code generation | Create two loans | Loan codes increment correctly |
| LT-LOAN-003 | Package selection | Select loan package | Principal, deduction, tenure and instalment populate |
| LT-LOAN-004 | Daily schedule | Create daily loan with 5 tenure | 5 instalments created for 5 dates |
| LT-LOAN-005 | Weekly schedule | Create weekly loan | Due dates are 7 days apart |
| LT-LOAN-006 | Monthly schedule | Create monthly loan | Due dates are monthly |
| LT-LOAN-007 | Mark instalment paid | Admin marks instalment paid | Instalment status paid; loan total updates |
| LT-LOAN-008 | Partial payment | Pay less than due | Instalment status partial |
| LT-LOAN-009 | Close loan | Admin closes loan | Loan status closed and closedAt set |
| LT-LOAN-010 | Agent blocked from loan | Agent opens `/loans` | Redirected to collection |

---

## 5. Collection

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-COLL-001 | Agent sees today schedule | Agent opens `/collection` | Due instalments displayed |
| LT-COLL-002 | Agent sees missed instalments | Make due date in past | Missed/past due entries displayed first |
| LT-COLL-003 | Submit full payment | Agent submits full due amount | CollectionEntry created; instalment paid |
| LT-COLL-004 | Submit partial payment | Agent submits lower amount | Instalment partial |
| LT-COLL-005 | Duplicate paid collection blocked | Try to collect paid instalment again | Error shown |
| LT-COLL-006 | Daily collection total | Submit multiple collections same day | DailyCollection totals update |
| LT-COLL-007 | Agent identity stamped | Submit collection as Agent A | CollectionEntry agentId = Agent A |
| LT-COLL-008 | Shared route access | Assign Agent A and B same route | Both agents can collect route customers |
| LT-COLL-009 | Unassigned route blocked | Agent attempts unassigned route instalment | Error / not visible |

---

## 6. Penalties

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-PEN-001 | Penalty list loads | Admin opens `/penalties` | Penalties displayed with KPIs |
| LT-PEN-002 | Filter by status | Select pending/settled/waived | Matching records shown |
| LT-PEN-003 | Route filter | Select route | Only route penalties shown |
| LT-PEN-004 | Settle penalty | Enter settlement amount | settledAmount and status update |
| LT-PEN-005 | Waive penalty | Enter waive amount | waivedAmount and status update |
| LT-PEN-006 | Agent blocked | Agent opens `/penalties` | Redirected to collection |

---

## 7. Reports

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-REP-001 | Reports load | Admin opens `/reports` | KPIs and tables load |
| LT-REP-002 | Date filter | Select date range | Reports recalculate |
| LT-REP-003 | Route filter | Select route | Reports scoped to route |
| LT-REP-004 | Agent filter | Select agent | Performance data scoped |
| LT-REP-005 | Collection efficiency | Compare due vs collected | Percentage is correct |
| LT-REP-006 | Agent blocked | Agent opens `/reports` | Redirected to collection |

---

## 8. Settings

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-SET-001 | Settings page loads | Admin opens `/settings` | No build/runtime error |
| LT-SET-002 | Create route | Admin creates route | Route appears in list |
| LT-SET-003 | Delete route | Admin deletes route | Route removed if no dependencies/blocking rules satisfied |
| LT-SET-004 | Create package | Admin creates loan package | Package appears in list |
| LT-SET-005 | Delete package | Admin deletes package | Package removed if valid |
| LT-SET-006 | Save penalty settings | Update penalty amount | Setting saved |
| LT-SET-007 | Save system settings | Update currency symbol/prefix | Setting saved and reflected |
| LT-SET-008 | Create app agent | Admin creates agent | Agent created in same app |
| LT-SET-009 | Agent blocked | Agent opens `/settings` | Redirected to collection |

---

## 9. Admin Portal

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-ADM-001 | App selector | Superadmin opens `/portal` | App cards displayed |
| LT-ADM-002 | Switch app | Select Auto Finance | Active app cookie set and dashboard scoped |
| LT-ADM-003 | Master users | Superadmin opens `/admin/users` | Users listed |
| LT-ADM-004 | Create admin | Superadmin creates admin | User created with selected app/branch |
| LT-ADM-005 | Deactivate user | Superadmin deactivates user | User cannot login |
| LT-ADM-006 | Branch management | Superadmin/developer opens `/admin/branches` | Branches listed |

---

## 10. Notifications

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-NOT-001 | Notifications page | User opens `/notifications` | App-scoped notifications shown |
| LT-NOT-002 | Mark one read | Click mark read | Only that notification marked read |
| LT-NOT-003 | Mark all read | Click mark all | Only current app notifications marked read |
| LT-NOT-004 | Unread API | Call unread count API | Returns scoped unread count |
