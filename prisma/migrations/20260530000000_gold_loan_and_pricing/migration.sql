-- AlterTable
ALTER TABLE `users` ADD COLUMN `google_id` VARCHAR(191) NULL,
    MODIFY `password_hash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tenant_subscriptions` ADD COLUMN `addons_price` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `base_plan_price` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `modules_price` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `selected_addons` LONGTEXT NOT NULL DEFAULT ('[]'),
    ADD COLUMN `total_monthly_price` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `gold_loan_collaterals` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `loan_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `packet_no` VARCHAR(191) NULL,
    `ornament_description` TEXT NULL,
    `gross_weight_grams` DECIMAL(12, 3) NOT NULL,
    `net_weight_grams` DECIMAL(12, 3) NOT NULL,
    `purity_karat` VARCHAR(191) NOT NULL,
    `market_rate_per_gram` DECIMAL(12, 2) NULL,
    `assessed_value` DECIMAL(12, 2) NULL,
    `eligible_ltv_percent` DECIMAL(5, 2) NULL,
    `storage_location` VARCHAR(191) NULL,
    `valuer_name` VARCHAR(191) NULL,
    `valuation_date` DATE NULL,
    `release_status` VARCHAR(191) NOT NULL DEFAULT 'pledged',
    `released_at` DATETIME(3) NULL,
    `photo_path` VARCHAR(191) NULL,
    `document_path` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gold_loan_collaterals_loan_id_key`(`loan_id`),
    INDEX `gold_loan_collaterals_tenant_id_release_status_idx`(`tenant_id`, `release_status`),
    INDEX `gold_loan_collaterals_tenant_id_packet_no_idx`(`tenant_id`, `packet_no`),
    INDEX `gold_loan_collaterals_branch_id_idx`(`branch_id`),
    INDEX `gold_loan_collaterals_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plan_catalogs` (
    `id` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `monthly_price` INTEGER NOT NULL,
    `max_branches` INTEGER NOT NULL,
    `max_agents` INTEGER NOT NULL,
    `max_active_loans` INTEGER NOT NULL,
    `features` LONGTEXT NOT NULL,
    `razorpay_plan_id` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscription_plan_catalogs_plan_key`(`plan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `module_price_catalogs` (
    `id` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `monthly_price` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `module_price_catalogs_module_key`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `addon_catalogs` (
    `id` VARCHAR(191) NOT NULL,
    `addon` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `monthly_price` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `addon_catalogs_addon_key`(`addon`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_google_id_key` ON `users`(`google_id`);

-- AddForeignKey
ALTER TABLE `gold_loan_collaterals` ADD CONSTRAINT `gold_loan_collaterals_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gold_loan_collaterals` ADD CONSTRAINT `gold_loan_collaterals_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gold_loan_collaterals` ADD CONSTRAINT `gold_loan_collaterals_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gold_loan_collaterals` ADD CONSTRAINT `gold_loan_collaterals_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

