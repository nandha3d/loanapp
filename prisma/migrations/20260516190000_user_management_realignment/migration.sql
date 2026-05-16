ALTER TABLE `branches`
  ADD COLUMN `superadmin_id` VARCHAR(191) NULL,
  ADD COLUMN `enabled_modules` JSON NOT NULL DEFAULT (JSON_ARRAY());

CREATE INDEX `branches_superadmin_id_fkey` ON `branches` (`superadmin_id`);

ALTER TABLE `branches`
  ADD CONSTRAINT `branches_superadmin_id_fkey`
  FOREIGN KEY (`superadmin_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `branch_requests` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `requested_by_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `branch_name` VARCHAR(191) NULL,
  `requested_modules` JSON NOT NULL,
  `reason` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `reviewed_by_id` VARCHAR(191) NULL,
  `review_note` TEXT NULL,
  `reviewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `branch_requests_tenantId_idx` ON `branch_requests` (`tenant_id`);
CREATE INDEX `branch_requests_requestedById_idx` ON `branch_requests` (`requested_by_id`);
CREATE INDEX `branch_requests_branchId_idx` ON `branch_requests` (`branch_id`);

ALTER TABLE `branch_requests`
  ADD CONSTRAINT `branch_requests_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `branch_requests_requested_by_id_fkey`
  FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `branch_requests_reviewed_by_id_fkey`
  FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `branch_requests_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `user_branch_modules` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NOT NULL,
  `enabled_modules` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `user_branch_modules_user_id_branch_id_key` ON `user_branch_modules` (`user_id`, `branch_id`);
CREATE INDEX `user_branch_modules_branchId_idx` ON `user_branch_modules` (`branch_id`);

ALTER TABLE `user_branch_modules`
  ADD CONSTRAINT `user_branch_modules_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_branch_modules_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE `branches` b
LEFT JOIN `tenant_subscriptions` ts ON ts.`tenant_id` = b.`tenant_id`
SET b.`enabled_modules` = COALESCE(ts.`enabled_modules`, JSON_ARRAY('microlending'))
WHERE b.`enabled_modules` IS NULL OR JSON_LENGTH(b.`enabled_modules`) = 0;

UPDATE `branches` b
JOIN `users` u ON u.`tenant_id` = b.`tenant_id` AND u.`role` = 'superadmin'
SET b.`superadmin_id` = u.`id`
WHERE b.`superadmin_id` IS NULL;
