-- Premium Accounting: Phase 0 migration

-- Add premiumAccountingEnabled to tenant_subscriptions
-- (column may already exist if migration was partially applied)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'tenant_subscriptions'
    AND COLUMN_NAME  = 'premium_accounting_enabled'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `tenant_subscriptions` ADD COLUMN `premium_accounting_enabled` BOOLEAN NOT NULL DEFAULT false',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `parent_id` VARCHAR(191) NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `class_type` VARCHAR(32) NOT NULL,
  `sub_type` VARCHAR(64) NULL,
  `normal_side` VARCHAR(8) NOT NULL,
  `is_cash` BOOLEAN NOT NULL DEFAULT false,
  `is_system` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `description` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_tenant_id_code_key` (`tenant_id`, `code`),
  KEY `accounts_tenant_id_class_type_idx` (`tenant_id`, `class_type`),
  KEY `accounts_parent_id_idx` (`parent_id`),
  CONSTRAINT `accounts_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `accounts_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_balances` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `account_id` VARCHAR(191) NOT NULL,
  `period_key` VARCHAR(7) NOT NULL,
  `opening_dr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `opening_cr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `period_dr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `period_cr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `closing_dr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `closing_cr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_balances_account_id_period_key_key` (`account_id`, `period_key`),
  KEY `account_balances_tenant_id_period_key_idx` (`tenant_id`, `period_key`),
  CONSTRAINT `account_balances_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Journal Entries
CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `entry_no` VARCHAR(191) NULL,
  `entry_date` DATE NOT NULL,
  `posting_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `narration` TEXT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'posted',
  `source_type` VARCHAR(64) NOT NULL,
  `source_id` VARCHAR(191) NULL,
  `dedup_key` VARCHAR(512) NULL,
  `total_debit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `total_credit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
  `reversed_by_id` VARCHAR(191) NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `approved_by_id` VARCHAR(191) NULL,
  `approved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `journal_entries_tenant_id_entry_no_key` (`tenant_id`, `entry_no`),
  UNIQUE KEY `journal_entries_dedup_key_key` (`dedup_key`),
  KEY `journal_entries_tenant_id_entry_date_idx` (`tenant_id`, `entry_date`),
  KEY `journal_entries_tenant_id_status_entry_date_idx` (`tenant_id`, `status`, `entry_date`),
  KEY `journal_entries_branch_id_entry_date_idx` (`branch_id`, `entry_date`),
  CONSTRAINT `je_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `je_branch_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL,
  CONSTRAINT `je_created_by_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`),
  CONSTRAINT `je_reversed_by_fkey` FOREIGN KEY (`reversed_by_id`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_lines` (
  `id` VARCHAR(191) NOT NULL,
  `entry_id` VARCHAR(191) NOT NULL,
  `account_id` VARCHAR(191) NOT NULL,
  `debit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `credit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `description` TEXT NULL,
  `loan_id` VARCHAR(191) NULL,
  `customer_id` VARCHAR(191) NULL,
  `vendor_id` VARCHAR(191) NULL,
  `bill_id` VARCHAR(191) NULL,
  `tax_code` VARCHAR(64) NULL,
  `taxable_amount` DECIMAL(18,2) NULL,
  `line_no` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `journal_lines_account_id_idx` (`account_id`),
  KEY `journal_lines_entry_id_line_no_idx` (`entry_id`, `line_no`),
  KEY `journal_lines_loan_id_idx` (`loan_id`),
  KEY `journal_lines_customer_id_idx` (`customer_id`),
  CONSTRAINT `jl_entry_fkey` FOREIGN KEY (`entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE,
  CONSTRAINT `jl_account_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Vendors & Bills
CREATE TABLE IF NOT EXISTS `vendors` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `pan` VARCHAR(10) NULL,
  `gstin` VARCHAR(15) NULL,
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `tds_section` VARCHAR(32) NULL,
  `tds_rate` DECIMAL(6,4) NULL,
  `bank_name` VARCHAR(255) NULL,
  `bank_account_no` VARCHAR(50) NULL,
  `bank_ifsc` VARCHAR(11) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `vendors_tenant_id_is_active_idx` (`tenant_id`, `is_active`),
  CONSTRAINT `vendors_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bills` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `vendor_id` VARCHAR(191) NOT NULL,
  `bill_no` VARCHAR(191) NOT NULL,
  `bill_date` DATE NOT NULL,
  `due_date` DATE NULL,
  `category` VARCHAR(64) NULL,
  `description` TEXT NULL,
  `subtotal` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `gst_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `tds_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `paid_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `journal_entry_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bills_tenant_id_bill_no_key` (`tenant_id`, `bill_no`),
  KEY `bills_tenant_id_status_idx` (`tenant_id`, `status`),
  KEY `bills_vendor_id_idx` (`vendor_id`),
  CONSTRAINT `bills_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `bills_vendor_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bill_lines` (
  `id` VARCHAR(191) NOT NULL,
  `bill_id` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `gst_rate` DECIMAL(6,2) NOT NULL DEFAULT 0,
  `gst_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `account_id` VARCHAR(191) NULL,
  `line_no` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `bill_lines_bill_id_idx` (`bill_id`),
  CONSTRAINT `bill_lines_bill_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tds_deductions` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `bill_id` VARCHAR(191) NULL,
  `vendor_id` VARCHAR(191) NULL,
  `section` VARCHAR(32) NOT NULL,
  `rate` DECIMAL(6,4) NOT NULL,
  `base_amount` DECIMAL(18,2) NOT NULL,
  `tds_amount` DECIMAL(18,2) NOT NULL,
  `challan_no` VARCHAR(64) NULL,
  `challan_date` DATE NULL,
  `period_key` VARCHAR(7) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'deducted',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `tds_deductions_tenant_section_period_idx` (`tenant_id`, `section`, `period_key`),
  CONSTRAINT `tds_bill_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- GST
CREATE TABLE IF NOT EXISTS `gst_summaries` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `period_key` VARCHAR(7) NOT NULL,
  `gst_type` VARCHAR(16) NOT NULL,
  `output_igst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `output_cgst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `output_sgst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `input_igst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `input_cgst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `input_sgst` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `net_liability` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `filed_at` DATETIME(3) NULL,
  `filed_by_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `gst_summaries_tenant_period_type_key` (`tenant_id`, `period_key`, `gst_type`),
  KEY `gst_summaries_tenant_period_idx` (`tenant_id`, `period_key`),
  CONSTRAINT `gst_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Budgets
CREATE TABLE IF NOT EXISTS `budgets` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `fiscal_year` VARCHAR(9) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
  `approved_by_id` VARCHAR(191) NULL,
  `approved_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `budgets_tenant_fy_name_key` (`tenant_id`, `fiscal_year`, `name`),
  KEY `budgets_tenant_fy_idx` (`tenant_id`, `fiscal_year`),
  CONSTRAINT `budgets_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_lines` (
  `id` VARCHAR(191) NOT NULL,
  `budget_id` VARCHAR(191) NOT NULL,
  `account_id` VARCHAR(191) NOT NULL,
  `jan` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `feb` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `mar` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `apr` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `may` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `jun` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `jul` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `aug` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `sep` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `oct` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `nov` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `dec` DECIMAL(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `budget_lines_budget_account_key` (`budget_id`, `account_id`),
  KEY `budget_lines_budget_id_idx` (`budget_id`),
  CONSTRAINT `budget_lines_budget_fkey` FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Bank Reconciliation
CREATE TABLE IF NOT EXISTS `bank_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `name` VARCHAR(255) NOT NULL,
  `bank_name` VARCHAR(255) NOT NULL,
  `account_no` VARCHAR(50) NOT NULL,
  `ifsc` VARCHAR(11) NULL,
  `ledger_account_id` VARCHAR(191) NOT NULL,
  `opening_balance` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `opening_as_of` DATE NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bank_accounts_tenant_account_no_key` (`tenant_id`, `account_no`),
  KEY `bank_accounts_tenant_active_idx` (`tenant_id`, `is_active`),
  CONSTRAINT `bank_accounts_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `bank_accounts_branch_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL,
  CONSTRAINT `bank_accounts_ledger_fkey` FOREIGN KEY (`ledger_account_id`) REFERENCES `accounts`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bank_statements` (
  `id` VARCHAR(191) NOT NULL,
  `bank_account_id` VARCHAR(191) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_format` VARCHAR(16) NOT NULL,
  `file_hash` VARCHAR(64) NULL,
  `statement_from` DATE NOT NULL,
  `statement_to` DATE NOT NULL,
  `opening_balance` DECIMAL(18,2) NOT NULL,
  `closing_balance` DECIMAL(18,2) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'imported',
  `imported_by_id` VARCHAR(191) NOT NULL,
  `imported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `bank_statements_bank_account_from_idx` (`bank_account_id`, `statement_from`),
  CONSTRAINT `bank_stmts_account_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bank_statement_lines` (
  `id` VARCHAR(191) NOT NULL,
  `statement_id` VARCHAR(191) NOT NULL,
  `posting_date` DATE NOT NULL,
  `value_date` DATE NULL,
  `description` TEXT NOT NULL,
  `reference` VARCHAR(191) NULL,
  `debit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `credit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `running_balance` DECIMAL(18,2) NULL,
  `matched_journal_line_id` VARCHAR(191) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'unmatched',
  `matched_at` DATETIME(3) NULL,
  `matched_by_id` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bsl_matched_jl_key` (`matched_journal_line_id`),
  KEY `bsl_statement_date_idx` (`statement_id`, `posting_date`),
  KEY `bsl_status_idx` (`status`),
  CONSTRAINT `bsl_statement_fkey` FOREIGN KEY (`statement_id`) REFERENCES `bank_statements`(`id`) ON DELETE CASCADE,
  CONSTRAINT `bsl_jl_fkey` FOREIGN KEY (`matched_journal_line_id`) REFERENCES `journal_lines`(`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bank_match_proposals` (
  `id` VARCHAR(191) NOT NULL,
  `statement_line_id` VARCHAR(191) NOT NULL,
  `journal_line_id` VARCHAR(191) NOT NULL,
  `score` DECIMAL(5,4) NOT NULL,
  `reason` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `bmp_line_jl_key` (`statement_line_id`, `journal_line_id`),
  CONSTRAINT `bmp_line_fkey` FOREIGN KEY (`statement_line_id`) REFERENCES `bank_statement_lines`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Period Lock & Audit
CREATE TABLE IF NOT EXISTS `accounting_periods` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `period_key` VARCHAR(7) NOT NULL,
  `period_from` DATE NOT NULL,
  `period_to` DATE NOT NULL,
  `fiscal_year` VARCHAR(9) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'open',
  `closing_je_id` VARCHAR(191) NULL,
  `locked_by_id` VARCHAR(191) NULL,
  `locked_at` DATETIME(3) NULL,
  `closed_by_id` VARCHAR(191) NULL,
  `closed_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounting_periods_tenant_key_key` (`tenant_id`, `period_key`),
  UNIQUE KEY `accounting_periods_closing_je_key` (`closing_je_id`),
  KEY `accounting_periods_tenant_status_idx` (`tenant_id`, `status`),
  CONSTRAINT `ap_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ap_closing_je_fkey` FOREIGN KEY (`closing_je_id`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `period_locks` (
  `id` VARCHAR(191) NOT NULL,
  `period_id` VARCHAR(191) NOT NULL,
  `action` VARCHAR(32) NOT NULL,
  `reason` TEXT NULL,
  `by_user_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `period_locks_period_date_idx` (`period_id`, `created_at`),
  CONSTRAINT `pl_period_fkey` FOREIGN KEY (`period_id`) REFERENCES `accounting_periods`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounting_audit_log` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `action` VARCHAR(64) NOT NULL,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` VARCHAR(191) NULL,
  `before` TEXT NULL,
  `after` TEXT NULL,
  `diff` TEXT NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` TEXT NULL,
  `reason` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `aal_tenant_entity_date_idx` (`tenant_id`, `entity_type`, `entity_id`, `created_at`),
  KEY `aal_tenant_date_idx` (`tenant_id`, `created_at`),
  CONSTRAINT `aal_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Settings & Approvals
CREATE TABLE IF NOT EXISTS `accounting_settings` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `fiscal_year_start_month` INT NOT NULL DEFAULT 4,
  `base_currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
  `gstin` VARCHAR(15) NULL,
  `state` VARCHAR(4) NULL,
  `gst_scheme` VARCHAR(16) NOT NULL DEFAULT 'regular',
  `posting_overrides` LONGTEXT NOT NULL,
  `cost_centres_enabled` BOOLEAN NOT NULL DEFAULT false,
  `base_accounting_mode` VARCHAR(32) NOT NULL DEFAULT 'derive_only',
  `show_premium_banner_in_base` BOOLEAN NOT NULL DEFAULT true,
  `admin_je_cap` DECIMAL(18,2) NOT NULL DEFAULT 50000,
  `admin_bill_cap` DECIMAL(18,2) NOT NULL DEFAULT 100000,
  `two_level_approval_threshold` DECIMAL(18,2) NOT NULL DEFAULT 500000,
  `admin_can_edit_coa` BOOLEAN NOT NULL DEFAULT false,
  `admin_can_lock_period` BOOLEAN NOT NULL DEFAULT false,
  `variance_alert_pct` DECIMAL(6,2) NOT NULL DEFAULT 15,
  `ap_overdue_alert_days` INT NOT NULL DEFAULT 7,
  `tally_connector_enabled` BOOLEAN NOT NULL DEFAULT false,
  `tally_connector_url` VARCHAR(255) NULL,
  `tally_company_name` VARCHAR(255) NULL,
  `allow_future_dated` BOOLEAN NOT NULL DEFAULT false,
  `default_bank_account_id` VARCHAR(191) NULL,
  `default_cash_account_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounting_settings_tenant_key` (`tenant_id`),
  CONSTRAINT `as_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounting_approvals` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `entity_type` VARCHAR(32) NOT NULL,
  `entity_id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `level` INT NOT NULL DEFAULT 1,
  `approver_role` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `approved_by_id` VARCHAR(191) NULL,
  `review_note` TEXT NULL,
  `reviewed_at` DATETIME(3) NULL,
  `requested_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `aa_tenant_status_level_idx` (`tenant_id`, `status`, `level`),
  KEY `aa_entity_idx` (`entity_type`, `entity_id`),
  CONSTRAINT `aa_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `aa_requester_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Export runs
CREATE TABLE IF NOT EXISTS `accounting_export_runs` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `period_key` VARCHAR(7) NULL,
  `branch_id` VARCHAR(191) NULL,
  `filename` VARCHAR(255) NOT NULL,
  `file_size` INT NULL,
  `by_user_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `aer_tenant_date_idx` (`tenant_id`, `created_at`),
  CONSTRAINT `aer_tenant_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
