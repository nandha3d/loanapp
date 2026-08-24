-- Manual rollback. Review with operations before use; Prisma does not execute this file.
--
-- NOTE: this restores the SHAPE, not the data. app_type values are gone, and the
-- backfilled current_value figures are kept deliberately — reverting them would
-- reissue codes that live loans already hold. Every restored row is stamped with
-- the tenant's own default module.

ALTER TABLE `contract_sequences`
  DROP INDEX `contract_sequences_tenant_id_prefix_key`,
  ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending';

ALTER TABLE `contract_sequences`
  ADD UNIQUE INDEX `contract_sequences_tenant_id_app_type_prefix_key` (`tenant_id`, `app_type`, `prefix`);

ALTER TABLE `contract_sequences`
  ALTER COLUMN `app_type` DROP DEFAULT;
