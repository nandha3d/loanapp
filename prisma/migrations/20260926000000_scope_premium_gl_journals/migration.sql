-- Historical entries start unclassified. Assign only records with a verified
-- module source through scripts/backfill-gl-app-type.ts after deployment.
ALTER TABLE `journal_entries` ADD COLUMN `app_type` VARCHAR(191) NULL;
CREATE INDEX `journal_entries_tenant_id_app_type_status_entry_date_idx`
  ON `journal_entries`(`tenant_id`, `app_type`, `status`, `entry_date`);

-- Bank accounts and fiscal periods without a verified source remain unclassified.
ALTER TABLE `bank_accounts` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `bank_accounts` DROP INDEX `bank_accounts_tenant_id_account_no_key`;
CREATE UNIQUE INDEX `bank_accounts_tenant_id_app_type_account_no_key`
  ON `bank_accounts`(`tenant_id`, `app_type`, `account_no`);
CREATE INDEX `bank_accounts_tenant_id_app_type_branch_id_idx`
  ON `bank_accounts`(`tenant_id`, `app_type`, `branch_id`);
ALTER TABLE `accounting_periods` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `accounting_periods` DROP INDEX `accounting_periods_tenant_id_period_key_key`;
CREATE UNIQUE INDEX `accounting_periods_tenant_id_app_type_period_key_key`
  ON `accounting_periods`(`tenant_id`, `app_type`, `period_key`);

ALTER TABLE `vendors` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `vendors` ADD COLUMN `branch_id` VARCHAR(191) NULL;
ALTER TABLE `bills` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `bills` ADD COLUMN `branch_id` VARCHAR(191) NULL;
ALTER TABLE `tds_deductions` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `gst_summaries` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `budgets` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `accounting_approvals` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `accounting_approvals` ADD COLUMN `branch_id` VARCHAR(191) NULL;
ALTER TABLE `accounting_export_runs` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `accounting_audit_log` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `accounting_audit_log` ADD COLUMN `branch_id` VARCHAR(191) NULL;

ALTER TABLE `bills` DROP INDEX `bills_tenant_id_bill_no_key`;
CREATE UNIQUE INDEX `bills_tenant_id_app_type_bill_no_key`
  ON `bills`(`tenant_id`, `app_type`, `bill_no`);
ALTER TABLE `gst_summaries` DROP INDEX `gst_summaries_tenant_id_period_key_gst_type_key`;
CREATE UNIQUE INDEX `gst_summaries_tenant_id_app_type_period_key_gst_type_key`
  ON `gst_summaries`(`tenant_id`, `app_type`, `period_key`, `gst_type`);
ALTER TABLE `budgets` DROP INDEX `budgets_tenant_id_fiscal_year_name_key`;
CREATE UNIQUE INDEX `budgets_tenant_id_app_type_fiscal_year_name_key`
  ON `budgets`(`tenant_id`, `app_type`, `fiscal_year`, `name`);
CREATE INDEX `bills_tenant_id_app_type_status_idx` ON `bills`(`tenant_id`, `app_type`, `status`);
CREATE INDEX `gst_summaries_tenant_id_app_type_period_key_idx` ON `gst_summaries`(`tenant_id`, `app_type`, `period_key`);
CREATE INDEX `budgets_tenant_id_app_type_fiscal_year_idx` ON `budgets`(`tenant_id`, `app_type`, `fiscal_year`);
CREATE INDEX `accounting_approvals_tenant_id_app_type_status_level_idx` ON `accounting_approvals`(`tenant_id`, `app_type`, `status`, `level`);
CREATE INDEX `accounting_approvals_tenant_id_app_type_branch_id_idx` ON `accounting_approvals`(`tenant_id`, `app_type`, `branch_id`);
CREATE INDEX `accounting_export_runs_tenant_id_app_type_created_at_idx` ON `accounting_export_runs`(`tenant_id`, `app_type`, `created_at`);
CREATE INDEX `acct_export_scope_branch_created_idx` ON `accounting_export_runs`(`tenant_id`, `app_type`, `branch_id`, `created_at`);
CREATE INDEX `accounting_audit_log_tenant_id_app_type_branch_id_created_at_idx` ON `accounting_audit_log`(`tenant_id`, `app_type`, `branch_id`, `created_at`);
CREATE INDEX `vendors_tenant_id_app_type_is_active_idx` ON `vendors`(`tenant_id`, `app_type`, `is_active`);
CREATE INDEX `vendors_tenant_id_app_type_branch_id_idx` ON `vendors`(`tenant_id`, `app_type`, `branch_id`);
CREATE INDEX `bills_tenant_id_app_type_branch_id_idx` ON `bills`(`tenant_id`, `app_type`, `branch_id`);
CREATE INDEX `tds_deductions_tenant_id_app_type_section_period_key_idx` ON `tds_deductions`(`tenant_id`, `app_type`, `section`, `period_key`);
