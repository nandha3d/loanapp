-- Multi-tenant unique groupCode and safe default for gold_grams_credited
-- Avoids cross-tenant P2002 collisions on CF00001 and MySQL NULL + increment loss.

DROP INDEX `chit_groups_group_code_key` ON `chit_groups`;

CREATE UNIQUE INDEX `chit_groups_tenant_id_group_code_key`
  ON `chit_groups`(`tenant_id`, `group_code`);

UPDATE `chit_subscriptions`
  SET `gold_grams_credited` = 0.0000
  WHERE `gold_grams_credited` IS NULL;

ALTER TABLE `chit_subscriptions`
  MODIFY COLUMN `gold_grams_credited` DECIMAL(14, 4) NULL DEFAULT 0.0000;
