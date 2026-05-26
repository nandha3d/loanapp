-- Merged migration:
-- Keep local agent_location_pings columns (lat/lng/accuracy_m/captured_at/received_at) created in
-- 20260523000000_add_gps_fields, and ADD the additional verification/tracking columns from the
-- collection-tracking module without duplicating the GPS columns already present on collection_entries.

-- Subscription gate for the GPS Collection Tracking add-on
ALTER TABLE `tenant_subscriptions`
  ADD COLUMN `gps_tracking_enabled` BOOLEAN NOT NULL DEFAULT false;

-- Customer optional contact email (used by unified notify() channel)
ALTER TABLE `customers`
  ADD COLUMN `email` VARCHAR(191) NULL;

-- Additional verification metadata on collection_entries
-- (lat/lng/gps_accuracy_m/gps_captured_at/distance_from_customer_m already exist from 20260523000000)
ALTER TABLE `collection_entries`
  ADD COLUMN `gps_altitude` DOUBLE NULL,
  ADD COLUMN `location_status` VARCHAR(191) NOT NULL DEFAULT 'not_captured',
  ADD COLUMN `borrower_lat` DOUBLE NULL,
  ADD COLUMN `borrower_lng` DOUBLE NULL;

CREATE INDEX `collection_entries_tenant_id_location_status_idx`
  ON `collection_entries`(`tenant_id`, `location_status`);

CREATE INDEX `collection_entries_submitted_at_idx`
  ON `collection_entries`(`submitted_at`);

-- Extend existing agent_location_pings table (created in 20260523000000_add_gps_fields)
ALTER TABLE `agent_location_pings`
  ADD COLUMN `branch_id` VARCHAR(191) NULL,
  ADD COLUMN `ping_type` VARCHAR(191) NOT NULL DEFAULT 'heartbeat',
  ADD COLUMN `is_on_duty` BOOLEAN NOT NULL DEFAULT true;

-- Foreign keys for the existing tenant/agent columns (were created without FKs in the earlier
-- migration) plus the new branch link.
ALTER TABLE `agent_location_pings`
  ADD CONSTRAINT `agent_location_pings_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `agent_location_pings`
  ADD CONSTRAINT `agent_location_pings_agent_id_fkey`
  FOREIGN KEY (`agent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `agent_location_pings`
  ADD CONSTRAINT `agent_location_pings_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `agent_location_pings_branch_id_captured_at_idx`
  ON `agent_location_pings`(`branch_id`, `captured_at`);
CREATE INDEX `agent_location_pings_tenant_id_received_at_idx`
  ON `agent_location_pings`(`tenant_id`, `received_at`);

-- Borrower home geocoding (used for distance-from-customer verification)
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
