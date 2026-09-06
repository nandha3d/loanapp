-- Doc 19 (customer payment proof / UTR). New table only — additive, no
-- existing table changes. Shared with doc 23's WhatsApp inbound path via
-- `source`.

CREATE TABLE `chit_payment_intents` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `branch_id` VARCHAR(191) NULL,
  `member_id` VARCHAR(191) NOT NULL,
  `subscription_id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(14, 2) NULL,
  `payment_mode` VARCHAR(191) NOT NULL DEFAULT 'upi',
  `reference_no` VARCHAR(191) NULL,
  `proof_document_id` VARCHAR(191) NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT 'portal',
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `reviewed_by_id` VARCHAR(191) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `rejection_reason` TEXT NULL,
  `receipt_no` VARCHAR(191) NULL,
  `wa_message_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `chit_payment_intents_tenant_id_branch_id_status_idx`(`tenant_id`, `branch_id`, `status`),
  INDEX `chit_payment_intents_member_id_idx`(`member_id`),
  INDEX `chit_payment_intents_subscription_id_idx`(`subscription_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
