-- Persist WHY an appliance was repossessed on the item itself.
--
-- The repossession route read `body.reason` and wrote it only into the audit
-- log's newValue, so a recovery clerk had to read the audit trail to learn why
-- the office is holding an asset (PPF-141).
--
-- Additive and a no-op for every existing row (STABLE-2): the column is
-- nullable and stays NULL for every item written before this migration, which
-- is exactly the information those rows carry today.

ALTER TABLE `product_finance_items`
  ADD COLUMN `repossession_reason` VARCHAR(191) NULL;
