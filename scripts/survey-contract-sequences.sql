-- Read-only. Safe to run on prod. Diagnoses the loan_code collision.
-- Usage: mysql -u root -p loantrack < survey-contract-sequences.sql

SELECT '=== 1. counters as they stand ===' AS ``;
SELECT tenant_id, app_type, prefix, current_value FROM contract_sequences
ORDER BY tenant_id, prefix, app_type;

SELECT '=== 2. highest code actually issued ===' AS ``;
SELECT tenant_id,
       REGEXP_REPLACE(loan_code,'[0-9]+$','')                    AS prefix,
       COUNT(*)                                                  AS loans,
       MAX(CAST(REGEXP_SUBSTR(loan_code,'[0-9]+$') AS UNSIGNED)) AS max_seq
FROM loans
WHERE loan_code REGEXP '^[A-Z][A-Z0-9_-]*[0-9]+$'
GROUP BY 1,2 ORDER BY 1,2;

SELECT '=== 3. THE WEDGE: counters behind live data ===' AS ``;
SELECT s.tenant_id, s.prefix, s.max_seq AS loans_reached,
       COALESCE(MAX(cs.current_value),0) AS counter_at,
       s.max_seq - COALESCE(MAX(cs.current_value),0) AS behind_by
FROM (
  SELECT tenant_id,
         REGEXP_REPLACE(loan_code,'[0-9]+$','')                    AS prefix,
         MAX(CAST(REGEXP_SUBSTR(loan_code,'[0-9]+$') AS UNSIGNED)) AS max_seq
  FROM loans WHERE loan_code REGEXP '^[A-Z][A-Z0-9_-]*[0-9]+$'
  GROUP BY 1,2
) s
LEFT JOIN contract_sequences cs
  ON cs.tenant_id = s.tenant_id AND cs.prefix = s.prefix
GROUP BY s.tenant_id, s.prefix, s.max_seq
HAVING behind_by > 0 ORDER BY behind_by DESC;

SELECT '=== 4. codes that will NOT be seeded (hand-entered) ===' AS ``;
SELECT tenant_id, loan_code FROM loans
WHERE loan_code NOT REGEXP '^[A-Z][A-Z0-9_-]*[0-9]+$' LIMIT 20;
