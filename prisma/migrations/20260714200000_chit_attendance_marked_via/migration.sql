-- Doc 18 (auto attendance on portal login). Additive/defaulted: existing
-- rows backfill to 'staff' (manual marking was the only path before this
-- feature), so no data migration is needed beyond the column default.

ALTER TABLE `chit_auction_attendance`
  ADD COLUMN `marked_via` VARCHAR(191) NOT NULL DEFAULT 'staff';
