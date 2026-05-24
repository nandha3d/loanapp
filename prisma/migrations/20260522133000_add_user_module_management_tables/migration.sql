CREATE TABLE IF NOT EXISTS `superadmin_branches` (
  `id` VARCHAR(191) NOT NULL,
  `superadmin_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NOT NULL,
  `assigned_by_id` VARCHAR(191) NULL,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `superadmin_branches_superadmin_id_branch_id_key` (`superadmin_id`, `branch_id`),
  KEY `superadmin_branches_branch_id_idx` (`branch_id`),
  KEY `superadmin_branches_assigned_by_id_fkey` (`assigned_by_id`),
  CONSTRAINT `superadmin_branches_superadmin_id_fkey`
    FOREIGN KEY (`superadmin_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `superadmin_branches_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `superadmin_branches_assigned_by_id_fkey`
    FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_modules` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `app_type` VARCHAR(191) NOT NULL,
  `assigned_by_id` VARCHAR(191) NULL,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_modules_user_id_app_type_key` (`user_id`, `app_type`),
  KEY `user_modules_user_id_idx` (`user_id`),
  KEY `user_modules_assigned_by_id_fkey` (`assigned_by_id`),
  CONSTRAINT `user_modules_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_modules_assigned_by_id_fkey`
    FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `module_requests` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `requested_by_id` VARCHAR(191) NOT NULL,
  `app_type` VARCHAR(191) NOT NULL,
  `reason` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `reviewed_by_id` VARCHAR(191) NULL,
  `review_note` TEXT NULL,
  `reviewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `module_requests_tenant_id_status_idx` (`tenant_id`, `status`),
  KEY `module_requests_requested_by_id_idx` (`requested_by_id`),
  KEY `module_requests_reviewed_by_id_fkey` (`reviewed_by_id`),
  CONSTRAINT `module_requests_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `module_requests_requested_by_id_fkey`
    FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `module_requests_reviewed_by_id_fkey`
    FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
