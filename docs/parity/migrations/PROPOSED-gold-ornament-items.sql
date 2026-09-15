-- ============================================================================
-- PROPOSED MIGRATION — NOT APPLIED. Review + sign-off required (Rule 2).
-- ============================================================================
-- Per-ornament line items for a gold/silver pledge (competitor parity: a pledge
-- holds many ornaments). The gold_loan_collaterals row stays the pledge header
-- (packet, storage, valuer, aggregate totals). Additive only.
-- Model GoldOrnamentItem already added to prisma/schema.prisma.
-- ----------------------------------------------------------------------------

CREATE TABLE `gold_ornament_items` (
  `id`                 VARCHAR(191) NOT NULL,
  `tenant_id`          VARCHAR(191) NOT NULL,
  `collateral_id`      VARCHAR(191) NOT NULL,
  `ornament_type`      VARCHAR(191) NOT NULL,
  `specification`      VARCHAR(191) NULL,
  `purity_karat`       VARCHAR(191) NULL,
  `quantity`           INT NOT NULL DEFAULT 1,
  `gross_weight_grams` DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `wastage_grams`      DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `net_weight_grams`   DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `rate_per_gram`      DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `value`              DECIMAL(14, 2) NOT NULL DEFAULT 0,
  `bank_name`          VARCHAR(191) NULL,
  `ref_no`             VARCHAR(191) NULL,
  `photo_path`         VARCHAR(191) NULL,
  `sort_order`         INT NOT NULL DEFAULT 0,
  `created_at`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`         DATETIME(3) NOT NULL,
  INDEX `gold_ornament_items_tenant_id_idx`(`tenant_id`),
  INDEX `gold_ornament_items_collateral_id_idx`(`collateral_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ALTER TABLE `gold_ornament_items` ADD CONSTRAINT `gold_ornament_items_collateral_id_fkey`
--   FOREIGN KEY (`collateral_id`) REFERENCES `gold_loan_collaterals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
