-- ============================================================================
-- PROPOSED MIGRATION — NOT APPLIED. Review + sign-off required (Rule 2).
-- ============================================================================
-- Gold/Silver master data tables — the no-hardcode source for pledge dropdowns
-- (ornament types, specifications, bank names). Per-tenant, admin-editable.
-- Models already added to prisma/schema.prisma (OrnamentType,
-- OrnamentSpecification, BankName) so the client typechecks; this SQL creates
-- the tables. Additive only — no changes to existing tables.
--
-- Apply (after sign-off): either
--   npx prisma migrate dev --name gold_master_data    (regenerates this SQL), or
--   run this SQL then `prisma migrate resolve` to record it.
-- ----------------------------------------------------------------------------

CREATE TABLE `ornament_types` (
  `id`         VARCHAR(191) NOT NULL,
  `tenant_id`  VARCHAR(191) NOT NULL,
  `name`       VARCHAR(191) NOT NULL,
  `metal`      VARCHAR(191) NOT NULL DEFAULT 'gold',
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ornament_types_tenant_id_name_key`(`tenant_id`, `name`),
  INDEX `ornament_types_tenant_id_metal_is_active_idx`(`tenant_id`, `metal`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ornament_specifications` (
  `id`          VARCHAR(191) NOT NULL,
  `tenant_id`   VARCHAR(191) NOT NULL,
  `name`        VARCHAR(191) NOT NULL,
  `purity_karat` VARCHAR(191) NULL,
  `is_active`   BOOLEAN NOT NULL DEFAULT true,
  `sort_order`  INT NOT NULL DEFAULT 0,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL,
  UNIQUE INDEX `ornament_specifications_tenant_id_name_key`(`tenant_id`, `name`),
  INDEX `ornament_specifications_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bank_names` (
  `id`         VARCHAR(191) NOT NULL,
  `tenant_id`  VARCHAR(191) NOT NULL,
  `name`       VARCHAR(191) NOT NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `bank_names_tenant_id_name_key`(`tenant_id`, `name`),
  INDEX `bank_names_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Optional FK constraints (match existing style):
-- ALTER TABLE `ornament_types` ADD CONSTRAINT `ornament_types_tenant_id_fkey`
--   FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- (repeat for ornament_specifications, bank_names)
