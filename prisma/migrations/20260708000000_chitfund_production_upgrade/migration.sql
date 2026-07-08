-- AlterTable
ALTER TABLE `chit_groups` ADD COLUMN `approved_bank_account_no` VARCHAR(191) NULL,
    ADD COLUMN `approved_bank_name` VARCHAR(191) NULL,
    ADD COLUMN `auction_day` INTEGER NULL,
    ADD COLUMN `auction_frequency` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    ADD COLUMN `auction_mode` VARCHAR(191) NOT NULL DEFAULT 'offline',
    ADD COLUMN `auction_type` VARCHAR(191) NOT NULL DEFAULT 'open_manual',
    ADD COLUMN `bid_increment` DECIMAL(14, 2) NULL,
    ADD COLUMN `bylaw_no` VARCHAR(191) NULL,
    ADD COLUMN `chit_type` VARCHAR(191) NOT NULL DEFAULT 'unregistered',
    ADD COLUMN `commencement_certificate` VARCHAR(191) NULL,
    ADD COLUMN `commission_basis` VARCHAR(191) NOT NULL DEFAULT 'BID_DISCOUNT',
    ADD COLUMN `compliance_status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    ADD COLUMN `dividend_distribution` VARCHAR(191) NOT NULL DEFAULT 'ADJUST_NEXT_DUE',
    ADD COLUMN `dividend_policy` VARCHAR(191) NOT NULL DEFAULT 'ALL_MEMBERS',
    ADD COLUMN `dividend_rounding` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `fixed_discount_pct` DECIMAL(5, 2) NULL,
    ADD COLUMN `foreman_commission_cap_pct` DECIMAL(5, 2) NULL,
    ADD COLUMN `foreman_name` VARCHAR(191) NULL,
    ADD COLUMN `gst_pct` DECIMAL(5, 2) NULL,
    ADD COLUMN `has_foreman_ticket` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `max_discount_pct` DECIMAL(5, 2) NULL,
    ADD COLUMN `min_discount_pct` DECIMAL(5, 2) NULL,
    ADD COLUMN `registrar_office` VARCHAR(191) NULL,
    ADD COLUMN `registration_date` DATE NULL,
    ADD COLUMN `registration_no` VARCHAR(191) NULL,
    ADD COLUMN `remarks` TEXT NULL,
    ADD COLUMN `tie_break_rule` VARCHAR(191) NOT NULL DEFAULT 'EARLIEST_BID',
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `chit_members` ADD COLUMN `agreement_signed_at` DATETIME(3) NULL,
    ADD COLUMN `agreement_status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    ADD COLUMN `fraction_no` VARCHAR(191) NULL,
    ADD COLUMN `introduced_by` VARCHAR(191) NULL,
    ADD COLUMN `is_foreman_ticket` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `nominee_name` VARCHAR(191) NULL,
    ADD COLUMN `nominee_phone` VARCHAR(191) NULL,
    ADD COLUMN `nominee_relation` VARCHAR(191) NULL,
    ADD COLUMN `subscriber_status` VARCHAR(191) NOT NULL DEFAULT 'active',
    ADD COLUMN `ticket_no` VARCHAR(191) NULL,
    ADD COLUMN `ticket_share` DECIMAL(4, 2) NOT NULL DEFAULT 1.00;

-- AlterTable
ALTER TABLE `chit_auctions` ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `confirmed_at` DATETIME(3) NULL,
    ADD COLUMN `confirmed_by_id` VARCHAR(191) NULL,
    ADD COLUMN `gst_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `minutes_text` TEXT NULL,
    ADD COLUMN `notice_status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    ADD COLUMN `payout_status` VARCHAR(191) NOT NULL DEFAULT 'not_ready',
    ADD COLUMN `rounding_income` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `scheduled_at` DATETIME(3) NULL,
    ADD COLUMN `started_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `chit_subscriptions` ADD COLUMN `base_due_amount` DECIMAL(14, 2) NULL,
    ADD COLUMN `collector_id` VARCHAR(191) NULL,
    ADD COLUMN `dividend_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `last_payment_ref_no` VARCHAR(191) NULL,
    ADD COLUMN `last_receipt_no` VARCHAR(191) NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `payment_mode` VARCHAR(191) NULL,
    ADD COLUMN `penalty_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00;

-- CreateTable
CREATE TABLE `chit_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'chitfunds',
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `document_type` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_url` TEXT NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `size_bytes` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `uploaded_by_id` VARCHAR(191) NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chit_documents_tenant_id_app_type_entity_type_entity_id_idx`(`tenant_id`, `app_type`, `entity_type`, `entity_id`),
    INDEX `chit_documents_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_bids` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `auction_id` VARCHAR(191) NOT NULL,
    `chit_group_id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `bid_amount` DECIMAL(14, 2) NOT NULL,
    `bid_discount` DECIMAL(14, 2) NOT NULL,
    `bid_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'valid',
    `remarks` TEXT NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chit_bids_tenant_id_branch_id_chit_group_id_idx`(`tenant_id`, `branch_id`, `chit_group_id`),
    INDEX `chit_bids_auction_id_status_idx`(`auction_id`, `status`),
    INDEX `chit_bids_member_id_idx`(`member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_auction_attendance` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `auction_id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'present',
    `proxy_name` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `marked_by_id` VARCHAR(191) NULL,
    `marked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chit_auction_attendance_tenant_id_branch_id_idx`(`tenant_id`, `branch_id`),
    INDEX `chit_auction_attendance_member_id_idx`(`member_id`),
    UNIQUE INDEX `chit_auction_attendance_auction_id_member_id_key`(`auction_id`, `member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_receipts` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'chitfunds',
    `receipt_no` VARCHAR(191) NOT NULL,
    `receipt_type` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `payment_mode` VARCHAR(191) NOT NULL DEFAULT 'cash',
    `reference_no` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `issued_by_id` VARCHAR(191) NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reversed_by_id` VARCHAR(191) NULL,
    `reversed_at` DATETIME(3) NULL,
    `reversal_reason` TEXT NULL,

    INDEX `chit_receipts_tenant_id_branch_id_receipt_type_idx`(`tenant_id`, `branch_id`, `receipt_type`),
    INDEX `chit_receipts_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    UNIQUE INDEX `chit_receipts_tenant_id_receipt_no_key`(`tenant_id`, `receipt_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_securities` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `chit_group_id` VARCHAR(191) NOT NULL,
    `auction_id` VARCHAR(191) NOT NULL,
    `winner_member_id` VARCHAR(191) NOT NULL,
    `security_type` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `security_value` DECIMAL(14, 2) NULL,
    `guarantor_name` VARCHAR(191) NULL,
    `guarantor_phone` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `submitted_at` DATETIME(3) NULL,
    `verified_by_id` VARCHAR(191) NULL,
    `verified_at` DATETIME(3) NULL,
    `approved_by_id` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chit_securities_tenant_id_branch_id_chit_group_id_idx`(`tenant_id`, `branch_id`, `chit_group_id`),
    INDEX `chit_securities_auction_id_status_idx`(`auction_id`, `status`),
    INDEX `chit_securities_winner_member_id_idx`(`winner_member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_penalties` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `penalty_type` VARCHAR(191) NOT NULL DEFAULT 'late_fee',
    `amount` DECIMAL(14, 2) NOT NULL,
    `paid_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(191) NOT NULL DEFAULT 'due',
    `reason` TEXT NULL,
    `waived_by_id` VARCHAR(191) NULL,
    `waived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chit_penalties_tenant_id_branch_id_member_id_idx`(`tenant_id`, `branch_id`, `member_id`),
    INDEX `chit_penalties_subscription_id_idx`(`subscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `chit_groups_tenant_id_app_type_compliance_status_idx` ON `chit_groups`(`tenant_id`, `app_type`, `compliance_status`);

-- CreateIndex
CREATE INDEX `chit_members_chit_group_id_ticket_no_idx` ON `chit_members`(`chit_group_id`, `ticket_no`);

-- CreateIndex
CREATE INDEX `chit_auctions_chit_group_id_status_idx` ON `chit_auctions`(`chit_group_id`, `status`);

-- AddForeignKey
ALTER TABLE `chit_bids` ADD CONSTRAINT `chit_bids_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `chit_auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_bids` ADD CONSTRAINT `chit_bids_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `chit_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_auction_attendance` ADD CONSTRAINT `chit_auction_attendance_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `chit_auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_auction_attendance` ADD CONSTRAINT `chit_auction_attendance_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `chit_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_penalties` ADD CONSTRAINT `chit_penalties_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `chit_subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

