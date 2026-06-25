-- Module (appType) isolation for the cash ledger + agent/branch wallet.
-- Adds `app_type` to account_entries, agent_accounts, branch_cash_accounts and
-- wallet_transactions so accounting P&L and wallet balances are per-module
-- instead of bleeding across every module a tenant runs. Existing rows backfill
-- to 'microlending' via the column default; other modules start empty.
-- The agent/branch unique keys fold in app_type so each agent/branch gets one
-- float per module.

-- DropIndex
DROP INDEX `account_entries_tenant_id_entry_date_idx` ON `account_entries`;

-- DropIndex
DROP INDEX `account_entries_tenant_id_type_idx` ON `account_entries`;

-- DropIndex
DROP INDEX `agent_accounts_tenant_agent_key` ON `agent_accounts`;

-- DropIndex
DROP INDEX `branch_cash_accounts_tenant_branch_key` ON `branch_cash_accounts`;

-- DropIndex
DROP INDEX `wallet_tx_tenant_agent_idx` ON `wallet_transactions`;

-- DropIndex
DROP INDEX `wallet_tx_tenant_branch_idx` ON `wallet_transactions`;

-- AlterTable
ALTER TABLE `account_entries` ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending';

-- AlterTable
ALTER TABLE `agent_accounts` ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending';

-- AlterTable
ALTER TABLE `branch_cash_accounts` ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending';

-- AlterTable
ALTER TABLE `wallet_transactions` ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending';

-- CreateIndex
CREATE INDEX `account_entries_tenant_id_app_type_entry_date_idx` ON `account_entries`(`tenant_id`, `app_type`, `entry_date`);

-- CreateIndex
CREATE INDEX `account_entries_tenant_id_app_type_type_idx` ON `account_entries`(`tenant_id`, `app_type`, `type`);

-- CreateIndex
CREATE UNIQUE INDEX `agent_accounts_tenant_app_agent_key` ON `agent_accounts`(`tenant_id`, `app_type`, `agent_id`);

-- CreateIndex
CREATE UNIQUE INDEX `branch_cash_accounts_tenant_app_branch_key` ON `branch_cash_accounts`(`tenant_id`, `app_type`, `branch_id`);

-- CreateIndex
CREATE INDEX `wallet_tx_tenant_app_agent_idx` ON `wallet_transactions`(`tenant_id`, `app_type`, `agent_id`);

-- CreateIndex
CREATE INDEX `wallet_tx_tenant_app_branch_idx` ON `wallet_transactions`(`tenant_id`, `app_type`, `branch_id`);
