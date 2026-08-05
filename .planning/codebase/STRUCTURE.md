# STRUCTURE.md — Directory Structure & Module Organization

> Auto-generated from `loanapp` codebase analysis

---

## Top-Level Structure

```
loanapp/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard layout group
│   │   ├── layout.tsx            # Shared dashboard layout (sidebar + topbar)
│   │   ├── dashboard/            # KPI dashboard page
│   │   ├── collection/           # Agent collection page (primary for agents)
│   │   ├── customers/            # Customer CRUD + list
│   │   ├── loans/                # Loan management
│   │   ├── penalties/            # Penalty management
│   │   ├── reports/              # Reports & analytics
│   │   ├── settings/             # App settings (penalty, system, branding)
│   │   ├── notifications/        # System notifications
│   │   ├── approvals/            # Agent approval request review
│   │   ├── subscription/         # Subscription management
│   │   ├── vehicles/             # Vehicle management (auto finance)
│   │   └── chits/                # Chit fund management
│   ├── admin/                    # Super admin only
│   │   ├── layout.tsx
│   │   ├── actions.ts            # Admin server actions
│   │   ├── users/                # Master user management
│   │   ├── branches/             # Branch CRUD (micro lending only)
│   │   └── billing/              # Platform billing
│   ├── borrower/                 # Borrower self-service portal (future)
│   │   ├── login/
│   │   └── dashboard/
│   ├── portal/                   # App selector (superadmin only)
│   │   ├── page.tsx
│   │   ├── AppSelectorClient.tsx
│   │   ├── actions.ts
│   │   └── billing/
│   ├── login/                    # Login page
│   │   └── page.tsx
│   ├── api/                      # API routes
│   │   ├── auth/[...nextauth]/   # NextAuth handler
│   │   ├── borrower/             # Borrower API
│   │   ├── collection/           # Collection API
│   │   ├── cron/                 # Cron job endpoints
│   │   ├── customers/            # Customer API
│   │   ├── dashboard/            # Dashboard data API
│   │   ├── export/               # Data export API
│   │   ├── files/                # File serving API
│   │   ├── health/               # Health check
│   │   ├── instalments/          # Instalment API
│   │   ├── loans/                # Loan API
│   │   ├── notifications/        # Notifications API
│   │   ├── packages/             # Loan package API
│   │   ├── penalties/            # Penalty API
│   │   ├── portal/               # Portal API
│   │   ├── reports/              # Reports API
│   │   ├── routes/               # Route API
│   │   ├── settings/             # Settings API
│   │   ├── upload/               # File upload API
│   │   ├── webhooks/razorpay/    # Razorpay webhook handler
│   │   └── approvals/            # Approval request API
│   ├── globals.css               # Global styles + design system
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Root page (redirects)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   └── Topbar.tsx            # Top navigation bar
│   ├── ui/
│   │   └── LogoutButton.tsx      # Logout component
│   └── Modal.tsx                 # Reusable modal
├── lib/                          # Business logic & utilities
│   ├── access.ts                 # Agent route access helpers
│   ├── apiAuth.ts                # API route authentication
│   ├── appConfig.ts              # App type configs (colors, names)
│   ├── auth.ts                   # NextAuth configuration
│   ├── borrowerAuth.ts           # Borrower authentication
│   ├── creditScore.ts            # Credit score calculation
│   ├── db.ts                     # Prisma singleton
│   ├── fileUpload.ts             # File upload handling
│   ├── i18n.ts                   # Internationalization
│   ├── logger.ts                 # Structured JSON logger
│   ├── moduleGate.ts             # Module access gating (subscription)
│   ├── paymentService.ts         # Payment processing
│   ├── penalties.ts              # Penalty calculation
│   ├── pii.ts                    # PII masking utilities
│   ├── plans.ts                  # Loan plan calculations
│   ├── rateLimit.ts              # MySQL-backed rate limiting
│   ├── razorpay.ts               # Razorpay SDK integration
│   ├── repayments.ts             # Repayment allocation logic
│   ├── serverActionAuth.ts       # Server action auth helpers
│   ├── sms.ts                    # SMS notification service
│   ├── subscription.ts           # Subscription access checks
│   ├── tenant.ts                 # Tenant resolution & settings
│   └── utils.ts                  # General utilities
├── prisma/
│   ├── schema.prisma             # Database schema (25+ models)
│   ├── seed.ts                   # Production seed script
│   ├── seed_demo.ts              # Demo data seed
│   └── generated-client/         # Generated Prisma client
├── tests/                        # Test files
│   ├── repaymentAllocation.test.ts
│   ├── security.test.ts
│   ├── authDatabase.test.ts
│   ├── proxyPublicPaths.test.ts
│   ├── uiAssets.test.ts
│   └── collectionAction.test.ts
├── i18n/                         # Internationalization resources
├── types/                        # TypeScript type definitions
├── public/                       # Static assets
├── docs/                         # Documentation
├── database/                     # Database utilities
├── middleware.ts                 # Next.js middleware
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint configuration
├── package.json                  # Dependencies & scripts
└── .env / .env_prod / .env.local # Environment variables
```

---

## Module Breakdown

### App Router Pages (`app/`)

| Route Group | Purpose | Key Files |
|-------------|---------|-----------|
| `(dashboard)/` | Main application with shared layout | `layout.tsx` provides Sidebar + Topbar |
| `admin/` | Super admin platform management | `actions.ts` for user/branch/billing CRUD |
| `borrower/` | Borrower self-service (future) | Separate auth flow |
| `portal/` | App selector for superadmin | Cookie-based app switching |
| `login/` | Authentication entry point | TOTP 2FA support |
| `api/` | REST API endpoints | 21 route groups |

### Business Logic (`lib/`)

| Module | Responsibility |
|--------|---------------|
| `auth.ts` | NextAuth config, credentials provider, JWT callbacks, 2FA |
| `tenant.ts` | Subdomain→tenant resolution, settings CRUD, branding |
| `db.ts` | PrismaClient singleton (globalThis caching) |
| `repayments.ts` | Payment allocation across instalments |
| `penalties.ts` | Penalty calculation based on tenant settings |
| `rateLimit.ts` | MySQL-backed distributed rate limiting |
| `subscription.ts` | Tenant subscription plan enforcement |
| `razorpay.ts` | Razorpay payment gateway integration |
| `fileUpload.ts` | File upload with sharp image processing |
| `serverActionAuth.ts` | Server action authentication helpers |
| `access.ts` | Agent route assignment queries |
| `moduleGate.ts` | Feature gating based on subscription tier |
| `paymentService.ts` | Payment processing orchestration |
| `creditScore.ts` | Customer credit score calculation |
| `pii.ts` | PII data masking for display |
| `plans.ts` | Loan plan/instalment calculations |
| `sms.ts` | SMS notification delivery |
| `i18n.ts` | Internationalization utilities |
| `logger.ts` | Structured JSON logging |
| `apiAuth.ts` | API route authentication middleware |
| `borrowerAuth.ts` | Borrower-specific auth flow |
| `utils.ts` | General utility functions |
| `appConfig.ts` | App type configuration (colors, icons, names) |

### API Routes (`app/api/`)

| Route | Purpose |
|-------|---------|
| `/api/auth/[...nextauth]` | NextAuth handler |
| `/api/collection/*` | Collection data endpoints |
| `/api/cron/*` | Scheduled job endpoints (penalties, cleanup) |
| `/api/customers/*` | Customer CRUD API |
| `/api/dashboard/*` | Dashboard KPI data |
| `/api/export/*` | CSV/PDF data export |
| `/api/files/*` | File serving |
| `/api/health` | Health check endpoint |
| `/api/instalments/*` | Instalment management |
| `/api/loans/*` | Loan CRUD and operations |
| `/api/notifications/*` | Notification management |
| `/api/packages/*` | Loan package CRUD |
| `/api/penalties/*` | Penalty management |
| `/api/reports/*` | Report generation |
| `/api/routes/*` | Route CRUD |
| `/api/settings/*` | Settings management |
| `/api/upload/*` | File upload endpoint |
| `/api/webhooks/razorpay` | Razorpay webhook handler |
| `/api/approvals/*` | Approval request API |
| `/api/borrower/*` | Borrower portal API |
| `/api/portal/*` | Super admin portal API |

---

## Key Patterns

### Server Actions vs API Routes

- **Server Actions**: Used for form submissions, mutations within React components
- **API Routes**: Used for external integrations (webhooks), cron jobs, and programmatic access

### Tenant Context Resolution

```
Request → middleware extracts subdomain slug
        → sets x-zolofund-tenant-slug header
        → server code calls getCurrentTenantId()
        → resolves from header or falls back to session tenant
        → all queries use this tenantId
```

### Layout Hierarchy

```
app/layout.tsx          (root: HTML shell, fonts, metadata)
  └── (dashboard)/layout.tsx  (sidebar + topbar wrapper)
        └── page components   (individual feature pages)
```
