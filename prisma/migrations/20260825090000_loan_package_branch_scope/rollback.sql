-- Manual rollback. Review with operations before use; Prisma does not execute this file.
-- Dropping branch_id discards which branch each product belongs to. Per SCOPE-11
-- that is a real data loss, not just a shape change -- export the column first.

ALTER TABLE `loan_packages` DROP FOREIGN KEY `loan_packages_branch_id_fkey`;
DROP INDEX `loan_packages_branch_id_fkey` ON `loan_packages`;
ALTER TABLE `loan_packages` DROP COLUMN `branch_id`;
