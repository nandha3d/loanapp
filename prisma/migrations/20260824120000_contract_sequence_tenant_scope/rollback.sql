-- Manual rollback. Review with operations before use; Prisma does not execute this file.
--
-- Restores the old key. The backfilled current_value figures are kept
-- deliberately -- reverting them would reissue codes that live loans already
-- hold. app_type rows seeded as NULL are stamped with the tenant's default
-- module so the NOT NULL constraint can be restored.

UPDATE `contract_sequences` SET `app_type` = 'microlending' WHERE `app_type` IS NULL;

ALTER TABLE `contract_sequences`
  DROP INDEX `contract_sequences_tenant_id_prefix_key`,
  MODIFY COLUMN `app_type` VARCHAR(191) NOT NULL,
  ADD UNIQUE INDEX `contract_sequences_tenant_id_app_type_prefix_key` (`tenant_id`, `app_type`, `prefix`);
