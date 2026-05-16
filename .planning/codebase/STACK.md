# STACK.md — Tech Stack & Dependencies

> Auto-generated from `loanapp` codebase analysis

---

## Core Framework

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js (App Router) | 16.2.6 | Server Actions, Turbopack, standalone output |
| UI Library | React | 19.2.4 | Server + Client Components |
| Language | TypeScript | 5.x | Strict mode, `tsconfig.tsbuildinfo` present |
| Runtime | Node.js | 20.x (target) | `@types/node: ^20` |

## Database & ORM

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| ORM | Prisma Client | 5.22.0 | Driver adapters preview, multi-openssl binary targets |
| Database | MySQL | 8.x | Single DB, multi-tenant row-level isolation |
| Migration | Prisma Migrate | 5.22.0 | `prisma migrate dev/deploy` |

## Authentication & Security

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Auth Framework | NextAuth (Auth.js) | 5.0.0-beta.31 | JWT strategy, credentials provider |
| Password Hashing | bcryptjs | 3.0.3 | Async compare in auth flow |
| 2FA/TOTP | otplib | 13.4.0 | `verifySync` for TOTP validation |
| QR Code Generation | qrcode | 1.5.4 | TOTP QR setup for users |
| Validation | Zod | 4.4.3 | Input validation (server actions) |

## Payments & Integrations

| Layer | Technology | Notes |
|-------|-----------|-------|
| Payment Gateway | Razorpay | Subscription billing, webhook handling |
| SMS | Custom (`lib/sms.ts`) | Notification delivery |

## PDF & Documents

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| PDF Generation | @react-pdf/renderer | 4.5.1 | Receipts, reports, exports |
| Image Processing | sharp | 0.34.5 | File upload optimization |

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| `eslint` + `eslint-config-next` | Linting (v9) |
| `tsx` | TypeScript execution for tests & scripts |
| `@types/bcryptjs` | bcryptjs type definitions |
| `@types/qrcode` | qrcode type definitions |
| `@types/react` / `@types/react-dom` | React 19 types |

## Build & Scripts

```
dev:          next dev --turbopack
build:        npx prisma generate && next build
start:        next start
lint:         eslint
test:*        tsx tests/*.test.ts (5 test scripts)
db:*          prisma commands (validate, generate, migrate, seed, studio, reset)
```

## Deployment

| Aspect | Configuration |
|--------|--------------|
| Output Mode | `standalone` |
| Target Platform | Hostinger (SSL termination, reverse proxy) |
| Environment Files | `.env`, `.env_prod`, `.env.local` |

## Key Architectural Dependencies

- **Multi-tenancy**: Subdomain-based routing via middleware
- **Role-based access**: `superadmin`, `admin`, `agent`, `borrower`
- **App types**: `microlending`, `autofinance`, `chitfunds`
- **Shared database**: Row-level isolation via `tenantId` + `appType`
