-- Cash handovers carry the module and branch of the agent's float, so the
-- wallet screens can scope them like every other money row (SCOPE-13, SCOPE-17.5).
ALTER TABLE `cash_handovers` ADD COLUMN `app_type` VARCHAR(191) NULL;
ALTER TABLE `cash_handovers` ADD COLUMN `branch_id` VARCHAR(191) NULL;
CREATE INDEX `cash_handovers_tenant_id_app_type_branch_id_status_idx`
  ON `cash_handovers`(`tenant_id`, `app_type`, `branch_id`, `status`);

-- Agents are pinned to one module (AUTH-3) and belong to one branch, so the
-- agent row is a reliable source for existing handovers. Rows whose agent has
-- no branch stay NULL and surface only after the agent is repaired (SCOPE-4).
UPDATE `cash_handovers` h
  JOIN `users` u ON u.`id` = h.`agent_id`
   SET h.`app_type` = u.`app_type`,
       h.`branch_id` = u.`branch_id`
 WHERE h.`app_type` IS NULL;
