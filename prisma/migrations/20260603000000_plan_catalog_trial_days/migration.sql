-- Add trial_days to subscription_plan_catalogs.
-- 0 = no trial (free/basic/business). Enterprise = 15 days full access.
ALTER TABLE `subscription_plan_catalogs`
  ADD COLUMN `trial_days` INT NOT NULL DEFAULT 0;
