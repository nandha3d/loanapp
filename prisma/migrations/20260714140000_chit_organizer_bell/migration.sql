-- Doc 14 (organizer bell — "going once/twice/sold"). Additive/defaulted:
-- bellEnabled defaults true, bellAutoClose defaults true (matches the
-- traditional "sold on the third bell" behaviour), no change for existing
-- open rooms until the next poll/bid re-anchors them.

ALTER TABLE `chit_groups`
  ADD COLUMN `bell_enabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `bell_interval_seconds` INT NOT NULL DEFAULT 60,
  ADD COLUMN `bell_count` INT NOT NULL DEFAULT 3,
  ADD COLUMN `bell_auto_close` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `chit_auctions`
  ADD COLUMN `bell_anchor_at` DATETIME(3) NULL,
  ADD COLUMN `bells_rung` INT NOT NULL DEFAULT 0;
