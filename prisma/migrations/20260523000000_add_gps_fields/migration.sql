-- GPS Phase 1: add lat/lng to customers + collection_entries, new RouteStop + AgentLocationPing models.

-- AlterTable
ALTER TABLE `customers`
  ADD COLUMN `lat` DOUBLE NULL,
  ADD COLUMN `lng` DOUBLE NULL,
  ADD COLUMN `geocoded_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `collection_entries`
  ADD COLUMN `lat` DOUBLE NULL,
  ADD COLUMN `lng` DOUBLE NULL,
  ADD COLUMN `gps_accuracy_m` DOUBLE NULL,
  ADD COLUMN `gps_captured_at` DATETIME(3) NULL,
  ADD COLUMN `distance_from_customer_m` DOUBLE NULL;

-- CreateTable
CREATE TABLE `route_stops` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `route_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `route_stops_tenant_id_idx`(`tenant_id`),
    INDEX `route_stops_route_id_sequence_idx`(`route_id`, `sequence`),
    UNIQUE INDEX `route_stops_route_id_customer_id_key`(`route_id`, `customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_location_pings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `agent_id` VARCHAR(191) NOT NULL,
    `route_id` VARCHAR(191) NULL,
    `lat` DOUBLE NOT NULL,
    `lng` DOUBLE NOT NULL,
    `accuracy_m` DOUBLE NULL,
    `speed_mps` DOUBLE NULL,
    `captured_at` DATETIME(3) NOT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `agent_location_pings_tenant_id_agent_id_captured_at_idx`(`tenant_id`, `agent_id`, `captured_at`),
    INDEX `agent_location_pings_route_id_captured_at_idx`(`route_id`, `captured_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
