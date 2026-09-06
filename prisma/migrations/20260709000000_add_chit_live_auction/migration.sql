-- Live chit auction (poker-table live bidding) — converges an existing DB that
-- already has the 20260708000000 chit_bids/chit_auctions shape: ALTERs instead
-- of duplicate CREATE/ADD (original version re-created chit_bids and re-added
-- started_at, which broke migrate deploy on databases with that migration).

-- AlterTable
ALTER TABLE `chit_auctions` ADD COLUMN `closed_at` DATETIME(3) NULL,
    ADD COLUMN `countdown_seconds` INTEGER NULL,
    ADD COLUMN `current_best_bid_id` VARCHAR(191) NULL,
    ADD COLUMN `ends_at` DATETIME(3) NULL,
    ADD COLUMN `min_bid_decrement` DECIMAL(14, 2) NULL,
    ADD COLUMN `operator_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `chit_bids` ADD COLUMN `discount_amount` DECIMAL(14, 2) NULL,
    ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'bid',
    ADD COLUMN `period_number` INTEGER NULL,
    ADD COLUMN `prize_amount` DECIMAL(14, 2) NULL,
    ADD COLUMN `seq` INTEGER NULL,
    ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'tap',
    ADD COLUMN `transcript` TEXT NULL,
    MODIFY `tenant_id` VARCHAR(191) NULL,
    MODIFY `bid_amount` DECIMAL(14, 2) NULL,
    MODIFY `bid_discount` DECIMAL(14, 2) NULL;

-- CreateTable
CREATE TABLE `chit_auction_events` (
    `id` VARCHAR(191) NOT NULL,
    `auction_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `member_id` VARCHAR(191) NULL,
    `amount` DECIMAL(14, 2) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chit_auction_events_auction_id_created_at_idx`(`auction_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `chit_auctions_current_best_bid_id_key` ON `chit_auctions`(`current_best_bid_id`);

-- CreateIndex
CREATE INDEX `chit_bids_auction_id_created_at_idx` ON `chit_bids`(`auction_id`, `created_at`);

-- CreateIndex
CREATE UNIQUE INDEX `chit_bids_auction_id_seq_key` ON `chit_bids`(`auction_id`, `seq`);

-- AddForeignKey
ALTER TABLE `chit_auction_events` ADD CONSTRAINT `chit_auction_events_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `chit_auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

