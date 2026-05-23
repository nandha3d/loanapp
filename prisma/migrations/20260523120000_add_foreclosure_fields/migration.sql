ALTER TABLE `tenant_subscriptions`
  ADD COLUMN `foreclosure_enabled` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `loans`
  ADD COLUMN `closure_type` VARCHAR(191) NULL,
  ADD COLUMN `foreclosure_amount` DECIMAL(12, 2) NULL,
  ADD COLUMN `foreclosure_discount` DECIMAL(12, 2) NULL,
  ADD COLUMN `foreclosure_by_id` VARCHAR(191) NULL,
  ADD INDEX `loans_foreclosure_by_id_fkey` (`foreclosure_by_id`);

ALTER TABLE `loans`
  ADD CONSTRAINT `loans_foreclosure_by_id_fkey`
  FOREIGN KEY (`foreclosure_by_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
