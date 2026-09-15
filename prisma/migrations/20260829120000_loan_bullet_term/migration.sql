-- Bullet term: a loan whose principal comes back in ONE payment on a date
-- measured in days, rather than across n instalments at a cadence.
--
-- Additive and a no-op for every existing row (STABLE-2): `term_type` defaults
-- to 'scheduled', which is the shape every loan written before this migration
-- already has, and `term_days` stays NULL for all of them. Nothing reads
-- `term_days` unless `term_type` = 'bullet'.

ALTER TABLE `loans`
  ADD COLUMN `term_type` VARCHAR(191) NOT NULL DEFAULT 'scheduled',
  ADD COLUMN `term_days` INT NULL;
