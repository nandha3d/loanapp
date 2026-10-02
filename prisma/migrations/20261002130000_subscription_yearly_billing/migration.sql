-- AlterTable
ALTER TABLE `subscription_plan_catalogs` ADD COLUMN `yearly_price` INTEGER NULL,
    ADD COLUMN `razorpay_yearly_plan_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tenant_subscriptions` ADD COLUMN `billing_cycle` VARCHAR(191) NOT NULL DEFAULT 'monthly';
