ALTER TABLE `chit_auctions`
  ADD COLUMN `result_notified_at` DATETIME(3) NULL,
  ADD COLUMN `dividend_notified_at` DATETIME(3) NULL;

ALTER TABLE `chit_subscriptions`
  ADD COLUMN `reminder_day_before_at` DATETIME(3) NULL,
  ADD COLUMN `reminder_due_day_at` DATETIME(3) NULL;
