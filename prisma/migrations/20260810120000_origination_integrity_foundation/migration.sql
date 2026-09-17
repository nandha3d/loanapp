-- Additive origination integrity foundation. Existing contractual amounts and
-- schedule rows are not recalculated or rewritten.

CREATE TABLE `contract_sequences` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `app_type` VARCHAR(191) NOT NULL,
  `prefix` VARCHAR(191) NOT NULL,
  `current_value` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `contract_sequences_tenant_id_app_type_prefix_key` (`tenant_id`, `app_type`, `prefix`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `loans`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `product_family` VARCHAR(191) NULL,
  ADD COLUMN `terms_snapshot` JSON NULL,
  ADD COLUMN `policy_snapshot` JSON NULL,
  ADD COLUMN `accounting_snapshot` JSON NULL;

ALTER TABLE `instalments`
  ADD COLUMN `principal_component` DECIMAL(12, 2) NULL,
  ADD COLUMN `interest_component` DECIMAL(12, 2) NULL,
  ADD COLUMN `charges_component` DECIMAL(12, 2) NULL;

ALTER TABLE `gold_loan_collaterals`
  ADD COLUMN `eligible_amount` DECIMAL(14, 2) NULL,
  ADD COLUMN `ltv_at_origination` DECIMAL(7, 4) NULL,
  ADD COLUMN `policy_snapshot` JSON NULL;

ALTER TABLE `auto_finance_details`
  ADD COLUMN `gross_payout` DECIMAL(14, 2) NULL,
  ADD COLUMN `recovered_charges` DECIMAL(14, 2) NULL,
  ADD COLUMN `net_payout` DECIMAL(14, 2) NULL;
