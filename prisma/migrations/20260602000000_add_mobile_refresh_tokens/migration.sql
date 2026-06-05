-- CreateTable: mobile_refresh_tokens (SEC-07).
-- The MobileRefreshToken model was added to schema.prisma (refresh-token
-- rotation for the Flutter app) without an accompanying migration, so the
-- table was missing from the database and /api/v1/auth/refresh silently
-- returned 401 (the code caught the "table doesn't exist" error and treated
-- every refresh as invalid). This creates the table.
CREATE TABLE `mobile_refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mobile_refresh_tokens_token_key`(`token`),
    INDEX `mobile_refresh_tokens_user_id_fkey`(`user_id`),
    INDEX `mobile_refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
