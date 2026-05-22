ALTER TABLE `system_notifications`
  ADD COLUMN `target_user_id` VARCHAR(191) NULL;

CREATE INDEX `system_notifications_target_user_id_is_read_idx`
  ON `system_notifications`(`target_user_id`, `is_read`);
