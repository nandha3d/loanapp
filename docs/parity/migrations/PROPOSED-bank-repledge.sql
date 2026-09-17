-- ============================================================================
-- PROPOSED MIGRATION — NOT APPLIED to prod. Review + sign-off (Rule 2).
-- ============================================================================
-- Bank repledge: the pledged gold re-pledged to a bank for liquidity. Additive
-- table, relates only to loans. Model already in prisma/schema.prisma.
-- ----------------------------------------------------------------------------

CREATE TABLE `bank_repledges` (
  `id`                   VARCHAR(191) NOT NULL,
  `tenant_id`            VARCHAR(191) NOT NULL,
  `loan_id`              VARCHAR(191) NOT NULL,
  `bank_name`            VARCHAR(191) NOT NULL,
  `bank_date`            DATE NOT NULL,
  `reference_no`         VARCHAR(191) NULL,
  `amount_given_by_bank` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `interest_rate`        DECIMAL(5, 2) NULL,
  `processing_fee`       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `staff_name`           VARCHAR(191) NULL,
  `status`               VARCHAR(191) NOT NULL DEFAULT 'active',
  `created_at`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`           DATETIME(3) NOT NULL,
  INDEX `bank_repledges_tenant_id_idx`(`tenant_id`),
  INDEX `bank_repledges_loan_id_idx`(`loan_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ALTER TABLE `bank_repledges` ADD CONSTRAINT `bank_repledges_loan_id_fkey`
--   FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
