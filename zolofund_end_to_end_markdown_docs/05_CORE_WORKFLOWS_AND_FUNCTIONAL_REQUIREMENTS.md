# Core Workflows and Functional Requirements

## 1. Login and Role-Based Landing

### Flow

```text
User enters username/phone + password
  ↓
System validates active user and password
  ↓
JWT session is created with role, tenantId, appType, branchId
  ↓
Redirect based on role
```

### Expected Redirects

| Role | Landing Page |
|---|---|
| `developer` | `/portal` |
| `superadmin` | `/portal` |
| `admin` | `/dashboard` |
| `agent` | `/collection` |

### Acceptance Criteria

- Invalid username/password shows a clear error.
- Inactive/suspended user cannot login.
- Session contains role, appType, tenantId and branchId.
- Role-based landing works consistently.

---

## 2. App Selector Workflow

### Users

- Developer
- Super Admin

### Flow

```text
Open /portal
  ↓
View Micro Lending / Auto Finance / Chit Funds cards
  ↓
Select one app
  ↓
System stores active_app_type cookie
  ↓
Redirect to /dashboard
```

### Rules

- Admin/agent cannot access `/portal`.
- Cookie value must be validated against allowed app types.
- App-specific theme and data scope should update after selection.

---

## 3. Customer Creation Workflow

### Admin Creates Customer

```text
Admin opens /customers/new
  ↓
Enters customer details, route, agent, cheques, guarantors, documents
  ↓
Submit
  ↓
System generates customer code
  ↓
Customer saved as active
  ↓
Redirect to customer profile
```

### Agent Creates Customer

```text
Agent opens /customers/new
  ↓
Enters customer details
  ↓
Submit
  ↓
System generates customer code
  ↓
Customer saved as pending_review
  ↓
Admin reviews and approves
  ↓
Customer becomes active
```

### Functional Requirements

| Requirement | Details |
|---|---|
| Customer code | Generated using configurable prefix and counter |
| Agent creation status | `pending_review` |
| Admin creation status | `active` |
| KYC documents | Store via production upload service, not only filename |
| Security cheques | Store bank, cheque number, image path |
| Guarantors | Store name, phone, relation, address and photo |

---

## 4. Customer Edit and Approval Workflow

### Target Flow

```text
Agent views customer profile
  ↓
Agent clicks Request Edit
  ↓
Agent enters requested changes and reason
  ↓
ApprovalRequest created with status pending
  ↓
Admin reviews request
  ↓
Admin approves or rejects
  ↓
If approved, safe changes are applied
  ↓
Audit log records approval/rejection
```

### Required Rules

- Agents cannot directly edit customers.
- Admin can directly edit customers within app/branch scope.
- Approval changes must use field allow-list.
- Approval review must verify target entity belongs to same tenant and app.

---

## 5. Loan Creation Workflow

### Flow

```text
Admin opens /loans/new
  ↓
Selects customer and package or enters custom loan values
  ↓
System calculates disbursed amount and per instalment
  ↓
System generates loan code
  ↓
System creates Loan and Instalment schedule
  ↓
Audit log records loan creation
  ↓
Redirect to loan detail
```

### Functional Requirements

| Field | Rule |
|---|---|
| Principal | Required, positive amount |
| Deduction | Required, cannot exceed principal |
| Disbursed | principal - deduction |
| Frequency | daily / weekly / monthly |
| Tenure | Positive integer |
| Per instalment | principal / tenure, with rounding rules documented |
| Loan code | Generated using prefix + counter |
| Customer | Must belong to same tenant/app/branch scope |
| Package | Must belong to same tenant/app |
| Agent | Inherited from route/customer assignment |

---

## 6. Collection Workflow

### Agent Collection Flow

```text
Agent opens /collection
  ↓
System loads missed instalments and today's due instalments
  ↓
Agent selects customer instalment
  ↓
Agent enters received amount, payment mode, remarks
  ↓
System creates CollectionEntry
  ↓
System updates Instalment
  ↓
System updates Loan totals
  ↓
System updates DailyCollection totals
  ↓
Audit log records collection
```

### Rules

- Agent can collect only for assigned/shared route customers.
- Collection entry must stamp `agentId` from session.
- Agent identity must never come from form data.
- If amount >= due amount → status `paid`.
- If amount < due amount → status `partial`.
- Already paid instalment cannot be collected again.
- Daily collection should be scoped by tenant, app, agent and date.

---

## 7. Shared Route Workflow

### Target Flow

```text
Admin creates route
  ↓
Admin assigns Agent A and Agent B to same route using RouteAgent
  ↓
Both agents open /collection
  ↓
Both see customers on that route
  ↓
Either agent can collect
  ↓
CollectionEntry stores actual collecting agentId
```

### Required Implementation

- Use `RouteAgent` as source of route assignment.
- Keep `Route.assignedAgentId` only as optional primary/backward compatibility field.
- Collection query should use route IDs from `RouteAgent`.
- Reports should show both primary route owner and actual collecting agent.

---

## 8. Penalty Workflow

### Current Manual Flow

```text
Loan detail / penalty page
  ↓
Admin settles or waives penalty
  ↓
Penalty status updates
  ↓
Audit log created
```

### Required Future Automation

```text
Scheduled job runs after midnight
  ↓
Find overdue unpaid instalments
  ↓
Mark instalment as missed
  ↓
Calculate missed days and penalty amount
  ↓
Create/update Penalty record
  ↓
Create notification for admin/agent/customer
```

---

## 9. Reports Workflow

Reports should support:

- Collection efficiency by date range.
- Defaulter aging buckets.
- Penalty accrued/settled/waived.
- Loan disbursement summary.
- Agent performance.
- Route filters and agent filters.

Rules:

- Reports must filter by tenant and app.
- ML admin reports must filter by branch.
- Agent should not access reports.

---

## 10. Settings Workflow

Settings modules:

| Settings Area | Purpose |
|---|---|
| System settings | App name, currency, date/time, code prefixes |
| Penalty settings | Per-day penalty, grace period, cap |
| Routes | Create/delete routes and assign agents |
| Loan packages | Create/delete package templates |
| Users | Admin creates agents within own app |

Rules:

- Agent cannot access settings.
- Admin can create only agents in own app.
- Superadmin can manage app users from master user management.
- Settings changes must be audit-logged.

---

## 11. Notification Workflow

Expected flow:

```text
Event occurs: payment overdue, loan created, collection missed
  ↓
System creates SystemNotification with tenantId + appType
  ↓
Users see notifications in /notifications
  ↓
Unread count API returns scoped count
  ↓
User marks read or mark all read
```

Required change:

- Add `appType` to `SystemNotification`.
- All notification reads/updates must filter by `tenantId + appType`.
