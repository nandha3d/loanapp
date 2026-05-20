CREATE INDEX `customers_tenantId_appType_status_idx` ON `customers`(`tenant_id`, `app_type`, `status`);
CREATE INDEX `loans_tenantId_appType_status_idx` ON `loans`(`tenant_id`, `app_type`, `status`);
CREATE INDEX `instalments_loanId_dueDate_status_idx` ON `instalments`(`loan_id`, `due_date`, `status`);