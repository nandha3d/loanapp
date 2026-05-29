-- AlterTable: Fraud-01 customer PIN confirmation fields on collection_entries.
-- These were added to schema.prisma in 896c7d1 without an accompanying migration,
-- so the columns were missing from the database.
ALTER TABLE `collection_entries`
  ADD COLUMN `customer_pin_confirmed` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `customer_pin_confirmed_at` DATETIME(3) NULL;
