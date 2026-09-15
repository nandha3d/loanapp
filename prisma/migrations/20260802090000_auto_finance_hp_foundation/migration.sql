-- Auto Finance (Hire Purchase) foundation — gap-analysis Phase 1.
--
-- Additive only: five new tables plus nullable/defaulted columns on `users`
-- and `loans`. No existing row is rewritten, so this is safe to deploy ahead
-- of the application code.

-- ---------------------------------------------------------------------------
-- 1. Collection-agent login window (both NULL = unrestricted, the default)
-- ---------------------------------------------------------------------------
ALTER TABLE `users`
  ADD COLUMN `allowed_login_start` VARCHAR(191) NULL,
  ADD COLUMN `allowed_login_end`   VARCHAR(191) NULL;

-- ---------------------------------------------------------------------------
-- 2. Broker / dealer sourcing on the shared loans table
-- ---------------------------------------------------------------------------
ALTER TABLE `loans`
  ADD COLUMN `broker_id` VARCHAR(191) NULL,
  ADD COLUMN `dealer_id` VARCHAR(191) NULL;

CREATE INDEX `loans_broker_id_fkey` ON `loans`(`broker_id`);
CREATE INDEX `loans_dealer_id_fkey` ON `loans`(`dealer_id`);

-- ---------------------------------------------------------------------------
-- 3. Brokers & dealers master
-- ---------------------------------------------------------------------------
CREATE TABLE `finance_partners` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `app_type` VARCHAR(191) NOT NULL DEFAULT 'autofinance',
  `type` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `address` TEXT NULL,
  `commission_rate` DECIMAL(6, 2) NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `finance_partners_tenant_id_app_type_type_name_key`(`tenant_id`, `app_type`, `type`, `name`),
  INDEX `finance_partners_tenant_id_app_type_type_status_idx`(`tenant_id`, `app_type`, `type`, `status`),
  INDEX `finance_partners_branch_id_fkey`(`branch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. HP financial configuration (1:1 with loans)
-- ---------------------------------------------------------------------------
CREATE TABLE `auto_finance_details` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `loan_id` VARCHAR(191) NOT NULL,
  `vehicle_value` DECIMAL(14, 2) NULL,
  `down_payment` DECIMAL(14, 2) NULL,
  `interest_method` VARCHAR(191) NOT NULL DEFAULT 'flat',
  `interest_rate` DECIMAL(6, 2) NULL,
  `round_off_emi` BOOLEAN NOT NULL DEFAULT false,
  `grace_period_days` INTEGER NOT NULL DEFAULT 0,
  `penalty_per_day` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `hand_loan_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `insurance_charge` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `document_charge` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `broker_commission` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `payout_mode_1` VARCHAR(191) NULL,
  `payout_amount_1` DECIMAL(12, 2) NULL,
  `payout_mode_2` VARCHAR(191) NULL,
  `payout_amount_2` DECIMAL(12, 2) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `auto_finance_details_loan_id_key`(`loan_id`),
  INDEX `auto_finance_details_tenant_id_idx`(`tenant_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5. Seizure / release history
-- ---------------------------------------------------------------------------
CREATE TABLE `vehicle_recoveries` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `vehicle_id` VARCHAR(191) NOT NULL,
  `loan_id` VARCHAR(191) NOT NULL,
  `seized_at` DATETIME(3) NOT NULL,
  `seized_by_id` VARCHAR(191) NULL,
  `seized_by_name` VARCHAR(191) NULL,
  `yard_location` VARCHAR(191) NOT NULL,
  `seizing_charges` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remarks` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'seized',
  `released_at` DATETIME(3) NULL,
  `released_by_id` VARCHAR(191) NULL,
  `release_payment_id` VARCHAR(191) NULL,
  `release_remarks` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `vehicle_recoveries_tenant_id_status_idx`(`tenant_id`, `status`),
  INDEX `vehicle_recoveries_vehicle_id_idx`(`vehicle_id`),
  INDEX `vehicle_recoveries_loan_id_idx`(`loan_id`),
  INDEX `vehicle_recoveries_seized_by_id_fkey`(`seized_by_id`),
  INDEX `vehicle_recoveries_released_by_id_fkey`(`released_by_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6. Asset photo gallery
-- ---------------------------------------------------------------------------
CREATE TABLE `vehicle_photos` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `vehicle_id` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL DEFAULT 'vehicle',
  `path` VARCHAR(191) NOT NULL,
  `caption` VARCHAR(191) NULL,
  `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `vehicle_photos_tenant_id_idx`(`tenant_id`),
  INDEX `vehicle_photos_vehicle_id_kind_idx`(`vehicle_id`, `kind`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 7. Day closing ledger
-- ---------------------------------------------------------------------------
CREATE TABLE `day_closing_logs` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `app_type` VARCHAR(191) NOT NULL DEFAULT 'autofinance',
  `business_date` DATE NOT NULL,
  `opening_cash` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `collected_cash` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `disbursed_cash` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `expected_closing` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `counted_closing` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `variance` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `receipt_count` INTEGER NOT NULL DEFAULT 0,
  `remarks` TEXT NULL,
  `closed_by_id` VARCHAR(191) NULL,
  `closed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `day_closing_logs_tenant_id_app_type_branch_id_business_date_key`(`tenant_id`, `app_type`, `branch_id`, `business_date`),
  INDEX `day_closing_logs_tenant_id_app_type_business_date_idx`(`tenant_id`, `app_type`, `business_date`),
  INDEX `day_closing_logs_branch_id_fkey`(`branch_id`),
  INDEX `day_closing_logs_closed_by_id_fkey`(`closed_by_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8. Call / follow-up log with promise-to-pay
-- ---------------------------------------------------------------------------
CREATE TABLE `customer_call_logs` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `app_type` VARCHAR(191) NOT NULL DEFAULT 'autofinance',
  `customer_id` VARCHAR(191) NOT NULL,
  `loan_id` VARCHAR(191) NULL,
  `channel` VARCHAR(191) NOT NULL DEFAULT 'call',
  `outcome` VARCHAR(191) NOT NULL DEFAULT 'other',
  `remarks` TEXT NULL,
  `promised_date` DATE NULL,
  `promised_amount` DECIMAL(12, 2) NULL,
  `fulfilled_at` DATETIME(3) NULL,
  `logged_by_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `customer_call_logs_tenant_id_app_type_promised_date_idx`(`tenant_id`, `app_type`, `promised_date`),
  INDEX `customer_call_logs_customer_id_idx`(`customer_id`),
  INDEX `customer_call_logs_loan_id_idx`(`loan_id`),
  INDEX `customer_call_logs_logged_by_id_fkey`(`logged_by_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 9. Foreign keys
-- ---------------------------------------------------------------------------
ALTER TABLE `loans` ADD CONSTRAINT `loans_broker_id_fkey` FOREIGN KEY (`broker_id`) REFERENCES `finance_partners`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `loans` ADD CONSTRAINT `loans_dealer_id_fkey` FOREIGN KEY (`dealer_id`) REFERENCES `finance_partners`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `finance_partners` ADD CONSTRAINT `finance_partners_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `finance_partners` ADD CONSTRAINT `finance_partners_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `auto_finance_details` ADD CONSTRAINT `auto_finance_details_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `auto_finance_details` ADD CONSTRAINT `auto_finance_details_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `vehicle_recoveries` ADD CONSTRAINT `vehicle_recoveries_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `vehicle_recoveries` ADD CONSTRAINT `vehicle_recoveries_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `vehicle_recoveries` ADD CONSTRAINT `vehicle_recoveries_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `vehicle_recoveries` ADD CONSTRAINT `vehicle_recoveries_seized_by_id_fkey` FOREIGN KEY (`seized_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vehicle_recoveries` ADD CONSTRAINT `vehicle_recoveries_released_by_id_fkey` FOREIGN KEY (`released_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `vehicle_photos` ADD CONSTRAINT `vehicle_photos_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `vehicle_photos` ADD CONSTRAINT `vehicle_photos_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `day_closing_logs` ADD CONSTRAINT `day_closing_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `day_closing_logs` ADD CONSTRAINT `day_closing_logs_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `day_closing_logs` ADD CONSTRAINT `day_closing_logs_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `customer_call_logs` ADD CONSTRAINT `customer_call_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_call_logs` ADD CONSTRAINT `customer_call_logs_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_call_logs` ADD CONSTRAINT `customer_call_logs_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_call_logs` ADD CONSTRAINT `customer_call_logs_logged_by_id_fkey` FOREIGN KEY (`logged_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
