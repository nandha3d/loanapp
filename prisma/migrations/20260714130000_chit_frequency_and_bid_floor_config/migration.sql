-- Doc 16 (custom frequency engine) + doc 13 (bid-starts-from-commission floor).
-- Both are additive/defaulted ChitGroup config columns — no behaviour change
-- for existing groups on deploy (frequencyUnit null falls back to the legacy
-- auctionFrequency preset; bidStartAtCommission defaults true, reproducing
-- today's implicit commission-floor fallback exactly).

ALTER TABLE `chit_groups`
  ADD COLUMN `frequency_unit` VARCHAR(191) NULL,
  ADD COLUMN `frequency_interval` INT NULL,
  ADD COLUMN `frequency_weekdays` VARCHAR(191) NULL,
  ADD COLUMN `bid_start_at_commission` BOOLEAN NOT NULL DEFAULT true;
