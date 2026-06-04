-- mCollect: route batch collection runs (mCollect-A) + digital self-pay (mCollect-B).
-- Fully additive & back-compatible: new columns are nullable or defaulted, so
-- existing collection and QR-token flows behave exactly as before.

-- AlterTable: collection_entries — stream tag + batch run linkage
ALTER TABLE `collection_entries`
    ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'field',
    ADD COLUMN `run_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `collection_entries_run_id_idx` ON `collection_entries`(`run_id`);
CREATE INDEX `collection_entries_tenant_id_source_idx` ON `collection_entries`(`tenant_id`, `source`);

-- AlterTable: client_payment_tokens — digital self-pay (UPI/link)
ALTER TABLE `client_payment_tokens`
    ADD COLUMN `channel` VARCHAR(191) NOT NULL DEFAULT 'upi',
    ADD COLUMN `pay_url` TEXT NULL,
    ADD COLUMN `provider_ref` VARCHAR(191) NULL,
    ADD COLUMN `paid_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `client_payment_tokens_provider_ref_idx` ON `client_payment_tokens`(`provider_ref`);

-- CreateTable: collection_runs
CREATE TABLE `collection_runs` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending',
    `agent_id` VARCHAR(191) NOT NULL,
    `route_id` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `expected_total` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `stops_expected` INTEGER NOT NULL DEFAULT 0,
    `collected_total` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `stops_collected` INTEGER NOT NULL DEFAULT 0,
    `cash_collected` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `digital_collected` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `cash_deposited` DECIMAL(14, 2) NULL,
    `deposit_ref` VARCHAR(191) NULL,
    `variance_amount` DECIMAL(14, 2) NULL,
    `opened_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `reconciled_at` DATETIME(3) NULL,
    `open_lat` DOUBLE NULL,
    `open_lng` DOUBLE NULL,
    `notes` TEXT NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `collection_runs_agent_route_day_key`(`tenant_id`, `app_type`, `agent_id`, `route_id`, `date`),
    INDEX `collection_runs_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `collection_runs_agent_id_date_idx`(`agent_id`, `date`),
    INDEX `collection_runs_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
