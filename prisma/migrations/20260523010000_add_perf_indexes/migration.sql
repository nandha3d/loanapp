-- PERF-04: indexes for high-frequency queries.
CREATE INDEX `customers_phone_idx` ON `customers`(`phone`);
CREATE INDEX `collection_entries_submitted_at_idx` ON `collection_entries`(`submitted_at`);
