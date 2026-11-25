-- Persistent 24x7 Multi-Member Chit Group Chat Room + Bid/Settlement Cards
ALTER TABLE `chit_groups`
  ADD COLUMN `room_chat_mode` VARCHAR(191) NOT NULL DEFAULT 'open',
  ADD COLUMN `pinned_announcement` TEXT NULL;

ALTER TABLE `chit_room_messages`
  MODIFY COLUMN `auction_id` VARCHAR(191) NULL,
  ADD COLUMN `chit_group_id` VARCHAR(191) NULL,
  ADD COLUMN `reply_to_id` VARCHAR(191) NULL,
  ADD COLUMN `reply_to_sender` VARCHAR(191) NULL,
  ADD COLUMN `reply_to_body` VARCHAR(191) NULL,
  ADD COLUMN `metadata_json` TEXT NULL,
  ADD INDEX `chit_room_messages_chit_group_id_created_at_idx`(`chit_group_id`, `created_at`);

UPDATE `chit_room_messages` m
INNER JOIN `chit_auctions` a ON a.`id` = m.`auction_id`
SET m.`chit_group_id` = a.`chit_group_id`
WHERE m.`chit_group_id` IS NULL;

ALTER TABLE `chit_room_messages`
  ADD CONSTRAINT `chit_room_messages_chit_group_id_fkey`
  FOREIGN KEY (`chit_group_id`) REFERENCES `chit_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Persist cash note denomination counts on prize payout receipts
ALTER TABLE `chit_receipts`
  ADD COLUMN `cash_denominations_json` TEXT NULL;
