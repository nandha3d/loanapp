-- ============================================================================
-- PROPOSED MIGRATION — NOT APPLIED. Review + sign-off required (Rule 2).
-- ============================================================================
-- Adds collateral/detail tables for the two new lending verticals (property,
-- productfinance). The vertical CONFIG (slugs, branding, plan inclusion, nav,
-- pricing catalog) ships separately and is already live/typechecked — these
-- tables only add the collateral capture + release/repossession tracking,
-- mirroring gold_loan_collaterals.
--
-- Additive only: two new tables + four nullable back-relation columns are NOT
-- needed (Prisma back-relations are virtual). No changes to existing tables.
--
-- Apply procedure (after sign-off):
--   1. Add the two Prisma models below to prisma/schema.prisma, plus the
--      matching back-relation arrays on Tenant, Branch, Loan, Customer:
--        propertyCollaterals  PropertyCollateral[]
--        productFinanceItems  ProductFinanceItem[]
--   2. npx prisma migrate dev --name property_product_collateral  (regenerates this SQL)
--   3. Add appType-aware capture blocks in
--      app/(dashboard)/[module]/loans/actions.ts (mirror the goldCollateral
--      block) and the matching backend persistence.
--   4. Add /property and /products routes + MODULE_ROUTES entries.
-- ----------------------------------------------------------------------------

CREATE TABLE `property_collaterals` (
  `id`                   VARCHAR(191) NOT NULL,
  `tenant_id`            VARCHAR(191) NOT NULL,
  `branch_id`            VARCHAR(191) NULL,
  `loan_id`              VARCHAR(191) NOT NULL,
  `customer_id`          VARCHAR(191) NOT NULL,
  `property_type`        VARCHAR(191) NULL,
  `address`              TEXT NULL,
  `survey_no`            VARCHAR(191) NULL,
  `extent_value`         DECIMAL(14, 2) NULL,
  `extent_unit`          VARCHAR(191) NULL,
  `market_value`         DECIMAL(14, 2) NULL,
  `eligible_ltv_percent` DECIMAL(5, 2) NULL,
  `eligible_amount`      DECIMAL(14, 2) NULL,
  `encumbrance_status`   VARCHAR(191) NULL,
  `registration_no`      VARCHAR(191) NULL,
  `valuer_name`          VARCHAR(191) NULL,
  `valuation_date`       DATE NULL,
  `mortgage_status`      VARCHAR(191) NOT NULL DEFAULT 'mortgaged',
  `released_at`          DATETIME(3) NULL,
  `released_by`          VARCHAR(191) NULL,
  `title_deed_path`      VARCHAR(191) NULL,
  `ec_path`              VARCHAR(191) NULL,
  `tax_receipt_path`     VARCHAR(191) NULL,
  `photo_path`           VARCHAR(191) NULL,
  `created_at`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`           DATETIME(3) NOT NULL,
  UNIQUE INDEX `property_collaterals_loan_id_key`(`loan_id`),
  INDEX `property_collaterals_tenant_id_mortgage_status_idx`(`tenant_id`, `mortgage_status`),
  INDEX `property_collaterals_branch_id_idx`(`branch_id`),
  INDEX `property_collaterals_customer_id_idx`(`customer_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_finance_items` (
  `id`                   VARCHAR(191) NOT NULL,
  `tenant_id`            VARCHAR(191) NOT NULL,
  `branch_id`            VARCHAR(191) NULL,
  `loan_id`              VARCHAR(191) NOT NULL,
  `customer_id`          VARCHAR(191) NOT NULL,
  `category`             VARCHAR(191) NULL,
  `product_name`         VARCHAR(191) NULL,
  `brand`                VARCHAR(191) NULL,
  `model_no`             VARCHAR(191) NULL,
  `serial_no`            VARCHAR(191) NULL,
  `dealer_name`          VARCHAR(191) NULL,
  `dealer_id`            VARCHAR(191) NULL,
  `invoice_no`           VARCHAR(191) NULL,
  `invoice_amount`       DECIMAL(14, 2) NULL,
  `down_payment`         DECIMAL(14, 2) NULL,
  `financed_amount`      DECIMAL(14, 2) NULL,
  `tenure_months`        INT NULL,
  `warranty_expiry`      DATE NULL,
  `repossession_status`  VARCHAR(191) NOT NULL DEFAULT 'active',
  `repossessed_at`       DATETIME(3) NULL,
  `invoice_path`         VARCHAR(191) NULL,
  `photo_path`           VARCHAR(191) NULL,
  `created_at`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`           DATETIME(3) NOT NULL,
  UNIQUE INDEX `product_finance_items_loan_id_key`(`loan_id`),
  INDEX `product_finance_items_tenant_id_repossession_status_idx`(`tenant_id`, `repossession_status`),
  INDEX `product_finance_items_branch_id_idx`(`branch_id`),
  INDEX `product_finance_items_customer_id_idx`(`customer_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Optional FK constraints (match the style used by gold_loan_collaterals):
-- ALTER TABLE `property_collaterals` ADD CONSTRAINT `property_collaterals_loan_id_fkey`
--   FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- (repeat for tenant_id, branch_id, customer_id, and for product_finance_items)

-- ----------------------------------------------------------------------------
-- Prisma model snippets to paste into prisma/schema.prisma (step 1 above):
-- ----------------------------------------------------------------------------
-- model PropertyCollateral {
--   id                 String    @id @default(cuid())
--   tenantId           String    @map("tenant_id")
--   branchId           String?   @map("branch_id")
--   loanId             String    @unique @map("loan_id")
--   customerId         String    @map("customer_id")
--   propertyType       String?   @map("property_type")
--   address            String?   @db.Text
--   surveyNo           String?   @map("survey_no")
--   extentValue        Decimal?  @map("extent_value") @db.Decimal(14, 2)
--   extentUnit         String?   @map("extent_unit")
--   marketValue        Decimal?  @map("market_value") @db.Decimal(14, 2)
--   eligibleLtvPercent Decimal?  @map("eligible_ltv_percent") @db.Decimal(5, 2)
--   eligibleAmount     Decimal?  @map("eligible_amount") @db.Decimal(14, 2)
--   encumbranceStatus  String?   @map("encumbrance_status")
--   registrationNo     String?   @map("registration_no")
--   valuerName         String?   @map("valuer_name")
--   valuationDate      DateTime? @map("valuation_date") @db.Date
--   mortgageStatus     String    @default("mortgaged") @map("mortgage_status")
--   releasedAt         DateTime? @map("released_at")
--   releasedBy         String?   @map("released_by")
--   titleDeedPath      String?   @map("title_deed_path")
--   ecPath             String?   @map("ec_path")
--   taxReceiptPath     String?   @map("tax_receipt_path")
--   photoPath          String?   @map("photo_path")
--   createdAt          DateTime  @default(now()) @map("created_at")
--   updatedAt          DateTime  @updatedAt @map("updated_at")
--   tenant   Tenant   @relation(fields: [tenantId], references: [id])
--   branch   Branch?  @relation(fields: [branchId], references: [id])
--   loan     Loan     @relation(fields: [loanId], references: [id])
--   customer Customer @relation(fields: [customerId], references: [id])
--   @@index([tenantId, mortgageStatus])
--   @@index([branchId])
--   @@index([customerId])
--   @@map("property_collaterals")
-- }
--
-- model ProductFinanceItem {
--   id                  String    @id @default(cuid())
--   tenantId            String    @map("tenant_id")
--   branchId            String?   @map("branch_id")
--   loanId              String    @unique @map("loan_id")
--   customerId          String    @map("customer_id")
--   category            String?
--   productName         String?   @map("product_name")
--   brand               String?
--   modelNo             String?   @map("model_no")
--   serialNo            String?   @map("serial_no")
--   dealerName          String?   @map("dealer_name")
--   dealerId            String?   @map("dealer_id")
--   invoiceNo           String?   @map("invoice_no")
--   invoiceAmount       Decimal?  @map("invoice_amount") @db.Decimal(14, 2)
--   downPayment         Decimal?  @map("down_payment") @db.Decimal(14, 2)
--   financedAmount      Decimal?  @map("financed_amount") @db.Decimal(14, 2)
--   tenureMonths        Int?      @map("tenure_months")
--   warrantyExpiry      DateTime? @map("warranty_expiry") @db.Date
--   repossessionStatus  String    @default("active") @map("repossession_status")
--   repossessedAt       DateTime? @map("repossessed_at")
--   invoicePath         String?   @map("invoice_path")
--   photoPath           String?   @map("photo_path")
--   createdAt           DateTime  @default(now()) @map("created_at")
--   updatedAt           DateTime  @updatedAt @map("updated_at")
--   tenant   Tenant   @relation(fields: [tenantId], references: [id])
--   branch   Branch?  @relation(fields: [branchId], references: [id])
--   loan     Loan     @relation(fields: [loanId], references: [id])
--   customer Customer @relation(fields: [customerId], references: [id])
--   @@index([tenantId, repossessionStatus])
--   @@index([branchId])
--   @@index([customerId])
--   @@map("product_finance_items")
-- }
