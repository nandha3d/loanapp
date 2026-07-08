-- ============================================================================
-- PROPOSED MIGRATION — NOT APPLIED. Review + sign-off required (Rule 2).
-- ============================================================================
-- Additive columns for gold pledge servicing (pay-interest / part-payment /
-- redemption). All defaulted/nullable — existing rows + flows unaffected.
-- Models already updated in prisma/schema.prisma.
-- ----------------------------------------------------------------------------

-- Reuse the generic payments table for pledge servicing; tag the kind.
ALTER TABLE `payments`
  ADD COLUMN `payment_type` VARCHAR(191) NOT NULL DEFAULT 'general';

-- Pledge servicing state on the collateral header.
ALTER TABLE `gold_loan_collaterals`
  ADD COLUMN `outstanding_principal` DECIMAL(12, 2) NULL,
  ADD COLUMN `interest_paid_upto` DATETIME(3) NULL;

-- Backfill: outstanding = original principal, interest cleared to loan start.
UPDATE `gold_loan_collaterals` glc
  JOIN `loans` l ON l.`id` = glc.`loan_id`
  SET glc.`outstanding_principal` = l.`principal`,
      glc.`interest_paid_upto` = l.`start_date`
  WHERE glc.`outstanding_principal` IS NULL;
