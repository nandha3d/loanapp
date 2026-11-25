-- 1. Allow multiple chit tickets per customer in the same chit group
-- Create non-unique composite index FIRST so MySQL InnoDB keeps a valid FK index on chit_group_id before dropping the unique key
CREATE INDEX `chit_members_chit_group_id_customer_id_idx` ON `chit_members`(`chit_group_id`, `customer_id`);
ALTER TABLE `chit_members` DROP INDEX `chit_members_chit_group_id_customer_id_key`;

-- 2. Custom staff / foreman roles managed by Tenant Admin / Superadmin
CREATE TABLE `custom_roles` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `app_type` VARCHAR(191) NOT NULL DEFAULT 'chitfunds',
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `base_role` VARCHAR(191) NOT NULL DEFAULT 'agent',
  `permissions_json` TEXT NOT NULL,
  `is_system` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `created_by_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `custom_roles_tenant_id_app_type_name_key`(`tenant_id`, `app_type`, `name`),
  INDEX `custom_roles_tenant_id_app_type_status_idx`(`tenant_id`, `app_type`, `status`),
  INDEX `custom_roles_branch_id_fkey`(`branch_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `custom_roles`
  ADD CONSTRAINT `custom_roles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `custom_roles_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Staff / Foreman custom role metadata on users (base `role` stays unchanged for ROLE-3 compatibility)
ALTER TABLE `users`
  ADD COLUMN `custom_role_id` VARCHAR(191) NULL,
  ADD COLUMN `custom_role_name` VARCHAR(191) NULL,
  ADD COLUMN `staff_permissions` TEXT NULL,
  ADD INDEX `users_custom_role_id_fkey`(`custom_role_id`);

ALTER TABLE `users`
  ADD CONSTRAINT `users_custom_role_id_fkey` FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Multiple Foremen per Chit Group
CREATE TABLE `chit_group_foremen` (
  `id` VARCHAR(191) NOT NULL,
  `chit_group_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `role_label` VARCHAR(191) NOT NULL DEFAULT 'Foreman',
  `is_primary` BOOLEAN NOT NULL DEFAULT false,
  `assigned_by_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `chit_group_foremen_chit_group_id_user_id_key`(`chit_group_id`, `user_id`),
  INDEX `chit_group_foremen_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `chit_group_foremen`
  ADD CONSTRAINT `chit_group_foremen_chit_group_id_fkey` FOREIGN KEY (`chit_group_id`) REFERENCES `chit_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `chit_group_foremen_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
