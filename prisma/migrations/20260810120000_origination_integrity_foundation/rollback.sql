-- Manual rollback for deployments that have not yet written snapshot data.
-- Review with operations before use; Prisma does not execute this file.

ALTER TABLE `auto_finance_details`
  DROP COLUMN `net_payout`,
  DROP COLUMN `recovered_charges`,
  DROP COLUMN `gross_payout`;

ALTER TABLE `gold_loan_collaterals`
  DROP COLUMN `policy_snapshot`,
  DROP COLUMN `ltv_at_origination`,
  DROP COLUMN `eligible_amount`;

ALTER TABLE `instalments`
  DROP COLUMN `charges_component`,
  DROP COLUMN `interest_component`,
  DROP COLUMN `principal_component`;

ALTER TABLE `loans`
  DROP COLUMN `accounting_snapshot`,
  DROP COLUMN `policy_snapshot`,
  DROP COLUMN `terms_snapshot`,
  DROP COLUMN `product_family`,
  DROP COLUMN `version`;

DROP TABLE `contract_sequences`;
