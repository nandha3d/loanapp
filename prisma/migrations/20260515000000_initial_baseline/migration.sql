-- Baseline migration: captures DB state before all tracked migrations.
-- Excludes columns/tables added by subsequent migrations so they can
-- be re-applied cleanly by their own migration files.
--
-- Excluded (added by 20260516190000_user_management_realignment):
--   branches.superadmin_id, branches.enabled_modules,
--   branch_requests table, user_branch_modules table
--
-- Excluded (added by 20260519150000_collection_entry_idempotency):
--   collection_entries.idempotency_key
--
-- Excluded (added by 20260520120000_add_customer_loan_instalment_indexes):
--   3 composite indexes on customers / loans / instalments
--
-- Excluded (added by 20260521131000_add_notification_target_user):
--   system_notifications.target_user_id
--
-- Excluded (GPS Phase 1 - generated as new migration by migrate dev):
--   customers.lat/lng/geocoded_at, collection_entries GPS fields,
--   route_stops table, agent_location_pings table

-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'LoanTrack',
    `slug` VARCHAR(191) NOT NULL DEFAULT 'default',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tenants_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `branches_tenant_id_code_key`(`tenant_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `group` VARCHAR(191) NOT NULL DEFAULT 'general',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `app_settings_tenant_id_key_key`(`tenant_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `username` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'agent',
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `avatar` VARCHAR(191) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `totp_secret` VARCHAR(191) NULL,

    INDEX `users_branch_id_fkey`(`branch_id`),
    UNIQUE INDEX `users_tenant_id_username_key`(`tenant_id`, `username`),
    UNIQUE INDEX `users_tenant_id_phone_key`(`tenant_id`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routes` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `assigned_agent_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending',

    INDEX `routes_assigned_agent_id_fkey`(`assigned_agent_id`),
    INDEX `routes_branch_id_fkey`(`branch_id`),
    INDEX `routes_tenant_id_fkey`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `customer_code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `aadhar_number` VARCHAR(191) NULL,
    `route_id` VARCHAR(191) NULL,
    `agent_id` VARCHAR(191) NULL,
    `kycStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `profile_photo` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `notes` TEXT NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `pan` VARCHAR(191) NULL,

    UNIQUE INDEX `customers_user_id_key`(`user_id`),
    INDEX `customers_agent_id_fkey`(`agent_id`),
    INDEX `customers_branch_id_fkey`(`branch_id`),
    INDEX `customers_route_id_fkey`(`route_id`),
    UNIQUE INDEX `customers_tenant_id_customer_code_key`(`tenant_id`, `customer_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kyc_documents` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `doc_type` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_size` INTEGER NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kyc_documents_customer_id_fkey`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_cheques` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `bank_name` VARCHAR(191) NOT NULL,
    `cheque_number` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NULL,
    `image_path` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `loan_id` VARCHAR(191) NULL,

    INDEX `security_cheques_customer_id_fkey`(`customer_id`),
    INDEX `security_cheques_loan_id_fkey`(`loan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_packages` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `principal` DECIMAL(12, 2) NOT NULL,
    `deduction` DECIMAL(12, 2) NOT NULL,
    `frequency` VARCHAR(191) NOT NULL,
    `tenure` INTEGER NOT NULL,
    `per_instalment` DECIMAL(12, 2) NOT NULL,
    `penalty_rate` DECIMAL(12, 2) NOT NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deduction_type` VARCHAR(191) NOT NULL DEFAULT 'fixed',

    INDEX `loan_packages_tenant_id_fkey`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `loan_code` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NULL,
    `loan_type` VARCHAR(191) NOT NULL DEFAULT 'cheque',
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending',
    `collateral_details` TEXT NULL,
    `guarantor_id` VARCHAR(191) NULL,
    `principal` DECIMAL(12, 2) NOT NULL,
    `deduction` DECIMAL(12, 2) NOT NULL,
    `disbursed` DECIMAL(12, 2) NOT NULL,
    `frequency` VARCHAR(191) NOT NULL,
    `due_day` INTEGER NULL,
    `tenure` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `per_instalment` DECIMAL(12, 2) NOT NULL,
    `penalty_rate` DECIMAL(12, 2) NOT NULL,
    `voucher_ref` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `paid_count` INTEGER NOT NULL DEFAULT 0,
    `total_instalments` INTEGER NOT NULL,
    `total_collected` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `closed_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deduction_type` VARCHAR(191) NOT NULL DEFAULT 'fixed',
    `deleted_at` DATETIME(3) NULL,
    `npa_classified_at` DATETIME(3) NULL,
    `npa_status` VARCHAR(191) NULL,
    `total_payable` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    INDEX `loans_branch_id_fkey`(`branch_id`),
    INDEX `loans_created_by_id_fkey`(`created_by_id`),
    INDEX `loans_customer_id_fkey`(`customer_id`),
    INDEX `loans_guarantor_id_fkey`(`guarantor_id`),
    INDEX `loans_package_id_fkey`(`package_id`),
    UNIQUE INDEX `loans_tenant_id_loan_code_key`(`tenant_id`, `loan_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instalments` (
    `id` VARCHAR(191) NOT NULL,
    `loan_id` VARCHAR(191) NOT NULL,
    `instalment_no` INTEGER NOT NULL,
    `due_date` DATE NOT NULL,
    `due_amount` DECIMAL(12, 2) NOT NULL,
    `received_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `payment_mode` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'upcoming',
    `received_at` DATETIME(3) NULL,
    `agent_id` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `locked_at` DATETIME(3) NULL,
    `penalty_applied` BOOLEAN NOT NULL DEFAULT false,
    `collection_entry_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `instalments_collection_entry_id_key`(`collection_entry_id`),
    INDEX `instalments_due_date_idx`(`due_date`),
    INDEX `instalments_status_idx`(`status`),
    UNIQUE INDEX `instalments_loan_id_instalment_no_key`(`loan_id`, `instalment_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `penalties` (
    `id` VARCHAR(191) NOT NULL,
    `loan_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `missed_days` INTEGER NOT NULL DEFAULT 0,
    `gross_penalty` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `settled_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `waived_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `settled_by_id` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `settled_at` DATETIME(3) NULL,
    `instalment_id` VARCHAR(191) NULL,

    INDEX `penalties_customer_id_fkey`(`customer_id`),
    INDEX `penalties_loan_id_fkey`(`loan_id`),
    INDEX `penalties_settled_by_id_fkey`(`settled_by_id`),
    INDEX `penalties_instalment_id_fkey`(`instalment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_collections` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `agent_id` VARCHAR(191) NOT NULL,
    `route_id` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `total_expected` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_collected` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `entries_count` INTEGER NOT NULL DEFAULT 0,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending',
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `locked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_collections_date_idx`(`date`),
    INDEX `daily_collections_branch_id_fkey`(`branch_id`),
    INDEX `daily_collections_route_id_fkey`(`route_id`),
    INDEX `daily_collections_tenant_id_fkey`(`tenant_id`),
    INDEX `daily_collections_agent_id_idx`(`agent_id`),
    UNIQUE INDEX `daily_collections_tenant_id_app_type_agent_id_date_key`(`tenant_id`, `app_type`, `agent_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_entries` (
    `id` VARCHAR(191) NOT NULL,
    `collection_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `loan_id` VARCHAR(191) NOT NULL,
    `due_amount` DECIMAL(12, 2) NOT NULL,
    `received_amount` DECIMAL(12, 2) NOT NULL,
    `payment_mode` VARCHAR(191) NOT NULL DEFAULT 'cash',
    `remarks` TEXT NULL,
    `agent_id` VARCHAR(191) NOT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_locked` BOOLEAN NOT NULL DEFAULT true,
    `verification_status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `tenant_id` VARCHAR(191) NULL,

    INDEX `collection_entries_agent_id_fkey`(`agent_id`),
    INDEX `collection_entries_collection_id_fkey`(`collection_id`),
    INDEX `collection_entries_customer_id_fkey`(`customer_id`),
    INDEX `collection_entries_loan_id_fkey`(`loan_id`),
    INDEX `collection_entries_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'microlending',
    `type` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `link` VARCHAR(191) NULL,
    `target_role` VARCHAR(191) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_notifications_tenant_id_app_type_is_read_idx`(`tenant_id`, `app_type`, `is_read`),
    INDEX `system_notifications_branch_id_idx`(`branch_id`),
    INDEX `system_notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_templates` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_templates_tenant_id_name_channel_key`(`tenant_id`, `name`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_tenant_id_entity_type_idx`(`tenant_id`, `entity_type`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    INDEX `audit_logs_user_id_fkey`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guarantors` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `aadhar_number` VARCHAR(191) NULL,
    `photo` VARCHAR(191) NULL,
    `relation` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `guarantors_customer_id_fkey`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_collaterals` (
    `id` VARCHAR(191) NOT NULL,
    `loan_id` VARCHAR(191) NOT NULL,
    `doc_type` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `file_path` VARCHAR(191) NOT NULL,
    `file_size` INTEGER NULL,
    `description` VARCHAR(191) NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loan_collaterals_loan_id_fkey`(`loan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_requests` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `app_type` VARCHAR(191) NOT NULL,
    `request_type` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `requested_by_id` VARCHAR(191) NOT NULL,
    `requested_changes` TEXT NOT NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `reviewed_by_id` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `review_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `approval_requests_requested_by_id_fkey`(`requested_by_id`),
    INDEX `approval_requests_reviewed_by_id_fkey`(`reviewed_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `route_agents` (
    `id` VARCHAR(191) NOT NULL,
    `route_id` VARCHAR(191) NOT NULL,
    `agent_id` VARCHAR(191) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `route_agents_agent_id_fkey`(`agent_id`),
    UNIQUE INDEX `route_agents_route_id_agent_id_key`(`route_id`, `agent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'autofinance',
    `customer_id` VARCHAR(191) NOT NULL,
    `registration_no` VARCHAR(191) NOT NULL,
    `make` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `year` INTEGER NULL,
    `color` VARCHAR(191) NULL,
    `engine_no` VARCHAR(191) NULL,
    `chassis_no` VARCHAR(191) NULL,
    `insurance_expiry` DATE NULL,
    `rc_doc_path` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `insurance_path` VARCHAR(191) NULL,
    `loan_id` VARCHAR(191) NULL,
    `repo_flag` BOOLEAN NOT NULL DEFAULT false,
    `repo_flagged_at` DATETIME(3) NULL,
    `repo_flagged_by_id` VARCHAR(191) NULL,
    `vehicle_type` VARCHAR(191) NOT NULL DEFAULT 'two_wheeler',
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `vehicles_loan_id_key`(`loan_id`),
    INDEX `vehicles_customer_id_idx`(`customer_id`),
    INDEX `vehicles_repo_flag_idx`(`repo_flag`),
    INDEX `vehicles_repo_flagged_by_id_fkey`(`repo_flagged_by_id`),
    UNIQUE INDEX `vehicles_tenant_id_app_type_registration_no_key`(`tenant_id`, `app_type`, `registration_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_groups` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `app_type` VARCHAR(191) NOT NULL DEFAULT 'chitfunds',
    `name` VARCHAR(191) NOT NULL,
    `chit_value` DECIMAL(14, 2) NOT NULL,
    `monthly_contrib` DECIMAL(14, 2) NOT NULL,
    `total_members` INTEGER NOT NULL,
    `duration_months` INTEGER NOT NULL,
    `commission_pct` DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    `start_date` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `chit_groups_tenant_id_app_type_status_idx`(`tenant_id`, `app_type`, `status`),
    INDEX `chit_groups_branch_id_fkey`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_members` (
    `id` VARCHAR(191) NOT NULL,
    `chit_group_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `member_number` INTEGER NOT NULL,
    `has_won` BOOLEAN NOT NULL DEFAULT false,
    `won_at` DATETIME(3) NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chit_members_customer_id_fkey`(`customer_id`),
    UNIQUE INDEX `chit_members_chit_group_id_customer_id_key`(`chit_group_id`, `customer_id`),
    UNIQUE INDEX `chit_members_chit_group_id_member_number_key`(`chit_group_id`, `member_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_auctions` (
    `id` VARCHAR(191) NOT NULL,
    `chit_group_id` VARCHAR(191) NOT NULL,
    `period_number` INTEGER NOT NULL,
    `auction_date` DATE NOT NULL,
    `winner_member_id` VARCHAR(191) NULL,
    `prize_amount` DECIMAL(14, 2) NULL,
    `bid_discount` DECIMAL(14, 2) NULL,
    `commission` DECIMAL(14, 2) NULL,
    `dividend` DECIMAL(14, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chit_auctions_winner_member_id_fkey`(`winner_member_id`),
    UNIQUE INDEX `chit_auctions_chit_group_id_period_number_key`(`chit_group_id`, `period_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chit_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `member_id` VARCHAR(191) NOT NULL,
    `period_number` INTEGER NOT NULL,
    `due_date` DATE NOT NULL,
    `due_amount` DECIMAL(14, 2) NOT NULL,
    `paid_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(191) NOT NULL DEFAULT 'upcoming',
    `paid_at` DATETIME(3) NULL,

    INDEX `chit_subscriptions_member_id_period_number_idx`(`member_id`, `period_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'trial',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `max_active_loans` INTEGER NOT NULL DEFAULT 50,
    `max_agents` INTEGER NOT NULL DEFAULT 3,
    `max_branches` INTEGER NOT NULL DEFAULT 1,
    `enabled_modules` LONGTEXT NOT NULL,
    `trial_ends_at` DATETIME(3) NULL,
    `current_period_end` DATETIME(3) NULL,
    `razorpay_sub_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `grace_period_end` DATETIME(3) NULL,

    UNIQUE INDEX `tenant_subscriptions_tenant_id_key`(`tenant_id`),
    UNIQUE INDEX `tenant_subscriptions_razorpay_sub_id_key`(`razorpay_sub_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rate_key` VARCHAR(512) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `window_start` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `rate_limits_rate_key_key`(`rate_key`),
    INDEX `rate_limits_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `event_id` VARCHAR(255) NOT NULL,
    `event` VARCHAR(128) NOT NULL,
    `payload` TEXT NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'processed',
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `webhook_events_created_at_idx`(`created_at`),
    UNIQUE INDEX `webhook_events_provider_event_id_key`(`provider`, `event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `loan_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_mode` VARCHAR(191) NOT NULL,
    `reference_number` VARCHAR(191) NULL,
    `payment_date` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payments_loan_id_idx`(`loan_id`),
    INDEX `payments_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(191) NOT NULL,
    `instalment_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_allocations_payment_id_idx`(`payment_id`),
    INDEX `payment_allocations_instalment_id_idx`(`instalment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `due_date` DATETIME(3) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `razorpay_id` VARCHAR(191) NULL,
    `invoice_url` VARCHAR(191) NULL,
    `billing_period` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `subscription_id` VARCHAR(191) NULL,

    INDEX `billing_invoices_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cron_locks` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'penalty_accrual',
    `locked_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_entries` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NULL,
    `entry_date` DATE NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `amount` DECIMAL(12, 2) NOT NULL,
    `description` TEXT NULL,
    `reference_id` VARCHAR(191) NULL,
    `reference_type` VARCHAR(191) NULL,
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `account_entries_tenant_id_entry_date_idx`(`tenant_id`, `entry_date`),
    INDEX `account_entries_tenant_id_type_idx`(`tenant_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_handovers` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `agent_id` VARCHAR(191) NOT NULL,
    `admin_id` VARCHAR(191) NULL,
    `route_id` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `collected_at` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `remarks` TEXT NULL,

    INDEX `cash_handovers_tenant_id_agent_id_status_idx`(`tenant_id`, `agent_id`, `status`),
    INDEX `cash_handovers_admin_id_idx`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `branches_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `app_settings` ADD CONSTRAINT `app_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_assigned_agent_id_fkey` FOREIGN KEY (`assigned_agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routes` ADD CONSTRAINT `routes_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kyc_documents` ADD CONSTRAINT `kyc_documents_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_cheques` ADD CONSTRAINT `security_cheques_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_cheques` ADD CONSTRAINT `security_cheques_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_packages` ADD CONSTRAINT `loan_packages_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_guarantor_id_fkey` FOREIGN KEY (`guarantor_id`) REFERENCES `guarantors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `loan_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instalments` ADD CONSTRAINT `instalments_collection_entry_id_fkey` FOREIGN KEY (`collection_entry_id`) REFERENCES `collection_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instalments` ADD CONSTRAINT `instalments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penalties` ADD CONSTRAINT `penalties_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penalties` ADD CONSTRAINT `penalties_instalment_id_fkey` FOREIGN KEY (`instalment_id`) REFERENCES `instalments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penalties` ADD CONSTRAINT `penalties_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penalties` ADD CONSTRAINT `penalties_settled_by_id_fkey` FOREIGN KEY (`settled_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_collections` ADD CONSTRAINT `daily_collections_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_collections` ADD CONSTRAINT `daily_collections_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_collections` ADD CONSTRAINT `daily_collections_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_collections` ADD CONSTRAINT `daily_collections_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_entries` ADD CONSTRAINT `collection_entries_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_entries` ADD CONSTRAINT `collection_entries_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `daily_collections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_entries` ADD CONSTRAINT `collection_entries_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_entries` ADD CONSTRAINT `collection_entries_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_entries` ADD CONSTRAINT `collection_entries_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_notifications` ADD CONSTRAINT `system_notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_templates` ADD CONSTRAINT `notification_templates_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guarantors` ADD CONSTRAINT `guarantors_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_collaterals` ADD CONSTRAINT `loan_collaterals_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_agents` ADD CONSTRAINT `route_agents_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `route_agents` ADD CONSTRAINT `route_agents_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_repo_flagged_by_id_fkey` FOREIGN KEY (`repo_flagged_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_groups` ADD CONSTRAINT `chit_groups_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_groups` ADD CONSTRAINT `chit_groups_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_members` ADD CONSTRAINT `chit_members_chit_group_id_fkey` FOREIGN KEY (`chit_group_id`) REFERENCES `chit_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_members` ADD CONSTRAINT `chit_members_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_auctions` ADD CONSTRAINT `chit_auctions_chit_group_id_fkey` FOREIGN KEY (`chit_group_id`) REFERENCES `chit_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_auctions` ADD CONSTRAINT `chit_auctions_winner_member_id_fkey` FOREIGN KEY (`winner_member_id`) REFERENCES `chit_members`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chit_subscriptions` ADD CONSTRAINT `chit_subscriptions_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `chit_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_instalment_id_fkey` FOREIGN KEY (`instalment_id`) REFERENCES `instalments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_invoices` ADD CONSTRAINT `billing_invoices_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_entries` ADD CONSTRAINT `account_entries_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_entries` ADD CONSTRAINT `account_entries_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_entries` ADD CONSTRAINT `account_entries_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_handovers` ADD CONSTRAINT `cash_handovers_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_handovers` ADD CONSTRAINT `cash_handovers_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_handovers` ADD CONSTRAINT `cash_handovers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_handovers` ADD CONSTRAINT `cash_handovers_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
