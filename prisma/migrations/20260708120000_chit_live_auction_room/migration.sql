-- AlterTable
ALTER TABLE `chit_auctions` ADD COLUMN `bidding_opens_at` DATETIME(3) NULL,
    ADD COLUMN `bidding_closes_at` DATETIME(3) NULL,
    ADD COLUMN `auto_extend_seconds` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `room_status` VARCHAR(191) NOT NULL DEFAULT 'scheduled';
