ALTER TABLE `tenant_subscriptions`
  ADD COLUMN `gps_tracking_enabled` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `collection_entries`
  ADD COLUMN `latitude` DOUBLE NULL,
  ADD COLUMN `longitude` DOUBLE NULL,
  ADD COLUMN `gps_accuracy` DOUBLE NULL,
  ADD COLUMN `gps_timestamp` DATETIME(3) NULL,
  ADD COLUMN `gps_altitude` DOUBLE NULL,
  ADD COLUMN `location_status` VARCHAR(191) NOT NULL DEFAULT 'not_captured',
  ADD COLUMN `distance_from_borrower` DOUBLE NULL,
  ADD COLUMN `borrower_lat` DOUBLE NULL,
  ADD COLUMN `borrower_lng` DOUBLE NULL;

CREATE INDEX `collection_entries_tenant_id_location_status_idx`
  ON `collection_entries`(`tenant_id`, `location_status`);

CREATE TABLE `agent_location_pings` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `agent_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `latitude` DOUBLE NOT NULL,
  `longitude` DOUBLE NOT NULL,
  `accuracy` DOUBLE NULL,
  `ping_type` VARCHAR(191) NOT NULL DEFAULT 'heartbeat',
  `device_time` DATETIME(3) NOT NULL,
  `server_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_on_duty` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `agent_location_pings_agent_id_server_time_idx`
  ON `agent_location_pings`(`agent_id`, `server_time`);
CREATE INDEX `agent_location_pings_tenant_id_server_time_idx`
  ON `agent_location_pings`(`tenant_id`, `server_time`);
CREATE INDEX `agent_location_pings_branch_id_server_time_idx`
  ON `agent_location_pings`(`branch_id`, `server_time`);

ALTER TABLE `agent_location_pings`
  ADD CONSTRAINT `agent_location_pings_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `agent_location_pings`
  ADD CONSTRAINT `agent_location_pings_agent_id_fkey`
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `agent_location_pings`
  ADD CONSTRAINT `agent_location_pings_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `customer_geocodes` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NOT NULL,
  `latitude` DOUBLE NOT NULL,
  `longitude` DOUBLE NOT NULL,
  `accuracy` VARCHAR(191) NOT NULL DEFAULT 'approximate',
  `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
  `raw_address` TEXT NOT NULL,
  `geocoded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `customer_geocodes_customer_id_key`
  ON `customer_geocodes`(`customer_id`);
CREATE INDEX `customer_geocodes_tenant_id_idx`
  ON `customer_geocodes`(`tenant_id`);

ALTER TABLE `customer_geocodes`
  ADD CONSTRAINT `customer_geocodes_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customer_geocodes`
  ADD CONSTRAINT `customer_geocodes_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
