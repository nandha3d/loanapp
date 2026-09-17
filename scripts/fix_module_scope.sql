-- Idempotent apply of the module-scope ledger/wallet migration.
-- Safe to run whether the failed `db push` added nothing, the columns, and/or
-- the new indexes. Adds columns + new (tenant_id, app_type, ...) indexes if
-- missing, then drops the old indexes if still present (FK stays covered by the
-- new tenant_id-prefixed indexes).

-- ── add columns if missing ──────────────────────────────────────────────────
SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='account_entries' AND column_name='app_type')=0,
  'ALTER TABLE `account_entries` ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT ''microlending''','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='agent_accounts' AND column_name='app_type')=0,
  'ALTER TABLE `agent_accounts` ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT ''microlending''','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='branch_cash_accounts' AND column_name='app_type')=0,
  'ALTER TABLE `branch_cash_accounts` ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT ''microlending''','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wallet_transactions' AND column_name='app_type')=0,
  'ALTER TABLE `wallet_transactions` ADD COLUMN `app_type` VARCHAR(191) NOT NULL DEFAULT ''microlending''','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── create new indexes if missing ───────────────────────────────────────────
SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_entries' AND index_name='account_entries_tenant_id_app_type_entry_date_idx')=0,
  'CREATE INDEX `account_entries_tenant_id_app_type_entry_date_idx` ON `account_entries`(`tenant_id`,`app_type`,`entry_date`)','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_entries' AND index_name='account_entries_tenant_id_app_type_type_idx')=0,
  'CREATE INDEX `account_entries_tenant_id_app_type_type_idx` ON `account_entries`(`tenant_id`,`app_type`,`type`)','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='agent_accounts' AND index_name='agent_accounts_tenant_app_agent_key')=0,
  'CREATE UNIQUE INDEX `agent_accounts_tenant_app_agent_key` ON `agent_accounts`(`tenant_id`,`app_type`,`agent_id`)','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='branch_cash_accounts' AND index_name='branch_cash_accounts_tenant_app_branch_key')=0,
  'CREATE UNIQUE INDEX `branch_cash_accounts_tenant_app_branch_key` ON `branch_cash_accounts`(`tenant_id`,`app_type`,`branch_id`)','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='wallet_transactions' AND index_name='wallet_tx_tenant_app_agent_idx')=0,
  'CREATE INDEX `wallet_tx_tenant_app_agent_idx` ON `wallet_transactions`(`tenant_id`,`app_type`,`agent_id`)','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='wallet_transactions' AND index_name='wallet_tx_tenant_app_branch_idx')=0,
  'CREATE INDEX `wallet_tx_tenant_app_branch_idx` ON `wallet_transactions`(`tenant_id`,`app_type`,`branch_id`)','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── drop old indexes if still present ───────────────────────────────────────
SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_entries' AND index_name='account_entries_tenant_id_entry_date_idx')>0,
  'DROP INDEX `account_entries_tenant_id_entry_date_idx` ON `account_entries`','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_entries' AND index_name='account_entries_tenant_id_type_idx')>0,
  'DROP INDEX `account_entries_tenant_id_type_idx` ON `account_entries`','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='agent_accounts' AND index_name='agent_accounts_tenant_agent_key')>0,
  'DROP INDEX `agent_accounts_tenant_agent_key` ON `agent_accounts`','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='branch_cash_accounts' AND index_name='branch_cash_accounts_tenant_branch_key')>0,
  'DROP INDEX `branch_cash_accounts_tenant_branch_key` ON `branch_cash_accounts`','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='wallet_transactions' AND index_name='wallet_tx_tenant_agent_idx')>0,
  'DROP INDEX `wallet_tx_tenant_agent_idx` ON `wallet_transactions`','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='wallet_transactions' AND index_name='wallet_tx_tenant_branch_idx')>0,
  'DROP INDEX `wallet_tx_tenant_branch_idx` ON `wallet_transactions`','DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
