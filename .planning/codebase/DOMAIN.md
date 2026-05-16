# DOMAIN.md — Business Domain Models & Relationships

> Auto-generated from `loanapp` codebase analysis

---

## Domain Overview

LoanTrack manages three financial service verticals on a shared multi-tenant platform:

```
┌─────────────────────────────────────────────────────┐
│                    Tenant (SaaS)                     │
│  ┌──────────────┬──────────────┬──────────────────┐  │
│  │ MicroLending │ AutoFinance  │   ChitFunds      │  │
│  │              │              │                  │  │
│  │ Customers    │ Customers    │ ChitGroups       │  │
│  │ Loans        │ Vehicles     │ ChitMembers      │  │
│  │ Collections  │ Loans (EMI)  │ ChitAuctions     │  │
│  │ Penalties    │ Repo Flags   │ Subscriptions    │  │
│  │ Routes       │              │ Dividends        │  │
│  │ Branches     │              │                  │  │
│  └──────────────┴──────────────┴──────────────────┘  │
│                                                      │
│  Shared: Users, AuditLogs, Settings, Notifications,  │
│          Subscriptions, BillingInvoices, Webhooks    │
└─────────────────────────────────────────────────────┘
```

---

## Core Entities

### Tenant
**Purpose:** SaaS tenant organization — the top-level isolation boundary

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `name` | String | Display name (default: "LoanTrack") |
| `slug` | String | Subdomain identifier (unique) |
| `status` | String | `active`, `suspended` |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- Has many: `Branch`, `User`, `Customer`, `Loan`, `Route`, `ChitGroup`, `Vehicle`, `DailyCollection`, `SystemNotification`, `NotificationTemplate`, `AuditLog`, `AppSetting`, `BillingInvoice`
- Has one: `TenantSubscription`

---

### User
**Purpose:** Platform user with role-based access

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `branchId` | String? | FK → Branch (ML only) |
| `username` | String | Login identifier (unique per tenant) |
| `phone` | String | Login alternative (unique per tenant) |
| `passwordHash` | String | bcrypt hashed |
| `totpSecret` | String? | 2FA secret |
| `role` | String | `superadmin`, `admin`, `agent`, `borrower` |
| `appType` | String | `microlending`, `autofinance`, `chitfunds` |
| `status` | String | `active`, `inactive`, `suspended` |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- Belongs to: `Tenant`, `Branch?`
- Has many: `AuditLog`, `DailyCollection`, `CollectionEntry`, `Loan` (created), `Penalty` (settled), `ApprovalRequest` (requested/reviewed), `RouteAgent`
- Has many: `Customer` (as assigned agent)

---

### Branch
**Purpose:** Physical branch location (Micro Lending only)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `name` | String | Branch name |
| `code` | String? | Branch code (unique per tenant) |
| `status` | String | `active`, `inactive` |

**Relations:**
- Belongs to: `Tenant`
- Has many: `User`, `Customer`, `Loan`, `Route`, `DailyCollection`, `ChitGroup`

---

### Customer
**Purpose:** Borrower/customer record

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `customerCode` | String | Auto-generated code (unique per tenant) |
| `name` | String | Full name |
| `phone` | String | Contact number |
| `aadharNumber` | String? | Indian national ID (PII) |
| `pan` | String? | Tax ID (PII) |
| `routeId` | String? | FK → Route |
| `agentId` | String? | FK → User (assigning agent) |
| `kycStatus` | String | `pending`, `verified`, `rejected` |
| `status` | String | `active`, `pending_review`, `overdue`, `closed`, `blacklisted` |
| `appType` | String | Application type |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- Belongs to: `Tenant`, `Branch?`, `Route?`, `User?` (agent)
- Has many: `Loan`, `Penalty`, `Guarantor`, `KycDocument`, `SecurityCheque`, `Vehicle`, `CollectionEntry`, `ChitMember`
- Has one: `User?` (linked borrower account)

---

### Loan
**Purpose:** Active loan agreement

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `loanCode` | String | Auto-generated code (unique per tenant) |
| `customerId` | String | FK → Customer |
| `packageId` | String? | FK → LoanPackage |
| `loanType` | String | `cheque`, `emi`, other |
| `principal` | Decimal(12,2) | Loan principal amount |
| `deduction` | Decimal(12,2) | Upfront deduction |
| `deductionType` | String | `fixed`, `percentage` |
| `disbursed` | Decimal(12,2) | Actual disbursed amount |
| `frequency` | String | Payment frequency (weekly, monthly, etc.) |
| `tenure` | Int | Number of instalments |
| `startDate` | Date | Loan start date |
| `endDate` | Date? | Expected end date |
| `perInstalment` | Decimal(12,2) | Amount per instalment |
| `penaltyRate` | Decimal(12,2) | Penalty rate for missed payments |
| `totalPayable` | Decimal(12,2) | Total amount payable |
| `status` | String | `active`, `overdue`, `closed`, `settled` |
| `paidCount` | Int | Number of paid instalments |
| `totalInstalments` | Int | Total instalment count |
| `totalCollected` | Decimal(12,2) | Total amount collected so far |
| `npaStatus` | String? | Non-performing asset classification |
| `npaClassifiedAt` | DateTime? | NPA classification date |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- Belongs to: `Tenant`, `Customer`, `LoanPackage?`, `Branch?`, `User?` (creator), `Guarantor?`
- Has many: `Instalment`, `Payment`, `Penalty`, `LoanCollateral`, `SecurityCheque`, `CollectionEntry`
- Has one: `Vehicle?`

---

### Instalment
**Purpose:** Individual payment due within a loan

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `loanId` | String | FK → Loan |
| `instalmentNo` | Int | Sequence number (unique per loan) |
| `dueDate` | Date | Payment due date |
| `dueAmount` | Decimal(12,2) | Expected amount |
| `receivedAmount` | Decimal(12,2) | Amount received (default 0) |
| `status` | String | `upcoming`, `paid`, `missed`, `partial` |
| `paymentMode` | String? | `cash`, `upi`, `cheque`, `bank_transfer` |
| `penaltyApplied` | Boolean | Whether penalty has been applied |
| `lockedAt` | DateTime? | Lock timestamp (prevents edits) |

**Relations:**
- Belongs to: `Loan`
- Has one: `CollectionEntry?`
- Has many: `Penalty`, `PaymentAllocation`

---

## Collection Domain

### DailyCollection
**Purpose:** Daily collection ledger for an agent

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `agentId` | String | FK → User |
| `routeId` | String? | FK → Route |
| `date` | Date | Collection date |
| `totalExpected` | Decimal(12,2) | Expected collection total |
| `totalCollected` | Decimal(12,2) | Actual collected total |
| `entriesCount` | Int | Number of entries |
| `status` | String | `open`, `locked` |
| `lockedAt` | DateTime? | Lock timestamp |

**Uniqueness:** `[tenantId, appType, agentId, date]`

**Relations:**
- Belongs to: `Tenant`, `User` (agent), `Route?`, `Branch?`
- Has many: `CollectionEntry`

---

### CollectionEntry
**Purpose:** Individual payment record within a daily collection

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `collectionId` | String | FK → DailyCollection |
| `customerId` | String | FK → Customer |
| `loanId` | String | FK → Loan |
| `dueAmount` | Decimal(12,2) | Expected amount |
| `receivedAmount` | Decimal(12,2) | Actual amount received |
| `paymentMode` | String | `cash`, `upi`, `cheque`, `bank_transfer` |
| `agentId` | String | FK → User (collecting agent) |
| `isLocked` | Boolean | Default true (prevents edits) |

**Relations:**
- Belongs to: `Tenant`, `DailyCollection`, `Customer`, `Loan`, `User` (agent)
- Links to: `Instalment?` (one-to-one via unique collectionEntryId)

---

## Penalty Domain

### Penalty
**Purpose:** Late payment penalty record

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `loanId` | String | FK → Loan |
| `customerId` | String | FK → Customer |
| `missedDays` | Int | Number of missed days |
| `grossPenalty` | Decimal(12,2) | Calculated penalty amount |
| `settledAmount` | Decimal(12,2) | Amount actually settled |
| `waivedAmount` | Decimal(12,2) | Amount waived |
| `status` | String | `pending`, `settled`, `waived`, `partial` |
| `settledById` | String? | FK → User (who settled) |
| `settledAt` | DateTime? | Settlement timestamp |
| `instalmentId` | String? | FK → Instalment |

**Relations:**
- Belongs to: `Loan`, `Customer`, `Instalment?`, `User?` (settler)

---

## Route & Agent Assignment

### Route
**Purpose:** Geographic collection route

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `branchId` | String? | FK → Branch |
| `name` | String | Route name |
| `assignedAgentId` | String? | FK → User (primary agent) |
| `status` | String | `active`, `inactive` |
| `appType` | String | Application type |

**Relations:**
- Belongs to: `Tenant`, `Branch?`, `User?` (primary agent)
- Has many: `Customer`, `DailyCollection`, `RouteAgent`

---

### RouteAgent
**Purpose:** Many-to-many route-agent assignment (shared routes)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `routeId` | String | FK → Route |
| `agentId` | String | FK → User |
| `isPrimary` | Boolean | Primary agent flag |

**Uniqueness:** `[routeId, agentId]`

---

## Auto Finance Domain

### Vehicle
**Purpose:** Vehicle record for auto finance loans

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `customerId` | String | FK → Customer |
| `registrationNo` | String | Vehicle registration (unique per tenant+appType) |
| `make` | String | Manufacturer |
| `model` | String | Model name |
| `year` | Int? | Manufacturing year |
| `engineNo` | String? | Engine number |
| `chassisNo` | String? | Chassis number |
| `insuranceExpiry` | Date? | Insurance expiration |
| `rcDocPath` | String? | RC document path |
| `insurancePath` | String? | Insurance document path |
| `status` | String | `active`, `repossessed`, `closed` |
| `repoFlag` | Boolean | Repossession flag |
| `repoFlaggedAt` | DateTime? | Repossession timestamp |
| `repoFlaggedById` | String? | FK → User |
| `vehicleType` | String | `two_wheeler`, `four_wheeler`, etc. |
| `loanId` | String? | FK → Loan (unique) |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- Belongs to: `Tenant`, `Customer`, `Loan?`, `User?` (repo flagger)

---

## Chit Fund Domain

### ChitGroup
**Purpose:** Chit fund group

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `branchId` | String? | FK → Branch |
| `name` | String | Group name |
| `chitValue` | Decimal(14,2) | Total chit value |
| `monthlyContrib` | Decimal(14,2) | Monthly contribution per member |
| `totalMembers` | Int | Maximum members |
| `durationMonths` | Int | Group duration |
| `commissionPct` | Decimal(5,2) | Commission percentage (default 5%) |
| `startDate` | Date | Group start date |
| `status` | String | `active`, `completed`, `cancelled` |
| `deletedAt` | DateTime? | Soft delete |

**Relations:**
- Belongs to: `Tenant`, `Branch?`
- Has many: `ChitMember`, `ChitAuction`

---

### ChitMember
**Purpose:** Member of a chit group

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `chitGroupId` | String | FK → ChitGroup |
| `customerId` | String | FK → Customer |
| `memberNumber` | Int | Ticket number (unique per group) |
| `hasWon` | Boolean | Has won auction |
| `wonAt` | DateTime? | Auction win timestamp |

**Uniqueness:** `[chitGroupId, customerId]`, `[chitGroupId, memberNumber]`

**Relations:**
- Belongs to: `ChitGroup`, `Customer`
- Has many: `ChitSubscription`, `ChitAuction` (as winner)

---

### ChitAuction
**Purpose:** Monthly auction event for a chit group

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `chitGroupId` | String | FK → ChitGroup |
| `periodNumber` | Int | Auction period (unique per group) |
| `auctionDate` | Date | Auction date |
| `winnerMemberId` | String? | FK → ChitMember |
| `prizeAmount` | Decimal(14,2)? | Winner's prize amount |
| `bidDiscount` | Decimal(14,2)? | Bid discount amount |
| `commission` | Decimal(14,2)? | Commission deducted |
| `dividend` | Decimal(14,2)? | Dividend per member |
| `status` | String | `pending`, `completed`, `cancelled` |

**Relations:**
- Belongs to: `ChitGroup`, `ChitMember?` (winner)

---

### ChitSubscription
**Purpose:** Monthly subscription payment for a chit member

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `memberId` | String | FK → ChitMember |
| `periodNumber` | Int | Payment period |
| `dueDate` | Date | Due date |
| `dueAmount` | Decimal(14,2) | Expected amount |
| `paidAmount` | Decimal(14,2) | Amount paid (default 0) |
| `status` | String | `upcoming`, `paid`, `overdue` |
| `paidAt` | DateTime? | Payment timestamp |

**Relations:**
- Belongs to: `ChitMember`

---

## Subscription & Billing Domain

### TenantSubscription
**Purpose:** SaaS subscription plan for a tenant

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant (unique) |
| `plan` | String | `trial`, `starter`, `professional`, `enterprise` |
| `status` | String | `active`, `suspended`, `expired` |
| `maxActiveLoans` | Int | Loan limit (default 50) |
| `maxAgents` | Int | Agent limit (default 3) |
| `enabledModules` | JSON | Feature flags |
| `trialEndsAt` | DateTime? | Trial expiration |
| `currentPeriodEnd` | DateTime? | Current billing period end |
| `razorpaySubId` | String? | Razorpay subscription ID (unique) |
| `gracePeriodEnd` | DateTime? | Grace period end |

---

### BillingInvoice
**Purpose:** Platform billing invoice

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (CUID) | Primary key |
| `tenantId` | String | FK → Tenant |
| `subscriptionId` | String? | FK → TenantSubscription |
| `amount` | Decimal(12,2) | Base amount |
| `tax` | Decimal(12,2) | Tax amount |
| `total` | Decimal(12,2) | Total amount |
| `status` | String | `pending`, `paid`, `overdue` |
| `dueDate` | Date | Payment due date |
| `paidAt` | DateTime? | Payment timestamp |
| `razorpayId` | String? | Razorpay payment ID |
| `invoiceUrl` | String? | Invoice document URL |
| `billingPeriod` | String | Period identifier |

---

## Supporting Entities

| Entity | Purpose |
|--------|---------|
| **LoanPackage** | Predefined loan templates (principal, deduction, frequency, tenure, penalty rate) |
| **Guarantor** | Loan guarantor linked to customer with PII (aadhar, phone, address) |
| **KycDocument** | KYC document uploads (docType, fileName, filePath, fileSize) |
| **SecurityCheque** | Security cheque records (bankName, chequeNumber, amount, imagePath) |
| **LoanCollateral** | Collateral documents linked to loan (docType, fileName, filePath, description) |
| **ApprovalRequest** | Agent-to-admin approval workflow for customer edits |
| **AuditLog** | System-wide audit trail (tenantId, userId, action, entityType, oldValue, newValue) |
| **SystemNotification** | In-app notifications (type, title, message, link, isRead, expiresAt) |
| **NotificationTemplate** | Email/SMS templates (name, channel, subject, body, isActive) |
| **AppSetting** | Key-value tenant settings (key, value, group) |
| **RateLimit** | MySQL-backed rate limiting (key, count, windowStart, expiresAt) |
| **WebhookEvent** | Idempotency log for webhooks (provider, eventId, event, payload, status) |
| **Payment** | Payment records (loanId, amount, paymentMode, referenceNumber, status) |
| **PaymentAllocation** | Payment-to-instalment allocation (paymentId, instalmentId, amount) |
| **CronLock** | Distributed cron lock (id='penalty_accrual', lockedAt, expiresAt) |

---

## Entity Relationship Summary

```
Tenant 1───* Branch
Tenant 1───* User
Tenant 1───* Customer
Tenant 1───* Loan
Tenant 1───* Route
Tenant 1───* ChitGroup
Tenant 1───* Vehicle
Tenant 1───* DailyCollection
Tenant 1───1 TenantSubscription
Tenant 1───* BillingInvoice
Tenant 1───* AppSetting
Tenant 1───* AuditLog
Tenant 1───* SystemNotification
Tenant 1───* NotificationTemplate

Branch 1───* User
Branch 1───* Customer
Branch 1───* Loan
Branch 1───* Route
Branch 1───* DailyCollection
Branch 1───* ChitGroup

User (agent) 1───* Customer (assigned)
User (agent) 1───* DailyCollection
User (agent) 1───* CollectionEntry
User (agent) *───* Route (via RouteAgent)

Customer 1───* Loan
Customer 1───* Penalty
Customer 1───* Guarantor
Customer 1───* KycDocument
Customer 1───* SecurityCheque
Customer 1───* Vehicle
Customer 1───* CollectionEntry
Customer 1───* ChitMember

Loan 1───* Instalment
Loan 1───* Payment
Loan 1───* Penalty
Loan 1───* LoanCollateral
Loan 1───* SecurityCheque
Loan 1───* CollectionEntry
Loan 0..1───1 Vehicle

LoanPackage 1───* Loan

Route 1───* Customer
Route 1───* DailyCollection
Route *───* User (via RouteAgent)

ChitGroup 1───* ChitMember
ChitGroup 1───* ChitAuction

ChitMember 1───* ChitSubscription
ChitMember 0..1───* ChitAuction (as winner)

DailyCollection 1───* CollectionEntry

Instalment 1───* Penalty
Instalment 1───* PaymentAllocation
Instalment 0..1───1 CollectionEntry

Payment 1───* PaymentAllocation
```
