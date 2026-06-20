-- Customer preferred collection time (agent visit window). Additive & nullable,
-- so existing customers and create/update flows behave exactly as before.

ALTER TABLE `customers`
    ADD COLUMN `preferred_collection_time` VARCHAR(191) NULL;
