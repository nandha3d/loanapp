-- Interest-Only (Check/Gold Base) repayment model.
--
-- `interest_rate` holds the MONTHLY rate for deduction_type = 'interest_only'. Every
-- other model discards the rate at origination and keeps only its result, so this is
-- nullable and left NULL for existing rows.
--
-- `outstanding_principal` tracks principal still owed after part-payments, mirroring
-- gold_loan_collaterals.outstanding_principal. NULL means "never serviced" and callers
-- fall back to loans.principal, so existing rows need no backfill.
ALTER TABLE `loans`
  ADD COLUMN `interest_rate` DECIMAL(6, 3) NULL,
  ADD COLUMN `outstanding_principal` DECIMAL(12, 2) NULL;
