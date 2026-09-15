> **SUPERSEDED — do not follow.** This file was auto-generated and has drifted from the codebase.
> The current, binding reference is `ENGINEERING_REFERENCE.md` at the repo root. Kept only as history.

# CONVENTIONS.md — Coding Standards & Patterns

> Auto-generated from `loanapp` codebase analysis

---

## TypeScript Conventions

### Type Definitions
- Types defined inline for simple cases
- Dedicated `types/` directory for shared types
- Prisma-generated types used directly from `@prisma/client`
- `AppType` union type: `'microlending' | 'autofinance' | 'chitfunds'`

### Null Safety
- Optional chaining (`?.`) used throughout
- Nullish coalescing (`??`) for fallbacks
- Explicit null checks before property access

### Type Casting
- Session user casting via `as SessionUserContext` pattern
- Request type casting for NextAuth: `request as unknown as Request`

---

## Naming Conventions

### Database (Prisma)
- **Models**: PascalCase (`Customer`, `DailyCollection`)
- **Fields**: camelCase in Prisma, mapped to snake_case in DB via `@map()`
- **Tables**: snake_case via `@@map("table_name")`
- **Relations**: Named relations for multiple FKs to same model:
  ```prisma
  createdBy   User? @relation("LoanCreator")
  settledBy   User? @relation("PenaltySettler")
  ```

### File Naming
- **Components**: PascalCase (`Modal.tsx`, `Sidebar.tsx`)
- **Lib modules**: camelCase (`rateLimit.ts`, `serverActionAuth.ts`)
- **Test files**: camelCase with `.test.ts` suffix (`repaymentAllocation.test.ts`)
- **API routes**: kebab-case directory names (`/api/webhooks/razorpay/`)

### Variable Naming
- Constants: UPPER_SNAKE_CASE (`AGENT_BLOCKED`, `SUPERADMIN_ONLY`)
- Config objects: UPPER_SNAKE_CASE (`APP_CONFIGS`)
- Functions: camelCase (`getCurrentTenantId`, `checkRateLimit`)
- Boolean variables: `is*`, `has*`, `can*` prefix (`isLocked`, `hasWon`)

---

## Authentication Patterns

### Session Access
```typescript
const session = await auth();
const user = session?.user as SessionUserContext;
const role = user?.role;
const tenantId = user?.tenantId;
```

### Tenant Context in Queries
```typescript
const tenantId = await getDefaultTenantId();
const appType = await getUserAppType();

// Always filter by both
const customers = await prisma.customer.findMany({
  where: { tenantId, appType },
});
```

### Server Action Auth
```typescript
// Pattern from lib/serverActionAuth.ts
const session = await auth();
if (!session?.user) throw new Error('Unauthorized');
const tenantId = await getCurrentTenantId();
const appType = await getUserAppType();
```

---

## Database Patterns

### Soft Deletes
- `deletedAt DateTime?` field on key models (Tenant, User, Customer, Loan, Vehicle, ChitGroup)
- Queries should exclude soft-deleted records where applicable

### Audit Logging
- Every mutation logs to `AuditLog` model
- Fields: `tenantId`, `userId`, `action`, `entityType`, `entityId`, `oldValue`, `newValue`, `ipAddress`, `userAgent`

### Idempotency
- `WebhookEvent` model with unique `[provider, eventId]` constraint
- Prevents duplicate webhook processing

### Rate Limiting
- MySQL-backed via `RateLimit` model
- Atomic upsert with `INSERT ... ON DUPLICATE KEY UPDATE`
- Composite key pattern: `"login:ip:127.0.0.1"`, `"route:upload:ip"`

---

## Error Handling

### Server Actions
```typescript
// Return pattern for server actions
return { success: false, error: 'Human-readable message' };
// or
return { success: true, data: result };
```

### API Routes
- 401 for unauthorized
- 404 for not found (also used for cross-app isolation — no info leak)
- 500 for server errors with generic message

### Redirects
- Not authenticated → `redirect('/login')`
- Not authorized (agent) → `redirect('/collection')`
- Not authorized (admin) → `redirect('/dashboard')`

---

## Styling Conventions

### CSS Architecture
- Vanilla CSS in `globals.css`
- CSS custom properties for theming (`--primary`, `--primary-dark`, etc.)
- App-type-specific themes via `getAppThemeCSS()` in `lib/appConfig.ts`

### Icons
- Material Icons Outlined
- Used via `<span className="material-icons-outlined">icon_name</span>`

### Fonts
- Inter (Google Fonts)
- Loaded via Next.js font optimization

---

## Security Conventions

### Input Validation
- Zod for server action input validation
- Never trust client-provided `tenantId` or `appType` — always resolve from session

### PII Handling
- `lib/pii.ts` provides masking utilities
- Aadhar, PAN numbers masked in display

### CSP & Headers
- Strict Content-Security-Policy in `next.config.ts`
- `X-Frame-Options: DENY`
- `Cache-Control: no-store` on sensitive pages (login)

### Rate Limiting
- Dual-layer: per-IP + per-username for login
- Configurable via env vars: `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_MS`, `LOGIN_IP_MAX`

---

## Git & Code Organization

### Environment Files
- `.env` — Base configuration
- `.env.local` — Local overrides (gitignored)
- `.env_prod` — Production values

### Prisma Workflow
1. Edit `schema.prisma`
2. `npm run db:generate` — Generate client
3. `npm run db:migrate` — Create and apply migration (dev)
4. `npm run db:deploy` — Apply migrations (production)

### Build Process
```bash
npm run build  # Runs: npx prisma generate && next build
```
Prisma generate is part of build to ensure client is up-to-date.
