-- DropIndex
DROP INDEX `daily_collections_tenant_id_app_type_agent_id_date_key` ON `daily_collections`;

-- AlterTable
ALTER TABLE `tenant_subscriptions` DROP COLUMN `grace_period_end`;

-- CreateIndex
CREATE UNIQUE INDEX `daily_collections_agent_id_date_key` ON `daily_collections`(`agent_id` ASC, `date` ASC);

-- RenameIndex
ALTER TABLE `webhook_events` RENAME INDEX `webhook_events_provider_event_id_key` TO `webhook_events_provider_eventId_key`;


