-- AlterTable
ALTER TABLE `notification_logs` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `notification_logs` ADD COLUMN `branch_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `notification_logs_tenant_id_app_type_created_at_idx` ON `notification_logs`(`tenant_id`, `app_type`, `created_at`);
CREATE INDEX `notification_logs_tenant_id_branch_id_created_at_idx` ON `notification_logs`(`tenant_id`, `branch_id`, `created_at`);
