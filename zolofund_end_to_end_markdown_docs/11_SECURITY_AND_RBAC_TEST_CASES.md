# Security and RBAC Test Cases

## 1. Access Control Tests

| Test ID | Role | Attempt | Expected Result |
|---|---|---|---|
| LT-SEC-001 | Anonymous | Open `/dashboard` | Redirect to `/login` |
| LT-SEC-002 | Agent | Open `/dashboard` | Redirect to `/collection` |
| LT-SEC-003 | Agent | Open `/loans` | Redirect to `/collection` |
| LT-SEC-004 | Agent | Open `/reports` | Redirect to `/collection` |
| LT-SEC-005 | Agent | Open `/penalties` | Redirect to `/collection` |
| LT-SEC-006 | Agent | Open `/settings` | Redirect to `/collection` |
| LT-SEC-007 | Agent | Open `/customers/new?edit=<id>` | Redirect/block; direct edit not allowed |
| LT-SEC-008 | Admin | Open `/portal` | Redirect to `/dashboard` |
| LT-SEC-009 | Admin | Open `/admin/users` | Redirect/block |
| LT-SEC-010 | Superadmin | Open `/admin/users` | Allowed |
| LT-SEC-011 | Superadmin | Open `/admin/branches` | Allowed if aligned to spec |

---

## 2. App Isolation Tests

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-APPISO-001 | Customer isolation | Create customer in Micro Lending, switch to Auto Finance | Customer not visible in Auto Finance |
| LT-APPISO-002 | Loan isolation | Create loan in Micro Lending, query in Chit Funds | Loan not visible |
| LT-APPISO-003 | Route isolation | Create route in Micro Lending | Route not visible in other apps |
| LT-APPISO-004 | Package isolation | Create package in Auto Finance | Package not visible in Micro Lending |
| LT-APPISO-005 | Notification isolation | Create notification in app A | App B user does not see it |
| LT-APPISO-006 | API customer isolation | Call `/api/customers` after app switch | Only current app customers returned |
| LT-APPISO-007 | API loan isolation | Call `/api/loans` after app switch | Only current app loans returned |

---

## 3. Branch Isolation Tests

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-BR-001 | Branch customer isolation | Branch A admin opens customers | Branch B customers not shown |
| LT-BR-002 | Branch loan isolation | Branch A admin opens loans | Branch B loans not shown |
| LT-BR-003 | Branch reports isolation | Branch A admin opens reports | Branch B totals excluded |
| LT-BR-004 | Branch route isolation | Branch A admin opens settings | Branch B routes excluded |
| LT-BR-005 | Superadmin branch view | Superadmin opens dashboard | Can view all branches within selected app |

---

## 4. Agent Route Isolation Tests

| Test ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| LT-AG-001 | Assigned route customer visible | Assign Agent A to Route 1 | Route 1 customers visible to Agent A |
| LT-AG-002 | Unassigned route customer hidden | Customer belongs to Route 2 | Agent A cannot see customer |
| LT-AG-003 | Shared route customer visible | Assign Agent A and B to Route 1 | Both see Route 1 customer |
| LT-AG-004 | Removed agent loses access | Remove Agent B from Route 1 | Agent B no longer sees Route 1 customers |
| LT-AG-005 | Direct URL protection | Agent opens unassigned customer URL | Not found or redirected |
| LT-AG-006 | Collection protection | Agent posts unassigned instalment ID | Server returns unauthorized/error |

---

## 5. Server Action Tampering Tests

| Test ID | Attack | Expected Result |
|---|---|---|
| LT-TAMP-001 | Agent posts edit customer form with customer ID | Server blocks direct edit |
| LT-TAMP-002 | User changes hidden appType in loan form | Server ignores form appType |
| LT-TAMP-003 | User posts different tenantId if added manually | Server ignores user-provided tenantId |
| LT-TAMP-004 | Agent posts instalment ID from another route | Server blocks |
| LT-TAMP-005 | Admin deletes route from another app | Server returns access denied |
| LT-TAMP-006 | Admin deletes package from another app | Server returns access denied |
| LT-TAMP-007 | Approval request contains unsafe field like `status` | Unsafe field ignored |
| LT-TAMP-008 | Superadmin tries to create developer if not allowed | Block unless current user is developer |

---

## 6. API Security Tests

| Test ID | API | Scenario | Expected Result |
|---|---|---|---|
| LT-API-001 | `/api/customers` | No session | 401 unauthorized |
| LT-API-002 | `/api/customers` | Agent session | Only agent assigned/shared route customers |
| LT-API-003 | `/api/customers` | App switch | Current app customers only |
| LT-API-004 | `/api/loans` | Agent session | 403 or no access |
| LT-API-005 | `/api/loans` | Admin session | Current app/branch loans only |
| LT-API-006 | `/api/notifications` | No session | 401 unauthorized |
| LT-API-007 | `/api/notifications` | Valid session | Current app unread count only |

---

## 7. Data Integrity Tests

| Test ID | Scenario | Expected Result |
|---|---|---|
| LT-DATA-001 | Duplicate customer code | Database prevents duplicate per tenant |
| LT-DATA-002 | Duplicate loan code | Database prevents duplicate per tenant |
| LT-DATA-003 | Duplicate route-agent assignment | Database unique constraint prevents duplicate |
| LT-DATA-004 | Duplicate instalment number in loan | Database prevents duplicate |
| LT-DATA-005 | Collection entry linked to one instalment | Unique relation prevents duplicate mapping |
| LT-DATA-006 | Paid instalment collected again | Server blocks |
| LT-DATA-007 | Delete route with customers | Should block or handle safely based on rule |

---

## 8. Audit Log Tests

| Test ID | Action | Expected Audit |
|---|---|---|
| LT-AUD-001 | Customer create | `action=create`, `entityType=customer` |
| LT-AUD-002 | Loan create | `action=create`, `entityType=loan` |
| LT-AUD-003 | Collection submit | `action=create`, `entityType=collection` |
| LT-AUD-004 | Penalty settle | `action=update`, `entityType=penalty` |
| LT-AUD-005 | Approval approve | `action=approve`, `entityType=approval` |
| LT-AUD-006 | Approval reject | `action=reject`, `entityType=approval` |
| LT-AUD-007 | Route delete | `action=delete`, `entityType=route` |
| LT-AUD-008 | App switch | `action=switch_app`, `entityType=app` |
