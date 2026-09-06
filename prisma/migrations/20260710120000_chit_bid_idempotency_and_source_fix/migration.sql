ALTER TABLE `chit_bids`
  ADD COLUMN `idempotency_key` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `chit_bids_auction_idempotency_key` (`auction_id`, `idempotency_key`);
