-- Live chit auction ("poker table" live bidding). Additive & backward-compatible:
-- legacy result-only auctions leave the new nullable columns blank. Two new
-- tables record the bid stream (chit_bids) and the legal-grade minutes trail
-- (chit_auction_events).

-- AlterTable
ALTER TABLE `chit_auctions` ADD COLUMN `closed_at` DATETIME(3) NULL,
    ADD COLUMN `countdown_seconds` INTEGER NULL,
    ADD COLUMN `current_best_bid_id` VARCHAR(191) NULL,
    ADD COLUMN `ends_at` DATETIME(3) NULL,
    ADD COLUMN `min_bid_decrement` DECIMAL(14, 2) NULL,
    ADD COLUMN `operator_id` VARCHAR(191) NULL,
    ADD COLUMN `started_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `chit_bids` (
    `id` VARCHAR(191) NOT NULL,
    `chit_group_id` VARCHAR(191) NOT NULL,
    `auction_id` VARCHAR(191) NOT NULL,
    `period_number` INTEGER NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `prize_amount` DECIMAL(14, 2) NOT NULL,
    `discount_amount` DECIMAL(14, 2) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'bid',
    `source` VARCHAR(191) NOT NULL DEFAULT 'tap',
    `transcript` TEXT NULL,
    `seq` INTEGER NOT NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chit_bids_auction_id_created_at_idx`(`auction_id`, `created_at`),
    INDEX `chit_bids_member_id_idx`(`member_id`),
    UNIQUE INDEX `chit_bids_auction_id_seq_key`(`auction_id`, `seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- AddForeignKey
ALTER TABLE `chit_bids` ADD CONSTRAINT `chit_bids_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `chit_auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_auction_events` ADD CONSTRAINT `chit_auction_events_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `chit_auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
