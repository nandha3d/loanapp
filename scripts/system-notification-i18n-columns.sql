-- SystemNotification i18n + dedupe columns — OPTIONAL manual equivalent of the
-- schema.prisma change. Prod deploys use 'prisma db push' (DEPLOY-4), which adds
-- these on its own; run this by hand only if you apply schema changes manually.
--
-- All four columns are nullable with no default, so existing rows and the
-- previous build keep working untouched. Safe to deploy BEFORE the new code.
-- BACK UP the database first. Re-running errors on "Duplicate column" — harmless.
ALTER TABLE `system_notifications`
  ADD COLUMN `title_key`   VARCHAR(191) NULL,
  ADD COLUMN `message_key` VARCHAR(191) NULL,
  ADD COLUMN `params`      TEXT NULL,
  ADD COLUMN `dedupe_key`  VARCHAR(191) NULL;

CREATE INDEX `system_notifications_target_user_id_dedupe_key_idx`
  ON `system_notifications` (`target_user_id`, `dedupe_key`);
