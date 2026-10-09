-- CreateTable
CREATE TABLE `announcements` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'info',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `targetScope` VARCHAR(191) NOT NULL DEFAULT 'all',
    `target_role` VARCHAR(191) NULL,
    `target_subscription` VARCHAR(191) NULL,
    `target_geo` VARCHAR(191) NULL,
    `target_tenant_id` VARCHAR(191) NULL,
    `target_branch_id` VARCHAR(191) NULL,
    `displayType` VARCHAR(191) NOT NULL DEFAULT 'all',
    `is_scrolling_bar` BOOLEAN NOT NULL DEFAULT true,
    `is_popup` BOOLEAN NOT NULL DEFAULT true,
    `action_label` VARCHAR(191) NULL,
    `action_url` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'published',
    `scheduled_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `author_id` VARCHAR(191) NULL,
    `author_name` VARCHAR(191) NULL,
    `total_targeted` INTEGER NOT NULL DEFAULT 0,
    `total_read` INTEGER NOT NULL DEFAULT 0,
    `total_dismissed` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `announcements_status_created_at_idx`(`status`, `created_at`),
    INDEX `announcements_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `announcement_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `is_dismissed` BOOLEAN NOT NULL DEFAULT false,
    `dismissed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `announcement_recipients_announcement_id_user_id_key`(`announcement_id`, `user_id`),
    INDEX `announcement_recipients_user_id_is_read_idx`(`user_id`, `is_read`),
    INDEX `announcement_recipients_user_id_is_dismissed_idx`(`user_id`, `is_dismissed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `announcement_recipients` ADD CONSTRAINT `announcement_recipients_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement_recipients` ADD CONSTRAINT `announcement_recipients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
