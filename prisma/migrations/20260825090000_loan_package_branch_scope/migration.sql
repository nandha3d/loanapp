-- Backfills the migration that commit 38d9345 ("Scope every branch-owned surface
-- to the active branch") never shipped. schema.prisma has carried
-- LoanPackage.branchId since then, but no migration created the column, so only
-- environments deployed via `prisma db push` (which infers the shape) have it.
-- Any environment running `prisma migrate deploy` -- a fresh deploy, CI, a local
-- dev database -- ends up with a schema the app cannot query.
--
-- Additive and idempotent-safe on a database that already has the column via
-- db push: check before applying there.
--
-- branch_id is NULLABLE by design. Per SCOPE-11, LoanPackage is master data:
-- a null branch means "every branch sees this product", and anything created
-- from a branch is stamped with it. This is the sanctioned exception to SCOPE-4,
-- so do NOT backfill nulls to a default branch -- that would silently unpublish
-- every tenant-wide product. Split a catalogue per branch deliberately, with
-- scripts/backfill-package-branch.js.

ALTER TABLE `loan_packages` ADD COLUMN `branch_id` VARCHAR(191) NULL;

CREATE INDEX `loan_packages_branch_id_fkey` ON `loan_packages`(`branch_id`);

ALTER TABLE `loan_packages`
  ADD CONSTRAINT `loan_packages_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
