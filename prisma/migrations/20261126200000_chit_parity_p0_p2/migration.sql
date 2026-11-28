-- Additive P0-P2 Chit Fund Parity Migration (MySQL)

ALTER TABLE `chit_groups`
  ADD COLUMN `is_migrated` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `migration_start_cycle` INT NOT NULL DEFAULT 1,
  ADD COLUMN `opening_cash_balance` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `opening_foreman_commission_balance` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `migrated_at` DATETIME(3) NULL,
  ADD COLUMN `state_code` VARCHAR(191) NOT NULL DEFAULT 'GENERIC',
  ADD COLUMN `prior_sanction_number` VARCHAR(191) NULL,
  ADD COLUMN `registered_office_address` TEXT NULL;

ALTER TABLE `chit_members`
  ADD COLUMN `opening_arrears_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `opening_advance_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `prized_cycle_number` INT NULL,
  ADD COLUMN `historical_prize_amount` DECIMAL(14, 2) NULL,
  ADD COLUMN `historical_payout_pending_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE `chit_auctions`
  ADD COLUMN `gross_prize_amount` DECIMAL(14, 2) NULL,
  ADD COLUMN `arrears_deducted_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `penalty_deducted_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `net_payable_amount` DECIMAL(14, 2) NULL,
  ADD COLUMN `total_disbursed_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `remaining_payable_amount` DECIMAL(14, 2) NULL,
  ADD COLUMN `arrears_breakdown_json` TEXT NULL;

ALTER TABLE `chit_subscriptions`
  ADD COLUMN `settled_by_auction_id` VARCHAR(191) NULL;

CREATE TABLE `chit_payout_disbursements` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `app_type` VARCHAR(191) NOT NULL DEFAULT 'chitfunds',
  `chit_group_id` VARCHAR(191) NOT NULL,
  `auction_id` VARCHAR(191) NOT NULL,
  `tranche_number` INT NOT NULL DEFAULT 1,
  `amount` DECIMAL(14, 2) NOT NULL,
  `payment_mode` VARCHAR(191) NOT NULL DEFAULT 'cash',
  `reference_number` VARCHAR(191) NULL,
  `denomination_breakdown` TEXT NULL,
  `idempotency_key` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `paid_by_user_id` VARCHAR(191) NULL,
  `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `chit_payout_disb_tenant_idem_key`(`tenant_id`, `idempotency_key`),
  INDEX `chit_payout_disbursements_tenant_id_branch_id_chit_group_id_idx`(`tenant_id`, `branch_id`, `chit_group_id`),
  INDEX `chit_payout_disbursements_auction_id_tranche_number_idx`(`auction_id`, `tranche_number`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `chit_payout_disbursements`
  ADD CONSTRAINT `chit_payout_disbursements_auction_id_fkey` FOREIGN KEY (`auction_id`) REFERENCES `chit_auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tenant_subscriptions`
  ADD COLUMN `max_active_chit_groups` INT NULL,
  ADD COLUMN `max_members_per_chit` INT NULL,
  ADD COLUMN `statutory_registers_enabled` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `subscription_plan_catalogs`
  ADD COLUMN `max_active_chit_groups` INT NULL,
  ADD COLUMN `max_members_per_chit` INT NULL;
