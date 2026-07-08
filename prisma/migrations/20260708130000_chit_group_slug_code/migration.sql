-- AlterTable
ALTER TABLE `chit_groups` ADD COLUMN `group_code` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `chit_groups_group_code_key` ON `chit_groups`(`group_code`);
