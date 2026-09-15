-- Backfill a human-readable slug/code for chit groups created before the
-- group_code column existed, so their URLs are no longer a raw internal id.
-- Sequence is per-tenant, ordered by creation date, matching the same
-- generateCode('CF', count+1, 5) scheme used for newly created groups.
UPDATE chit_groups g
JOIN (
  SELECT id, CONCAT('CF', LPAD(ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at), 5, '0')) AS code
  FROM chit_groups
) ranked ON ranked.id = g.id
SET g.group_code = ranked.code
WHERE g.group_code IS NULL;
