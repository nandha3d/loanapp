-- AlterTable
ALTER TABLE `subscription_plan_catalogs` ADD COLUMN `included_features` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `tenant_subscriptions` ADD COLUMN `nach_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `grandfathered_features` LONGTEXT NULL;

-- Seed the per-plan feature checklists (cumulative). Editable afterwards in
-- Developer > Billing > Pricing; only rows that exist are touched.
UPDATE `subscription_plan_catalogs` SET `included_features` = '[]' WHERE `plan` = 'free';
UPDATE `subscription_plan_catalogs` SET `included_features` = '["kyc","foreclosure","receipt_pdf"]' WHERE `plan` = 'basic';
UPDATE `subscription_plan_catalogs` SET `included_features` = '["kyc","foreclosure","receipt_pdf","whatsapp_sms","gps_tracking"]' WHERE `plan` = 'business';
UPDATE `subscription_plan_catalogs` SET `included_features` = '["kyc","foreclosure","receipt_pdf","whatsapp_sms","gps_tracking","bureau","nach","premium_accounting","npa"]' WHERE `plan` = 'enterprise';

-- Grandfather: record the features a live tenant has switched on that its plan
-- does NOT include, BEFORE the flags below are touched. Kept until the tenant
-- next changes plan.
UPDATE `tenant_subscriptions` ts
JOIN `subscription_plan_catalogs` c ON c.`plan` = ts.`plan`
SET ts.`grandfathered_features` = CONCAT('[', TRIM(BOTH ',' FROM CONCAT(
    IF(ts.`kyc_enabled` = 1 AND LOCATE('"kyc"', c.`included_features`) = 0, '"kyc",', ''),
    IF(ts.`foreclosure_enabled` = 1 AND LOCATE('"foreclosure"', c.`included_features`) = 0, '"foreclosure",', ''),
    IF(ts.`receipt_pdf_allowed` = 1 AND LOCATE('"receipt_pdf"', c.`included_features`) = 0, '"receipt_pdf",', ''),
    IF(ts.`whatsapp_sms_enabled` = 1 AND LOCATE('"whatsapp_sms"', c.`included_features`) = 0, '"whatsapp_sms",', ''),
    IF(ts.`gps_tracking_enabled` = 1 AND LOCATE('"gps_tracking"', c.`included_features`) = 0, '"gps_tracking",', ''),
    IF(ts.`bureau_enabled` = 1 AND LOCATE('"bureau"', c.`included_features`) = 0, '"bureau",', ''),
    IF(ts.`premium_accounting_enabled` = 1 AND LOCATE('"premium_accounting"', c.`included_features`) = 0, '"premium_accounting",', ''),
    IF(ts.`npa_enabled` = 1 AND LOCATE('"npa"', c.`included_features`) = 0, '"npa",', '')
  )), ']')
WHERE ts.`plan` IN ('basic', 'business', 'enterprise') AND c.`included_features` IS NOT NULL;

-- Give existing paid tenants everything their plan includes now (never removes a flag).
UPDATE `tenant_subscriptions` ts
JOIN `subscription_plan_catalogs` c ON c.`plan` = ts.`plan`
SET ts.`kyc_enabled` = ts.`kyc_enabled` OR LOCATE('"kyc"', c.`included_features`) > 0,
    ts.`foreclosure_enabled` = ts.`foreclosure_enabled` OR LOCATE('"foreclosure"', c.`included_features`) > 0,
    ts.`receipt_pdf_allowed` = ts.`receipt_pdf_allowed` OR LOCATE('"receipt_pdf"', c.`included_features`) > 0,
    ts.`whatsapp_sms_enabled` = ts.`whatsapp_sms_enabled` OR LOCATE('"whatsapp_sms"', c.`included_features`) > 0,
    ts.`gps_tracking_enabled` = ts.`gps_tracking_enabled` OR LOCATE('"gps_tracking"', c.`included_features`) > 0,
    ts.`bureau_enabled` = ts.`bureau_enabled` OR LOCATE('"bureau"', c.`included_features`) > 0,
    ts.`premium_accounting_enabled` = ts.`premium_accounting_enabled` OR LOCATE('"premium_accounting"', c.`included_features`) > 0,
    ts.`npa_enabled` = ts.`npa_enabled` OR LOCATE('"npa"', c.`included_features`) > 0,
    ts.`nach_enabled` = LOCATE('"nach"', c.`included_features`) > 0
WHERE ts.`plan` IN ('basic', 'business', 'enterprise') AND c.`included_features` IS NOT NULL;
