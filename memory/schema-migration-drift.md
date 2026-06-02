---
name: schema-migration-drift
description: Recurring bug pattern — models/columns added to schema.prisma without an accompanying migration
metadata:
  type: project
---

This project has a recurring pattern of editing `prisma/schema.prisma` (new models or columns) **without** generating the matching migration in `prisma/migrations/`. Because `prisma migrate deploy` only applies existing migration files (it does not diff schema vs DB), the table/column is silently absent in production.

Confirmed instances:
- `mobile_refresh_tokens` (MobileRefreshToken) — had no migration; refresh-token rotation silently returned 401. Fixed 2026-06-02 in `20260602000000_add_mobile_refresh_tokens`.
- `customer_pin_confirmed` columns — earlier instance, noted in `20260529000100_add_collection_pin_fields/migration.sql` comment.

**Why:** the code defensively try/catches the missing-table error (see `rotateRefreshToken` in [[secret-env-var-convention]] file lib/api/v1-auth.ts), so failures are silent rather than loud.

**How to apply:** after any schema.prisma change, verify a migration exists (`grep` the mapped table name in `prisma/migrations/`). Hand-authored migrations are fine — `migrate deploy` computes the checksum at apply time. Match the existing MySQL format: `VARCHAR(191)`, `DATETIME(3)`, `utf8mb4_unicode_ci`.
