ALTER TABLE `collection_entries`
  ADD COLUMN `idempotency_key` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `collection_entries_idempotency_key_key` (`idempotency_key`);
