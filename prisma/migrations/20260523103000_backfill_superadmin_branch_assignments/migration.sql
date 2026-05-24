UPDATE `branches` b
JOIN (
  SELECT `tenant_id`, MIN(`id`) AS `superadmin_id`, COUNT(*) AS `superadmin_count`
  FROM `users`
  WHERE `role` = 'superadmin' AND `status` = 'active'
  GROUP BY `tenant_id`
) s ON s.`tenant_id` = b.`tenant_id` AND s.`superadmin_count` = 1
SET b.`superadmin_id` = s.`superadmin_id`
WHERE b.`superadmin_id` IS NULL;

INSERT INTO `superadmin_branches` (`id`, `superadmin_id`, `branch_id`, `assigned_by_id`, `assigned_at`)
SELECT
  CONCAT('sb_', REPLACE(UUID(), '-', '')),
  b.`superadmin_id`,
  b.`id`,
  NULL,
  NOW(3)
FROM `branches` b
WHERE b.`superadmin_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `superadmin_branches` sb
    WHERE sb.`superadmin_id` = b.`superadmin_id`
      AND sb.`branch_id` = b.`id`
  );
