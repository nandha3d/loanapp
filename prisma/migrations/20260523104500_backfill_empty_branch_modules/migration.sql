UPDATE `branches` b
JOIN `tenant_subscriptions` ts ON ts.`tenant_id` = b.`tenant_id`
SET b.`enabled_modules` = ts.`enabled_modules`
WHERE b.`enabled_modules` IS NULL
  OR b.`enabled_modules` = ''
  OR JSON_LENGTH(b.`enabled_modules`) = 0;
