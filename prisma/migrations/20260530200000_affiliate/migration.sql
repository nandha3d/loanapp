-- CreateTable
CREATE TABLE `affiliates` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `tenant_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `affiliates_code_key`(`code`),
    UNIQUE INDEX `affiliates_user_id_key`(`user_id`),
    INDEX `affiliates_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `referrals` (
    `id` VARCHAR(191) NOT NULL,
    `affiliate_id` VARCHAR(191) NOT NULL,
    `referred_tenant_id` VARCHAR(191) NULL,
    `referred_email` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'signup',
    `plan_term` VARCHAR(191) NULL,
    `monthly_price` DECIMAL(12, 2) NULL,
    `subscribed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `referrals_affiliate_id_status_idx`(`affiliate_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `affiliate_rewards` (
    `id` VARCHAR(191) NOT NULL,
    `affiliate_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `period_start` DATETIME(3) NULL,
    `period_end` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `granted_at` DATETIME(3) NULL,

    INDEX `affiliate_rewards_affiliate_id_status_idx`(`affiliate_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

