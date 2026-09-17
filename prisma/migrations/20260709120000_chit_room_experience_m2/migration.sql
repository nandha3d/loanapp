-- Chit live-room Milestone 2: chat (public/organizer), admission control
-- (auto vs organizer approval waiting room), and voice-bid audio proof.
-- Additive only — ALTERs + one new table; generated with prisma migrate diff.

-- AlterTable
ALTER TABLE `chit_groups` ADD COLUMN `room_admission` VARCHAR(191) NOT NULL DEFAULT 'auto';

-- AlterTable
ALTER TABLE `chit_bids` ADD COLUMN `audio_document_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `chit_auction_attendance` ADD COLUMN `admission_status` VARCHAR(191) NOT NULL DEFAULT 'admitted';

-- CreateTable
CREATE TABLE `chit_room_messages` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `auction_id` VARCHAR(191) NOT NULL,
    `sender_user_id` VARCHAR(191) NULL,
    `sender_member_id` VARCHAR(191) NULL,
    `sender_name` VARCHAR(191) NOT NULL,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'public',
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chit_room_messages_auction_id_created_at_idx`(`auction_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chit_room_messages` ADD CONSTRAINT `chit_room_messages_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `chit_auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
