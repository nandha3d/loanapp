-- Rebrand: default tenant display name LoanTrack -> ZoloFund.
-- Only changes the column DEFAULT for newly created tenants; existing rows keep
-- whatever name they were given.
ALTER TABLE `tenants` ALTER COLUMN `name` SET DEFAULT 'ZoloFund';
