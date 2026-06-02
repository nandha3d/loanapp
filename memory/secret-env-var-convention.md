---
name: secret-env-var-convention
description: How session/JWT secrets resolve across web, middleware, borrower, and mobile auth
metadata:
  type: project
---

The session secret is read under multiple names across modules. As of 2026-06-02 all of them fall back across the same set, so setting **either** `AUTH_SECRET` **or** `NEXTAUTH_SECRET` makes web + middleware + borrower portal + mobile all work:

- `lib/env.ts` (boot validation) — requires `AUTH_SECRET || NEXTAUTH_SECRET`.
- `lib/auth.ts` / `middleware.ts` — `AUTH_SECRET || NEXTAUTH_SECRET`.
- `lib/borrowerAuth.ts` — `NEXTAUTH_SECRET || AUTH_SECRET`.
- `lib/api/v1-auth.ts` (mobile JWT) — `MOBILE_JWT_SECRET || NEXTAUTH_SECRET || AUTH_SECRET`.

`MOBILE_JWT_SECRET` is OPTIONAL (recommended to isolate mobile tokens from the web session secret, but not required).

**Why:** previously `env.ts` hard-required `AUTH_SECRET` while the shipped `.env` only set `NEXTAUTH_SECRET` (boot crash), and mobile required `MOBILE_JWT_SECRET || NEXTAUTH_SECRET` while deploy/README only set `AUTH_SECRET` (all mobile auth threw). No single documented config worked for both web and mobile.

**How to apply:** don't reintroduce a hard requirement on one specific secret name. Relates to [[schema-migration-drift]].
