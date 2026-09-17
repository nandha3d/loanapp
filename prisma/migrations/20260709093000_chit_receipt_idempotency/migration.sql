ALTER TABLE `chit_receipts`
  ADD COLUMN `idempotency_key` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `chit_receipts_tenant_idempotency_key` (`tenant_id`, `idempotency_key`);
