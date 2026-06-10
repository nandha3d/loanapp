# HARD-04 — Replace `"LoanTrack"` Brand Name with `AppSetting`

**Priority:** 🟡 MEDIUM  
**Category:** Hardcoded Values — Branding  
**Effort:** 45 min

---

## Problem

The string `"LoanTrack"` is hardcoded in at least 6 files:

- `app/api/v1/auth/forgot-password/route.ts:36` — email subject: `"Your LoanTrack password reset code"`
- `lib/auth.ts` (TOTP issuer) — `issuer: "LoanTrack"`
- Email templates in `lib/notify/channels/email.ts` — footer/header branding
- Various page titles in layout files

For a white-labelled multi-tenant SaaS, each tenant should see their own brand name (e.g., "Samurai Finance", "KreditBee MFI").

---

## AppSetting Key

| Key | Default | Description |
|-----|---------|-------------|
| `brand_name` | `LoanTrack` | Displayed in emails, TOTP issuer, page titles |
| `support_email` | `support@loantrack.in` | Shown in email footers |

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Grep all occurrences

```
grep -rn "LoanTrack" app/ lib/ --include="*.ts" --include="*.tsx" --include="*.html"
```

Collect the full list.

### Step 2 — Update `forgot-password/route.ts`

File: `app/api/v1/auth/forgot-password/route.ts`

Before sending the email, load the brand name:

```typescript
import { getSetting } from '@/lib/settings';

// Inside POST handler, after validating email:
const brandName = (await getSetting(user.tenantId, 'brand_name')) ?? 'LoanTrack';

await sendEmail(
  user.tenantId,
  email,
  `Your ${brandName} password reset code`,  // ← dynamic
  `<p>Hi ${user.name ?? ''},</p>
   <p>Your password reset code is: <strong ...>${otp}</strong></p>
   <p>This code expires in 10 minutes.</p>
   <p>If you did not request this, ignore this email.</p>`,
  ...
);
```

### Step 3 — Update TOTP issuer in `lib/auth.ts`

Find the TOTP issuer configuration. It likely looks like:

```typescript
issuer: 'LoanTrack',
```

Replace with a per-tenant lookup. Since TOTP issuers are set once at setup and stored in the authenticator app, this should only be changed with a migration warning. For now, make it configurable:

```typescript
// lib/auth.ts — inside the TOTP config
issuer: process.env.TOTP_ISSUER ?? 'LoanTrack',
```

Then add `TOTP_ISSUER=YourBrandName` to `.env`. This is a reasonable compromise since TOTP issuer changes require users to re-register their TOTP device.

### Step 4 — Update email templates

In `lib/notify/channels/email.ts`, find any hardcoded `LoanTrack` in email headers/footers. Replace with the `brand_name` AppSetting, passed as a parameter.

If the email template function signature is:
```typescript
export async function sendEmail(tenantId, to, subject, html, ...)
```

The function already has `tenantId` — add a lookup at the start:

```typescript
const brandName = (await getSetting(tenantId, 'brand_name')) ?? 'LoanTrack';
// Use brandName in footer/header templates
```

### Step 5 — Layout `<title>` tags

In `app/layout.tsx` and tenant-specific layouts, replace:

```tsx
<title>LoanTrack</title>
// or
metadata: { title: 'LoanTrack Dashboard' }
```

With a server-side fetch or a fallback from the session:

```tsx
const brandName = session?.user?.brandName ?? 'LoanTrack';
// metadata.title = `${brandName} Dashboard`
```

Add `brandName` to the NextAuth session JWT in `lib/auth.ts` callbacks (fetch once on login, same as `currency_symbol`).

---

## Verification

1. Set `brand_name = "Samurai Finance"` for a test tenant
2. Trigger a password reset → email subject shows `"Your Samurai Finance password reset code"`
3. `npx tsc --noEmit` → 0 errors
