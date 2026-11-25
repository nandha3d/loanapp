-- Support live auction voice chat clips alongside text messages.
ALTER TABLE `chit_room_messages`
  ADD COLUMN `message_type` VARCHAR(191) NOT NULL DEFAULT 'text',
  ADD COLUMN `audio_url` VARCHAR(191) NULL,
  ADD COLUMN `audio_duration_sec` INT NULL;
