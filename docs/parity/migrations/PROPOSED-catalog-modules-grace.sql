-- ============================================================================
-- PROPOSED MIGRATION — NOT APPLIED. Review + sign-off required (Rule 2).
-- ============================================================================
-- Purpose: move the last two hardcoded plan attributes (enabled module slugs
-- and grace-period days) out of lib/plans.ts PLAN_FEATURES and into the
-- subscription_plan_catalog table, so pricing is 100% DB-driven.
--
-- Until this is applied, lib/planCatalog.ts#getPlanLimits resolves
-- enabledModules + gracePeriodDays from PLAN_FEATURES as a documented fallback
-- (see the two TODO(gated-migration) lines there).
--
-- Additive only: two nullable columns with safe defaults. No drops/renames.
-- Backward compatible — existing rows keep working; code keeps falling back
-- until the columns are populated.
--
-- Apply procedure (after sign-off):
--   1. Add matching fields to prisma/schema.prisma SubscriptionPlanCatalog:
--        enabledModules  String? @map("enabled_modules") @db.LongText
--        gracePeriodDays Int     @default(7) @map("grace_period_days")
--   2. npx prisma migrate dev --name catalog_modules_grace   (generates this SQL)
--   3. Update prisma/seed-pricing.ts to set enabledModules + gracePeriodDays per plan.
--   4. Flip the two TODO(gated-migration) lines in lib/planCatalog.ts to read
--      row.enabledModules / row.gracePeriodDays.
--   5. Re-run seed; verify webhook writes catalog modules on renewal.
-- ----------------------------------------------------------------------------

ALTER TABLE `subscription_plan_catalog`
  ADD COLUMN `enabled_modules` LONGTEXT NULL,
  ADD COLUMN `grace_period_days` INT NOT NULL DEFAULT 7;

-- Backfill from current plan ladder (edit if the ladder changes):
UPDATE `subscription_plan_catalog` SET `enabled_modules` = '["microlending"]', `grace_period_days` = 3  WHERE `plan` = 'free';
UPDATE `subscription_plan_catalog` SET `enabled_modules` = '["microlending"]', `grace_period_days` = 7  WHERE `plan` = 'collector';
UPDATE `subscription_plan_catalog` SET `enabled_modules` = '["microlending","autofinance"]', `grace_period_days` = 7  WHERE `plan` = 'basic';
UPDATE `subscription_plan_catalog` SET `enabled_modules` = '["microlending","autofinance","chitfunds","goldloan"]', `grace_period_days` = 14 WHERE `plan` = 'business';
UPDATE `subscription_plan_catalog` SET `enabled_modules` = '["microlending","autofinance","chitfunds","goldloan"]', `grace_period_days` = 30 WHERE `plan` = 'enterprise';
