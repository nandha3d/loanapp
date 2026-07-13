-- Chit groups are chitfunds-module entities by definition: the web dashboard
-- pins appType='chitfunds' for every chit view (lib/chits/access.ts), but the
-- mobile API used to stamp whatever app context the phone sent, so groups
-- created from mobile while the client was in another module (e.g.
-- microlending) were filed under that module and became invisible to the web
-- Chit Funds pages. Re-file existing chit data under chitfunds; the mobile
-- routes now pin appType='chitfunds' so this cannot recur.
-- Approved by the user on 2026-07-13 (data repair across all tenants).

UPDATE `chit_groups`
SET `app_type` = 'chitfunds'
WHERE `app_type` <> 'chitfunds';

-- Chit money movements (collections, payouts, penalties …) carry the module
-- tag too — mis-filed rows skewed both modules' books and the chit dashboard.
UPDATE `account_entries`
SET `app_type` = 'chitfunds'
WHERE `reference_type` LIKE 'chit\_%'
  AND `app_type` <> 'chitfunds';
