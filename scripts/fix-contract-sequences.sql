-- Unwedges loan origination. Run against the LIVE `loanapp` database.
--   ssh loanvps 'mysql -t loanapp' < scripts/fix-contract-sequences.sql
--
-- Backup first (already taken 2026-08-24 13:27 as
-- /root/db-backups/contractseq-fix-20260824-132732.sql.gz):
--   mysqldump --single-transaction loanapp contract_sequences loans | gzip > backup.sql.gz
--
-- Touches ONLY the contract_sequences counter table. loans is read, never written.
-- No schema change, no app restart, no downtime. Matches the CURRENTLY DEPLOYED
-- (tenant, app_type, prefix) key -- the re-key to (tenant, prefix) ships separately.

START TRANSACTION;

CREATE TEMPORARY TABLE seq_seed AS
SELECT tenant_id, REGEXP_REPLACE(loan_code,'[0-9]+$','') AS prefix,
       MAX(CAST(REGEXP_SUBSTR(loan_code,'[0-9]+$') AS UNSIGNED)) AS max_seq
FROM loans WHERE loan_code REGEXP '^[A-Z][A-Z0-9_-]*[0-9]+$'
GROUP BY 1,2;

CREATE TEMPORARY TABLE seq_rows AS
SELECT DISTINCT tenant_id, app_type, REGEXP_REPLACE(loan_code,'[0-9]+$','') AS prefix
FROM loans WHERE loan_code REGEXP '^[A-Z][A-Z0-9_-]*[0-9]+$';

-- Move existing counters up to the tenant-wide high-water mark. Seeding with the
-- tenant-wide max (not the per-module one) means no module can collide with
-- another even before the re-key lands. GREATEST so a counter already ahead of
-- the data is never walked backwards.
UPDATE contract_sequences cs
JOIN seq_seed s ON s.tenant_id = cs.tenant_id AND s.prefix = cs.prefix
SET cs.current_value = GREATEST(cs.current_value, s.max_seq), cs.updated_at = NOW(3);

-- Create the counters that were never created at all.
INSERT INTO contract_sequences (id, tenant_id, app_type, prefix, current_value, created_at, updated_at)
SELECT LOWER(REPLACE(UUID(),'-','')), r.tenant_id, r.app_type, r.prefix, s.max_seq, NOW(3), NOW(3)
FROM seq_rows r
JOIN seq_seed s ON s.tenant_id = r.tenant_id AND s.prefix = r.prefix
LEFT JOIN contract_sequences cs
  ON cs.tenant_id = r.tenant_id AND cs.app_type = r.app_type AND cs.prefix = r.prefix
WHERE cs.id IS NULL;

COMMIT;

SELECT '=== counters after (expect DL=14, WL=13 for cmq7z5lua...) ===' AS ``;
SELECT tenant_id, app_type, prefix, current_value FROM contract_sequences ORDER BY tenant_id, prefix;
