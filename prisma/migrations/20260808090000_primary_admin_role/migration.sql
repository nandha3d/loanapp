-- Primary Admin: an admin who manages the other admins in their tenant.
-- Modelled as a flag on the existing `admin` role so that every role guard
-- already written against 'admin' keeps applying unchanged.
ALTER TABLE `users` ADD COLUMN `is_primary_admin` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `users_tenant_id_is_primary_admin_idx` ON `users`(`tenant_id`, `is_primary_admin`);
