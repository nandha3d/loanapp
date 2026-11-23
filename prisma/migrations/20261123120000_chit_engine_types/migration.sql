-- Comprehensive Chit Engine Types, Multi-Division Winners, ASCA Pool & Member Dividend Details
-- Additive and backward-compatible for all existing chit groups (STABLE-2).

ALTER TABLE `chit_groups`
  ADD COLUMN `chit_engine_type` VARCHAR(191) NOT NULL DEFAULT 'AUCTION_STANDARD',
  ADD COLUMN `engine_config` TEXT NULL,
  ADD INDEX `chit_groups_tenant_id_app_type_chit_engine_type_idx` (`tenant_id`, `app_type`, `chit_engine_type`);

ALTER TABLE `chit_auctions`
  ADD COLUMN `calculation_breakdown` TEXT NULL,
  ADD COLUMN `reserve_floor_amount` DECIMAL(14, 2) NULL,
  ADD COLUMN `gold_rate_per_gram` DECIMAL(14, 2) NULL;

ALTER TABLE `chit_subscriptions`
  ADD COLUMN `premium_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `deferred_dividend_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `dividend_forfeited` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `gold_rate_applied` DECIMAL(14, 2) NULL,
  ADD COLUMN `gold_grams_credited` DECIMAL(14, 4) NULL;

ALTER TABLE `chit_securities`
  ADD COLUMN `guarantor_member_id` VARCHAR(191) NULL,
  ADD INDEX `chit_securities_guarantor_member_id_idx` (`guarantor_member_id`),
  ADD CONSTRAINT `chit_securities_guarantor_member_id_fkey`
    FOREIGN KEY (`guarantor_member_id`) REFERENCES `chit_members`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `chit_auction_winners` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `app_type` VARCHAR(191) NOT NULL DEFAULT 'chitfunds',
  `chit_group_id` VARCHAR(191) NOT NULL,
  `auction_id` VARCHAR(191) NOT NULL,
  `member_id` VARCHAR(191) NOT NULL,
  `bid_id` VARCHAR(191) NULL,
  `win_type` VARCHAR(191) NOT NULL DEFAULT 'auction',
  `prize_amount` DECIMAL(14, 2) NOT NULL,
  `bid_discount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `commission` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `gst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `payout_status` VARCHAR(191) NOT NULL DEFAULT 'security_pending',
  `payout_asset_type` VARCHAR(191) NOT NULL DEFAULT 'CASH',
  `asset_quantity` DECIMAL(14, 4) NULL,
  `asset_summary` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `chit_auction_winners_auction_id_member_id_key` (`auction_id`, `member_id`),
  INDEX `chit_auction_winners_tenant_id_app_type_chit_group_id_idx` (`tenant_id`, `app_type`, `chit_group_id`),
  INDEX `chit_auction_winners_member_id_idx` (`member_id`),
  CONSTRAINT `chit_auction_winners_auction_id_fkey`
    FOREIGN KEY (`auction_id`) REFERENCES `chit_auctions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chit_auction_winners_member_id_fkey`
    FOREIGN KEY (`member_id`) REFERENCES `chit_members`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `chit_pool_transactions` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `app_type` VARCHAR(191) NOT NULL DEFAULT 'chitfunds',
  `chit_group_id` VARCHAR(191) NOT NULL,
  `member_id` VARCHAR(191) NULL,
  `txn_type` VARCHAR(191) NOT NULL,
  `principal_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `interest_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `interest_rate_pct` DECIMAL(5, 2) NULL,
  `txn_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `notes` TEXT NULL,
  `created_by_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `chit_pool_transactions_tenant_id_app_type_chit_group_id_idx` (`tenant_id`, `app_type`, `chit_group_id`),
  INDEX `chit_pool_transactions_member_id_idx` (`member_id`),
  CONSTRAINT `chit_pool_transactions_chit_group_id_fkey`
    FOREIGN KEY (`chit_group_id`) REFERENCES `chit_groups`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
