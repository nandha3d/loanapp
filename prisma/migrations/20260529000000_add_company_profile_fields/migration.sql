-- AlterTable: extended company / business profile fields on customers
ALTER TABLE `customers`
  ADD COLUMN `business_type` VARCHAR(191) NULL,
  ADD COLUMN `company_logo` VARCHAR(191) NULL,
  ADD COLUMN `company_pan` VARCHAR(191) NULL,
  ADD COLUMN `company_reg_no` VARCHAR(191) NULL,
  ADD COLUMN `company_address` TEXT NULL,
  ADD COLUMN `company_phone` VARCHAR(191) NULL,
  ADD COLUMN `company_email` VARCHAR(191) NULL,
  ADD COLUMN `designation` VARCHAR(191) NULL;
