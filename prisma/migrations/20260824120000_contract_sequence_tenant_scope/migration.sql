-- Re-key contract_sequences from (tenant, app_type, prefix) to (tenant, prefix)
-- and seed it from the loan codes already issued.
--
-- Two defects are repaired here:
--   1. The table shipped with current_value DEFAULT 0 and no backfill, so the
--      first origination after its deploy reissued DL00001 on top of loans the
--      old count-based generator had already created.
--   2. The counter was module-scoped while loans.loan_code is unique per tenant
--      (loans_tenant_id_loan_code_key), so two modules issued the same code.
-- Because the increment runs in the origination transaction, either collision
-- rolls the counter back -- origination stays wedged until the counter is moved
-- past the live data, which is what this migration does.
--
-- NOTHING IS DELETED. app_type is kept and merely widened to NULL: it becomes
-- informational (which module first created the counter) and is no longer part
-- of any key. Dropping it would have forced `prisma db push --accept-data-loss`
-- to destroy a column on a live database for no gain.
--
-- Loan rows are not touched. Codes already issued keep their values.

-- 1. Collapse the per-module counters into one row per (tenant, prefix),
--    keeping the highest value any module had reached. Must run before the
--    unique index below, which would otherwise fail on the duplicates.
CREATE TEMPORARY TABLE `contract_sequences_merged` AS
SELECT
  MIN(`id`)            AS `id`,
  `tenant_id`,
  `prefix`,
  MAX(`current_value`) AS `current_value`
FROM `contract_sequences`
GROUP BY `tenant_id`, `prefix`;

DELETE `cs` FROM `contract_sequences` `cs`
LEFT JOIN `contract_sequences_merged` `m` ON `m`.`id` = `cs`.`id`
WHERE `m`.`id` IS NULL;

UPDATE `contract_sequences` `cs`
JOIN `contract_sequences_merged` `m` ON `m`.`id` = `cs`.`id`
SET `cs`.`current_value` = `m`.`current_value`;

DROP TEMPORARY TABLE `contract_sequences_merged`;

-- 2. Re-key. app_type is widened to NULL rather than dropped, so no live column
--    is ever destroyed by this change.
ALTER TABLE `contract_sequences`
  DROP INDEX `contract_sequences_tenant_id_app_type_prefix_key`,
  MODIFY COLUMN `app_type` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `contract_sequences_tenant_id_prefix_key` (`tenant_id`, `prefix`);

-- 3. Seed from live loan codes. Only codes matching the generator's shape
--    (uppercase prefix + trailing digits) are considered; anything hand-entered
--    is ignored rather than guessed at. GREATEST keeps a counter that has
--    already run ahead of the data.
CREATE TEMPORARY TABLE `contract_sequences_seed` AS
SELECT
  `tenant_id`,
  REGEXP_REPLACE(`loan_code`, '[0-9]+$', '')                   AS `prefix`,
  MAX(CAST(REGEXP_SUBSTR(`loan_code`, '[0-9]+$') AS UNSIGNED)) AS `max_seq`
FROM `loans`
WHERE `loan_code` REGEXP '^[A-Z][A-Z0-9_-]*[0-9]+$'
GROUP BY `tenant_id`, REGEXP_REPLACE(`loan_code`, '[0-9]+$', '');

UPDATE `contract_sequences` `cs`
JOIN `contract_sequences_seed` `s`
  ON `s`.`tenant_id` = `cs`.`tenant_id` AND `s`.`prefix` = `cs`.`prefix`
SET `cs`.`current_value` = GREATEST(`cs`.`current_value`, `s`.`max_seq`),
    `cs`.`updated_at` = CURRENT_TIMESTAMP(3);

INSERT INTO `contract_sequences` (`id`, `tenant_id`, `app_type`, `prefix`, `current_value`, `created_at`, `updated_at`)
SELECT
  LOWER(REPLACE(UUID(), '-', '')),
  `s`.`tenant_id`,
  NULL,
  `s`.`prefix`,
  `s`.`max_seq`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `contract_sequences_seed` `s`
LEFT JOIN `contract_sequences` `cs`
  ON `cs`.`tenant_id` = `s`.`tenant_id` AND `cs`.`prefix` = `s`.`prefix`
WHERE `cs`.`id` IS NULL;

DROP TEMPORARY TABLE `contract_sequences_seed`;
