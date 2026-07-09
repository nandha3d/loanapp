ALTER TABLE `chit_groups`
  ADD COLUMN `auction_time` VARCHAR(191) NULL,
  ADD COLUMN `winner_interest_type` VARCHAR(191) NOT NULL DEFAULT 'NONE',
  ADD COLUMN `winner_interest_value` DECIMAL(14, 2) NULL,
  ADD COLUMN `winner_interest_periods` INTEGER NULL;

ALTER TABLE `chit_auctions`
  ADD COLUMN `reminder_1day_at` DATETIME(3) NULL,
  ADD COLUMN `reminder_1hour_at` DATETIME(3) NULL;

ALTER TABLE `chit_subscriptions`
  ADD COLUMN `interest_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00;
