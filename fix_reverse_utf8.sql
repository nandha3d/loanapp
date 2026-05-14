-- DropIndex
DROP INDEX `daily_collections_agent_id_date_key` ON `daily_collections`;

-- AlterTable
ALTER TABLE `tenant_subscriptions` ADD COLUMN `grace_period_end` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `daily_collections_tenant_id_app_type_agent_id_date_key` ON `daily_collections`(`tenant_id`, `app_type`, `agent_id`, `date`);

-- RedefineIndex
CREATE UNIQUE INDEX `webhook_events_provider_event_id_key` ON `webhook_events`(`provider`, `event_id`);
DROP INDEX `webhook_events_provider_eventId_key` ON `webhook_events`;


