-- Manual rollback. Review with operations before use; Prisma does not execute this file.
-- Dropping these columns turns every bullet loan into a one-instalment loan whose
-- maturity is no longer recorded anywhere. Export both columns first, and only
-- roll back if no loan carries term_type = 'bullet':
--   SELECT COUNT(*) FROM loans WHERE term_type = 'bullet';

ALTER TABLE `loans` DROP COLUMN `term_days`;
ALTER TABLE `loans` DROP COLUMN `term_type`;
