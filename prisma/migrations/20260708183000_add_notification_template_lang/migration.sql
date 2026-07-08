-- CreateIndex
CREATE INDEX `notification_templates_tenant_id_idx` ON `notification_templates`(`tenant_id`);

-- AlterTable
ALTER TABLE `notification_templates` ADD COLUMN `lang` VARCHAR(191) NOT NULL DEFAULT 'en';

-- DropIndex
DROP INDEX `notification_templates_tenant_id_name_channel_key` ON `notification_templates`;

-- CreateIndex
CREATE UNIQUE INDEX `notification_templates_tenant_id_name_channel_lang_key` ON `notification_templates`(`tenant_id`, `name`, `channel`, `lang`);
