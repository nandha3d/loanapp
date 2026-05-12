/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;


--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_settings` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `key` varchar(191) NOT NULL,
  `value` text NOT NULL,
  `group` varchar(191) NOT NULL DEFAULT 'general',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_settings_tenant_id_key_key` (`tenant_id`,`key`),
  CONSTRAINT `app_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES
('cmp1cxg3e000cm5ls3cyx173d','cmp1cxexi0000m5lsfbfigi9x','app_name','LoanTrack','branding','2026-05-11 15:29:10.586','2026-05-11 15:29:10.586'),
('cmp1cxg3i000em5ls4nym1m0t','cmp1cxexi0000m5lsfbfigi9x','app_tagline','Micro-Lending Management System','branding','2026-05-11 15:29:10.590','2026-05-11 15:29:10.590'),
('cmp1cxg3l000gm5lsjdr3tr7c','cmp1cxexi0000m5lsfbfigi9x','logo_url','/assets/logo.svg','branding','2026-05-11 15:29:10.593','2026-05-11 15:29:10.593'),
('cmp1cxg3q000im5lsw3dt3lvr','cmp1cxexi0000m5lsfbfigi9x','primary_color','#F5A623','branding','2026-05-11 15:29:10.598','2026-05-11 15:29:10.598'),
('cmp1cxg3t000km5lsk339z6tk','cmp1cxexi0000m5lsfbfigi9x','primary_dark','#E8930C','branding','2026-05-11 15:29:10.601','2026-05-11 15:29:10.601'),
('cmp1cxg3x000mm5lsqxb9wwh6','cmp1cxexi0000m5lsfbfigi9x','timezone','Asia/Kolkata','system','2026-05-11 15:29:10.605','2026-05-11 15:29:10.605'),
('cmp1cxg3z000om5lsn7l06h3c','cmp1cxexi0000m5lsfbfigi9x','currency','INR','system','2026-05-11 15:29:10.607','2026-05-11 15:29:10.607'),
('cmp1cxg43000qm5lsble1q2ij','cmp1cxexi0000m5lsfbfigi9x','currency_symbol','Ôé╣','system','2026-05-11 15:29:10.611','2026-05-11 15:29:10.611'),
('cmp1cxg45000sm5lsbnszbfsc','cmp1cxexi0000m5lsfbfigi9x','date_format','dd MMM yyyy','system','2026-05-11 15:29:10.614','2026-05-11 15:29:10.614'),
('cmp1cxg4a000um5lsckb428w8','cmp1cxexi0000m5lsfbfigi9x','midnight_cutoff','true','system','2026-05-11 15:29:10.618','2026-05-11 15:29:10.618'),
('cmp1cxg4d000wm5lsdc2v73oh','cmp1cxexi0000m5lsfbfigi9x','allow_weekend_collection','false','system','2026-05-11 15:29:10.621','2026-05-11 15:29:10.621'),
('cmp1cxg4f000ym5lshluri1c1','cmp1cxexi0000m5lsfbfigi9x','default_penalty_per_day','50','penalty','2026-05-11 15:29:10.624','2026-05-11 15:29:10.624'),
('cmp1cxg4h0010m5ls6u4gmdy0','cmp1cxexi0000m5lsfbfigi9x','penalty_grace_period','0','penalty','2026-05-11 15:29:10.626','2026-05-11 15:29:10.626'),
('cmp1cxg4k0012m5lsnh55ewl0','cmp1cxexi0000m5lsfbfigi9x','penalty_max_cap','0','penalty','2026-05-11 15:29:10.628','2026-05-11 15:29:10.628'),
('cmp1cxg4m0014m5ls24zxqxwk','cmp1cxexi0000m5lsfbfigi9x','customer_code_prefix','CUS','general','2026-05-11 15:29:10.631','2026-05-11 15:29:10.631'),
('cmp1cxg4p0016m5lsyr2s79li','cmp1cxexi0000m5lsfbfigi9x','loan_code_prefix','LN','general','2026-05-11 15:29:10.633','2026-05-11 15:29:10.633'),
('cmp1cxg4s0018m5lsxie36sqm','cmp1cxexi0000m5lsfbfigi9x','customer_code_counter','0','general','2026-05-11 15:29:10.636','2026-05-11 15:29:10.636'),
('cmp1cxg4v001am5lsz5lghd6o','cmp1cxexi0000m5lsfbfigi9x','loan_code_counter','0','general','2026-05-11 15:29:10.638','2026-05-11 15:29:10.638');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `approval_requests`
--

DROP TABLE IF EXISTS `approval_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `approval_requests` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `app_type` varchar(191) NOT NULL,
  `request_type` varchar(191) NOT NULL,
  `entity_type` varchar(191) NOT NULL,
  `entity_id` varchar(191) NOT NULL,
  `requested_by_id` varchar(191) NOT NULL,
  `requested_changes` text NOT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `reviewed_by_id` varchar(191) DEFAULT NULL,
  `reviewed_at` datetime(3) DEFAULT NULL,
  `review_notes` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `approval_requests_requested_by_id_fkey` (`requested_by_id`),
  KEY `approval_requests_reviewed_by_id_fkey` (`reviewed_by_id`),
  CONSTRAINT `approval_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `approval_requests_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `approval_requests`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `approval_requests` WRITE;
/*!40000 ALTER TABLE `approval_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `approval_requests` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `user_id` varchar(191) DEFAULT NULL,
  `action` varchar(191) NOT NULL,
  `entity_type` varchar(191) NOT NULL,
  `entity_id` varchar(191) DEFAULT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `ip_address` varchar(191) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_tenant_id_entity_type_idx` (`tenant_id`,`entity_type`),
  KEY `audit_logs_created_at_idx` (`created_at`),
  KEY `audit_logs_user_id_fkey` (`user_id`),
  CONSTRAINT `audit_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES
('cmp1dnil30001zkznb4hpiu5e','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-11 15:49:26.869'),
('cmp1dopdk0003zkznopttnogb','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-11 15:50:22.329'),
('cmp1dxlst0005zkznc9fgt7ck','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-11 15:57:17.597'),
('cmp1e3jid0007zkzn1gcanznn','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-11 16:01:54.562'),
('cmp1e3vkk0009zkznlovo8wvu','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-11 16:02:10.196'),
('cmp297h1j00018jmgvkqwll2k','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-12 06:32:46.085'),
('cmp298pi600038jmgbtpmey6r','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-12 06:33:43.710'),
('cmp29979g00058jmg9nd5argh','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-12 06:34:06.724'),
('cmp29jrqf0001yfs6n1x6pjjj','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-12 06:42:19.816'),
('cmp29l2ya0003yfs662pbk7lw','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-12 06:43:21.010'),
('cmp29ncum0005yfs64cclaq9e','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-12 06:45:07.151'),
('cmp29tfps0007yfs6hnsy2kj3','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-12 06:49:50.800'),
('cmp2ap6lw0009yfs62wx6t3un','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-12 07:14:31.988'),
('cmp2aq8hc000byfs6cdygvym8','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfck0006m5lsp6xj0azh','login','user','cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,NULL,NULL,'2026-05-12 07:15:21.073'),
('cmp2b3w9i000dyfs6q9udenx7','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-12 07:25:58.422'),
('cmp2ba2e3000fyfs6eeh17umk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-12 07:30:46.299');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `branches`
--

DROP TABLE IF EXISTS `branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `branches` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `code` varchar(191) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branches_tenant_id_code_key` (`tenant_id`,`code`),
  CONSTRAINT `branches_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `branches` WRITE;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES
('cmp1cxext0002m5ls50zh8t71','cmp1cxexi0000m5lsfbfigi9x','Head Office','HQ','Main Branch',NULL,'active','2026-05-11 15:29:09.090','2026-05-11 15:29:09.090');
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `chit_auctions`
--

DROP TABLE IF EXISTS `chit_auctions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `chit_auctions` (
  `id` varchar(191) NOT NULL,
  `chit_group_id` varchar(191) NOT NULL,
  `period_number` int(11) NOT NULL,
  `auction_date` date NOT NULL,
  `winner_member_id` varchar(191) DEFAULT NULL,
  `prize_amount` decimal(14,2) DEFAULT NULL,
  `bid_discount` decimal(14,2) DEFAULT NULL,
  `commission` decimal(14,2) DEFAULT NULL,
  `dividend` decimal(14,2) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `chit_auctions_chit_group_id_period_number_key` (`chit_group_id`,`period_number`),
  KEY `chit_auctions_winner_member_id_fkey` (`winner_member_id`),
  CONSTRAINT `chit_auctions_chit_group_id_fkey` FOREIGN KEY (`chit_group_id`) REFERENCES `chit_groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chit_auctions_winner_member_id_fkey` FOREIGN KEY (`winner_member_id`) REFERENCES `chit_members` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chit_auctions`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `chit_auctions` WRITE;
/*!40000 ALTER TABLE `chit_auctions` DISABLE KEYS */;
/*!40000 ALTER TABLE `chit_auctions` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `chit_groups`
--

DROP TABLE IF EXISTS `chit_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `chit_groups` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) DEFAULT NULL,
  `app_type` varchar(191) NOT NULL DEFAULT 'chitfunds',
  `name` varchar(191) NOT NULL,
  `chit_value` decimal(14,2) NOT NULL,
  `monthly_contrib` decimal(14,2) NOT NULL,
  `total_members` int(11) NOT NULL,
  `duration_months` int(11) NOT NULL,
  `commission_pct` decimal(5,2) NOT NULL DEFAULT 5.00,
  `start_date` date NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `chit_groups_tenant_id_app_type_status_idx` (`tenant_id`,`app_type`,`status`),
  KEY `chit_groups_branch_id_fkey` (`branch_id`),
  CONSTRAINT `chit_groups_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chit_groups_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chit_groups`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `chit_groups` WRITE;
/*!40000 ALTER TABLE `chit_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `chit_groups` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `chit_members`
--

DROP TABLE IF EXISTS `chit_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `chit_members` (
  `id` varchar(191) NOT NULL,
  `chit_group_id` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `member_number` int(11) NOT NULL,
  `has_won` tinyint(1) NOT NULL DEFAULT 0,
  `won_at` datetime(3) DEFAULT NULL,
  `joined_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `chit_members_chit_group_id_customer_id_key` (`chit_group_id`,`customer_id`),
  UNIQUE KEY `chit_members_chit_group_id_member_number_key` (`chit_group_id`,`member_number`),
  KEY `chit_members_customer_id_fkey` (`customer_id`),
  CONSTRAINT `chit_members_chit_group_id_fkey` FOREIGN KEY (`chit_group_id`) REFERENCES `chit_groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chit_members_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chit_members`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `chit_members` WRITE;
/*!40000 ALTER TABLE `chit_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `chit_members` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `chit_subscriptions`
--

DROP TABLE IF EXISTS `chit_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `chit_subscriptions` (
  `id` varchar(191) NOT NULL,
  `member_id` varchar(191) NOT NULL,
  `period_number` int(11) NOT NULL,
  `due_date` date NOT NULL,
  `due_amount` decimal(14,2) NOT NULL,
  `paid_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` varchar(191) NOT NULL DEFAULT 'upcoming',
  `paid_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `chit_subscriptions_member_id_period_number_idx` (`member_id`,`period_number`),
  CONSTRAINT `chit_subscriptions_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `chit_members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chit_subscriptions`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `chit_subscriptions` WRITE;
/*!40000 ALTER TABLE `chit_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `chit_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `collection_entries`
--

DROP TABLE IF EXISTS `collection_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `collection_entries` (
  `id` varchar(191) NOT NULL,
  `collection_id` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `loan_id` varchar(191) NOT NULL,
  `due_amount` decimal(12,2) NOT NULL,
  `received_amount` decimal(12,2) NOT NULL,
  `payment_mode` varchar(191) NOT NULL DEFAULT 'cash',
  `remarks` text DEFAULT NULL,
  `agent_id` varchar(191) NOT NULL,
  `submitted_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `is_locked` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `collection_entries_collection_id_fkey` (`collection_id`),
  KEY `collection_entries_agent_id_fkey` (`agent_id`),
  KEY `collection_entries_customer_id_fkey` (`customer_id`),
  KEY `collection_entries_loan_id_fkey` (`loan_id`),
  CONSTRAINT `collection_entries_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `collection_entries_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `daily_collections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `collection_entries_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `collection_entries_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collection_entries`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `collection_entries` WRITE;
/*!40000 ALTER TABLE `collection_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `collection_entries` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) DEFAULT NULL,
  `customer_code` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `address` text DEFAULT NULL,
  `aadhar_number` varchar(191) DEFAULT NULL,
  `route_id` varchar(191) DEFAULT NULL,
  `agent_id` varchar(191) DEFAULT NULL,
  `kycStatus` varchar(191) NOT NULL DEFAULT 'pending',
  `profile_photo` varchar(191) DEFAULT NULL,
  `user_id` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `app_type` varchar(191) NOT NULL DEFAULT 'microlending',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_tenant_id_customer_code_key` (`tenant_id`,`customer_code`),
  UNIQUE KEY `customers_user_id_key` (`user_id`),
  KEY `customers_branch_id_fkey` (`branch_id`),
  KEY `customers_route_id_fkey` (`route_id`),
  KEY `customers_agent_id_fkey` (`agent_id`),
  CONSTRAINT `customers_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `customers_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `customers_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `customers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `daily_collections`
--

DROP TABLE IF EXISTS `daily_collections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_collections` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) DEFAULT NULL,
  `agent_id` varchar(191) NOT NULL,
  `route_id` varchar(191) DEFAULT NULL,
  `date` date NOT NULL,
  `total_expected` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_collected` decimal(12,2) NOT NULL DEFAULT 0.00,
  `entries_count` int(11) NOT NULL DEFAULT 0,
  `app_type` varchar(191) NOT NULL DEFAULT 'microlending',
  `status` varchar(191) NOT NULL DEFAULT 'open',
  `locked_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `daily_collections_agent_id_date_key` (`agent_id`,`date`),
  KEY `daily_collections_date_idx` (`date`),
  KEY `daily_collections_tenant_id_fkey` (`tenant_id`),
  KEY `daily_collections_branch_id_fkey` (`branch_id`),
  KEY `daily_collections_route_id_fkey` (`route_id`),
  CONSTRAINT `daily_collections_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `daily_collections_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `daily_collections_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `daily_collections_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_collections`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `daily_collections` WRITE;
/*!40000 ALTER TABLE `daily_collections` DISABLE KEYS */;
/*!40000 ALTER TABLE `daily_collections` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `guarantors`
--

DROP TABLE IF EXISTS `guarantors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `guarantors` (
  `id` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `address` text DEFAULT NULL,
  `aadhar_number` varchar(191) DEFAULT NULL,
  `photo` varchar(191) DEFAULT NULL,
  `relation` varchar(191) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `guarantors_customer_id_fkey` (`customer_id`),
  CONSTRAINT `guarantors_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `guarantors`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `guarantors` WRITE;
/*!40000 ALTER TABLE `guarantors` DISABLE KEYS */;
/*!40000 ALTER TABLE `guarantors` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `instalments`
--

DROP TABLE IF EXISTS `instalments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `instalments` (
  `id` varchar(191) NOT NULL,
  `loan_id` varchar(191) NOT NULL,
  `instalment_no` int(11) NOT NULL,
  `due_date` date NOT NULL,
  `due_amount` decimal(12,2) NOT NULL,
  `received_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_mode` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'upcoming',
  `received_at` datetime(3) DEFAULT NULL,
  `agent_id` varchar(191) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `locked_at` datetime(3) DEFAULT NULL,
  `penalty_applied` tinyint(1) NOT NULL DEFAULT 0,
  `collection_entry_id` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `instalments_loan_id_instalment_no_key` (`loan_id`,`instalment_no`),
  UNIQUE KEY `instalments_collection_entry_id_key` (`collection_entry_id`),
  KEY `instalments_due_date_idx` (`due_date`),
  KEY `instalments_status_idx` (`status`),
  CONSTRAINT `instalments_collection_entry_id_fkey` FOREIGN KEY (`collection_entry_id`) REFERENCES `collection_entries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `instalments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instalments`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `instalments` WRITE;
/*!40000 ALTER TABLE `instalments` DISABLE KEYS */;
/*!40000 ALTER TABLE `instalments` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `kyc_documents`
--

DROP TABLE IF EXISTS `kyc_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `kyc_documents` (
  `id` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `doc_type` varchar(191) NOT NULL,
  `file_name` varchar(191) NOT NULL,
  `file_path` varchar(191) NOT NULL,
  `file_size` int(11) DEFAULT NULL,
  `uploaded_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `kyc_documents_customer_id_fkey` (`customer_id`),
  CONSTRAINT `kyc_documents_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kyc_documents`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `kyc_documents` WRITE;
/*!40000 ALTER TABLE `kyc_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `kyc_documents` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `loan_collaterals`
--

DROP TABLE IF EXISTS `loan_collaterals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_collaterals` (
  `id` varchar(191) NOT NULL,
  `loan_id` varchar(191) NOT NULL,
  `doc_type` varchar(191) NOT NULL,
  `file_name` varchar(191) NOT NULL,
  `file_path` varchar(191) NOT NULL,
  `file_size` int(11) DEFAULT NULL,
  `description` varchar(191) DEFAULT NULL,
  `uploaded_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `loan_collaterals_loan_id_fkey` (`loan_id`),
  CONSTRAINT `loan_collaterals_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loan_collaterals`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `loan_collaterals` WRITE;
/*!40000 ALTER TABLE `loan_collaterals` DISABLE KEYS */;
/*!40000 ALTER TABLE `loan_collaterals` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `loan_packages`
--

DROP TABLE IF EXISTS `loan_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_packages` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `principal` decimal(12,2) NOT NULL,
  `deduction` decimal(12,2) NOT NULL,
  `frequency` varchar(191) NOT NULL,
  `tenure` int(11) NOT NULL,
  `per_instalment` decimal(12,2) NOT NULL,
  `penalty_rate` decimal(12,2) NOT NULL,
  `app_type` varchar(191) NOT NULL DEFAULT 'microlending',
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `loan_packages_tenant_id_fkey` (`tenant_id`),
  CONSTRAINT `loan_packages_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loan_packages`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `loan_packages` WRITE;
/*!40000 ALTER TABLE `loan_packages` DISABLE KEYS */;
INSERT INTO `loan_packages` VALUES
('cmp1cxg54001cm5lsqhxg0acm','cmp1cxexi0000m5lsfbfigi9x','Standard 100-Day Daily',30000.00,3000.00,'daily',100,300.00,50.00,'microlending','active','2026-05-11 15:29:10.649','2026-05-11 15:29:10.649'),
('cmp1cxg5c001em5lsjrhrpzve','cmp1cxexi0000m5lsfbfigi9x','Premium 100-Day Daily',50000.00,5000.00,'daily',100,500.00,100.00,'microlending','active','2026-05-11 15:29:10.656','2026-05-11 15:29:10.656'),
('cmp1cxg5g001gm5lsoilkcphb','cmp1cxexi0000m5lsfbfigi9x','Weekly 20-Week',20000.00,2000.00,'weekly',20,1000.00,200.00,'microlending','active','2026-05-11 15:29:10.660','2026-05-11 15:29:10.660'),
('cmp1cxg5j001im5lse51nqww5','cmp1cxexi0000m5lsfbfigi9x','Monthly 10-Month',25000.00,2500.00,'monthly',10,2500.00,500.00,'microlending','active','2026-05-11 15:29:10.664','2026-05-11 15:29:10.664');
/*!40000 ALTER TABLE `loan_packages` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `loans`
--

DROP TABLE IF EXISTS `loans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loans` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) DEFAULT NULL,
  `loan_code` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `package_id` varchar(191) DEFAULT NULL,
  `loan_type` varchar(191) NOT NULL DEFAULT 'cheque',
  `app_type` varchar(191) NOT NULL DEFAULT 'microlending',
  `collateral_details` text DEFAULT NULL,
  `guarantor_id` varchar(191) DEFAULT NULL,
  `principal` decimal(12,2) NOT NULL,
  `deduction` decimal(12,2) NOT NULL,
  `disbursed` decimal(12,2) NOT NULL,
  `frequency` varchar(191) NOT NULL,
  `tenure` int(11) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `per_instalment` decimal(12,2) NOT NULL,
  `penalty_rate` decimal(12,2) NOT NULL,
  `voucher_ref` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `paid_count` int(11) NOT NULL DEFAULT 0,
  `total_instalments` int(11) NOT NULL,
  `total_collected` decimal(12,2) NOT NULL DEFAULT 0.00,
  `closed_at` datetime(3) DEFAULT NULL,
  `created_by_id` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `loans_tenant_id_loan_code_key` (`tenant_id`,`loan_code`),
  KEY `loans_branch_id_fkey` (`branch_id`),
  KEY `loans_customer_id_fkey` (`customer_id`),
  KEY `loans_package_id_fkey` (`package_id`),
  KEY `loans_created_by_id_fkey` (`created_by_id`),
  KEY `loans_guarantor_id_fkey` (`guarantor_id`),
  CONSTRAINT `loans_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `loans_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `loans_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `loans_guarantor_id_fkey` FOREIGN KEY (`guarantor_id`) REFERENCES `guarantors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `loans_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `loan_packages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `loans_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loans`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `loans` WRITE;
/*!40000 ALTER TABLE `loans` DISABLE KEYS */;
/*!40000 ALTER TABLE `loans` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `notification_templates`
--

DROP TABLE IF EXISTS `notification_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_templates` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `channel` varchar(191) NOT NULL,
  `subject` varchar(191) DEFAULT NULL,
  `body` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_templates_tenant_id_name_channel_key` (`tenant_id`,`name`,`channel`),
  CONSTRAINT `notification_templates_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_templates`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `notification_templates` WRITE;
/*!40000 ALTER TABLE `notification_templates` DISABLE KEYS */;
INSERT INTO `notification_templates` VALUES
('cmp1cxg5m001km5lsszzq95ll','cmp1cxexi0000m5lsfbfigi9x','payment_reminder','sms',NULL,'Dear {{customer_name}}, your payment of {{currency_symbol}}{{amount}} for loan {{loan_code}} is due today. Please pay your agent.',1,'2026-05-11 15:29:10.667','2026-05-11 15:29:10.667'),
('cmp1cxg5r001mm5ls6kdhzcdn','cmp1cxexi0000m5lsfbfigi9x','payment_reminder','whatsapp',NULL,'Hi {{customer_name}} ­ƒæï\n\nYour payment of {{currency_symbol}}{{amount}} for loan *{{loan_code}}* is due today.\n\nPlease arrange payment with your field agent.\n\nThank you!',1,'2026-05-11 15:29:10.672','2026-05-11 15:29:10.672'),
('cmp1cxg5u001om5lslgmfs381','cmp1cxexi0000m5lsfbfigi9x','overdue_alert','sms',NULL,'ALERT: Dear {{customer_name}}, your payment for loan {{loan_code}} is overdue by {{days}} days. Penalty of {{currency_symbol}}{{penalty}} has been applied.',1,'2026-05-11 15:29:10.674','2026-05-11 15:29:10.674'),
('cmp1cxg5x001qm5ls4ct8d5t3','cmp1cxexi0000m5lsfbfigi9x','loan_created','sms',NULL,'Dear {{customer_name}}, your loan {{loan_code}} of {{currency_symbol}}{{principal}} has been approved. Collection starts {{start_date}}. Per instalment: {{currency_symbol}}{{per_instalment}}.',1,'2026-05-11 15:29:10.677','2026-05-11 15:29:10.677');
/*!40000 ALTER TABLE `notification_templates` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `penalties`
--

DROP TABLE IF EXISTS `penalties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `penalties` (
  `id` varchar(191) NOT NULL,
  `loan_id` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `missed_days` int(11) NOT NULL DEFAULT 0,
  `gross_penalty` decimal(12,2) NOT NULL DEFAULT 0.00,
  `settled_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `waived_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `settled_by_id` varchar(191) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `penalties_loan_id_fkey` (`loan_id`),
  KEY `penalties_customer_id_fkey` (`customer_id`),
  KEY `penalties_settled_by_id_fkey` (`settled_by_id`),
  CONSTRAINT `penalties_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `penalties_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `penalties_settled_by_id_fkey` FOREIGN KEY (`settled_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `penalties`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `penalties` WRITE;
/*!40000 ALTER TABLE `penalties` DISABLE KEYS */;
/*!40000 ALTER TABLE `penalties` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `route_agents`
--

DROP TABLE IF EXISTS `route_agents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `route_agents` (
  `id` varchar(191) NOT NULL,
  `route_id` varchar(191) NOT NULL,
  `agent_id` varchar(191) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `assigned_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `route_agents_route_id_agent_id_key` (`route_id`,`agent_id`),
  KEY `route_agents_agent_id_fkey` (`agent_id`),
  CONSTRAINT `route_agents_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `route_agents_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `route_agents`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `route_agents` WRITE;
/*!40000 ALTER TABLE `route_agents` DISABLE KEYS */;
/*!40000 ALTER TABLE `route_agents` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `routes`
--

DROP TABLE IF EXISTS `routes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `routes` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) DEFAULT NULL,
  `name` varchar(191) NOT NULL,
  `assigned_agent_id` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `app_type` varchar(191) NOT NULL DEFAULT 'microlending',
  PRIMARY KEY (`id`),
  KEY `routes_tenant_id_fkey` (`tenant_id`),
  KEY `routes_branch_id_fkey` (`branch_id`),
  KEY `routes_assigned_agent_id_fkey` (`assigned_agent_id`),
  CONSTRAINT `routes_assigned_agent_id_fkey` FOREIGN KEY (`assigned_agent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `routes_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `routes_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `routes`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `routes` WRITE;
/*!40000 ALTER TABLE `routes` DISABLE KEYS */;
INSERT INTO `routes` VALUES
('route-bhavani','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Bhavani','cmp1cxfck0006m5lsp6xj0azh','active','2026-05-11 15:29:10.582','2026-05-11 15:29:10.582','microlending'),
('route-chithode','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Chithode','cmp1cxfck0006m5lsp6xj0azh','active','2026-05-11 15:29:10.575','2026-05-11 15:29:10.575','microlending'),
('route-erode','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Erode','cmp1cxfck0006m5lsp6xj0azh','active','2026-05-11 15:29:10.571','2026-05-11 15:29:10.571','microlending'),
('route-gobichettipalayam','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Gobichettipalayam','cmp1cxfck0006m5lsp6xj0azh','active','2026-05-11 15:29:10.578','2026-05-11 15:29:10.578','microlending');
/*!40000 ALTER TABLE `routes` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `security_cheques`
--

DROP TABLE IF EXISTS `security_cheques`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `security_cheques` (
  `id` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `bank_name` varchar(191) NOT NULL,
  `cheque_number` varchar(191) NOT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `image_path` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `notes` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `security_cheques_customer_id_fkey` (`customer_id`),
  CONSTRAINT `security_cheques_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `security_cheques`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `security_cheques` WRITE;
/*!40000 ALTER TABLE `security_cheques` DISABLE KEYS */;
/*!40000 ALTER TABLE `security_cheques` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `system_notifications`
--

DROP TABLE IF EXISTS `system_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_notifications` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `app_type` varchar(191) NOT NULL DEFAULT 'microlending',
  `type` varchar(191) NOT NULL,
  `icon` varchar(191) DEFAULT NULL,
  `title` varchar(191) DEFAULT NULL,
  `message` text NOT NULL,
  `link` varchar(191) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` datetime(3) DEFAULT NULL,
  `expires_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `system_notifications_tenant_id_app_type_is_read_idx` (`tenant_id`,`app_type`,`is_read`),
  KEY `system_notifications_created_at_idx` (`created_at`),
  CONSTRAINT `system_notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_notifications`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `system_notifications` WRITE;
/*!40000 ALTER TABLE `system_notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_notifications` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `tenant_subscriptions`
--

DROP TABLE IF EXISTS `tenant_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_subscriptions` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `plan` varchar(191) NOT NULL DEFAULT 'trial',
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `max_active_loans` int(11) NOT NULL DEFAULT 50,
  `max_agents` int(11) NOT NULL DEFAULT 3,
  `enabled_modules` varchar(191) NOT NULL DEFAULT 'microlending',
  `trial_ends_at` datetime(3) DEFAULT NULL,
  `current_period_end` datetime(3) DEFAULT NULL,
  `razorpay_sub_id` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_subscriptions_tenant_id_key` (`tenant_id`),
  CONSTRAINT `tenant_subscriptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_subscriptions`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `tenant_subscriptions` WRITE;
/*!40000 ALTER TABLE `tenant_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `tenants`
--

DROP TABLE IF EXISTS `tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenants` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL DEFAULT 'LoanTrack',
  `slug` varchar(191) NOT NULL DEFAULT 'default',
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenants_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenants`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `tenants` WRITE;
/*!40000 ALTER TABLE `tenants` DISABLE KEYS */;
INSERT INTO `tenants` VALUES
('cmp1cxexi0000m5lsfbfigi9x','LoanTrack','default','active','2026-05-11 15:29:09.072','2026-05-11 15:29:09.072');
/*!40000 ALTER TABLE `tenants` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) DEFAULT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `username` varchar(191) NOT NULL,
  `password_hash` varchar(191) NOT NULL,
  `role` varchar(191) NOT NULL DEFAULT 'agent',
  `app_type` varchar(191) NOT NULL DEFAULT 'microlending',
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `avatar` varchar(191) DEFAULT NULL,
  `last_login_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_tenant_id_username_key` (`tenant_id`,`username`),
  UNIQUE KEY `users_tenant_id_phone_key` (`tenant_id`,`phone`),
  KEY `users_branch_id_fkey` (`branch_id`),
  CONSTRAINT `users_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `users_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
('cmp1cxf590004m5lsp05yll1b','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Admin User','9800000000',NULL,'admin','$2b$12$c87gi9TpG8StkBwcYOLE.e0WEruINYESasJ1hx.3J7xaeRdXwTiEW','admin','microlending','active',NULL,'2026-05-12 07:14:31.980','2026-05-11 15:29:09.357','2026-05-12 07:14:31.982'),
('cmp1cxfck0006m5lsp6xj0azh','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Karthik Rajan','9876543210',NULL,'karthik','$2b$12$QNwe.NW.Nrb8N6eKfB/suO6AthHMV46tmtxMvRJfjXcGuaitnswMi','agent','microlending','active',NULL,'2026-05-12 07:15:21.062','2026-05-11 15:29:09.620','2026-05-12 07:15:21.065'),
('cmp1cxfp20008m5lsqle1q8u1','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Developer','9000000001',NULL,'developer','$2b$12$jknTMb9UwmKO5Si0Rgqtg.JmARmKdeAka3F10ACeHu7w7JtiH7LPa','developer','microlending','active',NULL,'2026-05-12 07:25:58.412','2026-05-11 15:29:10.070','2026-05-12 07:25:58.415'),
('cmp1cxg2t000am5lsjru6vfbe','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Super Admin','9000000002',NULL,'superadmin','$2b$12$ima7OHUDrKnUsnk3Biuo/uqVVa6172yTScs5TnooVvrvp.ECbzy8m','superadmin','microlending','active',NULL,'2026-05-12 07:30:46.292','2026-05-11 15:29:10.565','2026-05-12 07:30:46.293');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `app_type` varchar(191) NOT NULL DEFAULT 'autofinance',
  `customer_id` varchar(191) NOT NULL,
  `registration_no` varchar(191) NOT NULL,
  `make` varchar(191) NOT NULL,
  `model` varchar(191) NOT NULL,
  `year` int(11) DEFAULT NULL,
  `color` varchar(191) DEFAULT NULL,
  `engine_no` varchar(191) DEFAULT NULL,
  `chassis_no` varchar(191) DEFAULT NULL,
  `insurance_expiry` date DEFAULT NULL,
  `rc_doc_path` varchar(191) DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'active',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `insurance_path` varchar(191) DEFAULT NULL,
  `loan_id` varchar(191) DEFAULT NULL,
  `repo_flag` tinyint(1) NOT NULL DEFAULT 0,
  `repo_flagged_at` datetime(3) DEFAULT NULL,
  `repo_flagged_by_id` varchar(191) DEFAULT NULL,
  `vehicle_type` varchar(191) NOT NULL DEFAULT 'two_wheeler',
  PRIMARY KEY (`id`),
  UNIQUE KEY `vehicles_tenant_id_app_type_registration_no_key` (`tenant_id`,`app_type`,`registration_no`),
  UNIQUE KEY `vehicles_loan_id_key` (`loan_id`),
  KEY `vehicles_customer_id_idx` (`customer_id`),
  KEY `vehicles_repo_flag_idx` (`repo_flag`),
  KEY `vehicles_repo_flagged_by_id_fkey` (`repo_flagged_by_id`),
  CONSTRAINT `vehicles_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `vehicles_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `vehicles_repo_flagged_by_id_fkey` FOREIGN KEY (`repo_flagged_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `vehicles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;


-- Dump completed on 2026-05-12 13:05:20
