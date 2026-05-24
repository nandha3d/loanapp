/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.8.6-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: loantrack
-- ------------------------------------------------------
-- Server version	11.8.6-MariaDB-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES
('02f94b91-56ba-43b8-817e-af5c8a3199fc','599ea09d0253e8ebbbef89910a82fa1e150bcf120859b815f93a5214f7e262ba','2026-05-19 15:14:16.680','20260519150000_collection_entry_idempotency',NULL,NULL,'2026-05-19 15:14:16.659',1),
('40971ced-40a9-4d07-9ddd-38e1c564fe8c','8f4ecb422eb5b04dc76459d7668f31bcabcb2a2b5c8ed5db574b9fa2df79a362','2026-05-21 07:49:31.987','20260521131000_add_notification_target_user',NULL,NULL,'2026-05-21 07:49:31.965',1),
('b16f5dd0-cb68-4668-9905-bf6fa97d1c88','ae48648851c1a750eb63db16c68112685e668f74dceb21af2ab44c942a1d1e00','2026-05-21 05:53:36.401','20260520120000_add_customer_loan_instalment_indexes',NULL,NULL,'2026-05-21 05:53:36.359',1),
('dee3dde2-2fe0-4403-b774-c59cb1634eff','763b815b295d719399ae51845e50a916e40574e579ea1cee21b84ed14f2a9d06','2026-05-16 14:15:29.800','20260516190000_user_management_realignment','',NULL,'2026-05-16 14:15:29.800',0);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `account_entries`
--

DROP TABLE IF EXISTS `account_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_entries` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) DEFAULT NULL,
  `entry_date` date NOT NULL,
  `type` varchar(191) NOT NULL,
  `category` varchar(191) NOT NULL DEFAULT 'general',
  `amount` decimal(12,2) NOT NULL,
  `description` text DEFAULT NULL,
  `reference_id` varchar(191) DEFAULT NULL,
  `reference_type` varchar(191) DEFAULT NULL,
  `created_by` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `account_entries_tenant_id_entry_date_idx` (`tenant_id`,`entry_date`),
  KEY `account_entries_tenant_id_type_idx` (`tenant_id`,`type`),
  KEY `account_entries_branch_id_fkey` (`branch_id`),
  KEY `account_entries_created_by_fkey` (`created_by`),
  CONSTRAINT `account_entries_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `account_entries_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `account_entries_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account_entries`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `account_entries` DISABLE KEYS */;
INSERT INTO `account_entries` VALUES
('cmpie73cs003y6p6852e7ltyg','cmpidzhq500026p68kx42vzr4','cmpie0at6000a6p68mp3bjfla','2026-05-23','loan_disburse','cash',10000.00,'Loan DL0001 disbursed to customer','cmpie73c500126p68i6k90d5w','loan','cmpidzhuy00046p68w5hl1pe0','2026-05-23 13:36:45.244');
/*!40000 ALTER TABLE `account_entries` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

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
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES
('cmp1cxg3e000cm5ls3cyx173d','cmp1cxexi0000m5lsfbfigi9x','app_name','LoanTrack','branding','2026-05-11 15:29:10.586','2026-05-11 15:29:10.586'),
('cmp1cxg3i000em5ls4nym1m0t','cmp1cxexi0000m5lsfbfigi9x','app_tagline','Micro-Lending Management System','branding','2026-05-11 15:29:10.590','2026-05-11 15:29:10.590'),
('cmp1cxg3l000gm5lsjdr3tr7c','cmp1cxexi0000m5lsfbfigi9x','logo_url','/assets/logo.svg','branding','2026-05-11 15:29:10.593','2026-05-11 15:29:10.593'),
('cmp1cxg3q000im5lsw3dt3lvr','cmp1cxexi0000m5lsfbfigi9x','primary_color','#F5A623','branding','2026-05-11 15:29:10.598','2026-05-11 15:29:10.598'),
('cmp1cxg3t000km5lsk339z6tk','cmp1cxexi0000m5lsfbfigi9x','primary_dark','#E8930C','branding','2026-05-11 15:29:10.601','2026-05-11 15:29:10.601'),
('cmp1cxg3x000mm5lsqxb9wwh6','cmp1cxexi0000m5lsfbfigi9x','timezone','Asia/Kolkata','system','2026-05-11 15:29:10.605','2026-05-11 15:29:10.605'),
('cmp1cxg3z000om5lsn7l06h3c','cmp1cxexi0000m5lsfbfigi9x','currency','INR','system','2026-05-11 15:29:10.607','2026-05-11 15:29:10.607'),
('cmp1cxg43000qm5lsble1q2ij','cmp1cxexi0000m5lsfbfigi9x','currency_symbol','₹','system','2026-05-11 15:29:10.611','2026-05-12 12:48:46.324'),
('cmp1cxg45000sm5lsbnszbfsc','cmp1cxexi0000m5lsfbfigi9x','date_format','dd MMM yyyy','system','2026-05-11 15:29:10.614','2026-05-11 15:29:10.614'),
('cmp1cxg4a000um5lsckb428w8','cmp1cxexi0000m5lsfbfigi9x','midnight_cutoff','true','system','2026-05-11 15:29:10.618','2026-05-11 15:29:10.618'),
('cmp1cxg4d000wm5lsdc2v73oh','cmp1cxexi0000m5lsfbfigi9x','allow_weekend_collection','false','system','2026-05-11 15:29:10.621','2026-05-11 15:29:10.621'),
('cmp1cxg4f000ym5lshluri1c1','cmp1cxexi0000m5lsfbfigi9x','default_penalty_per_day','50','penalty','2026-05-11 15:29:10.624','2026-05-11 15:29:10.624'),
('cmp1cxg4h0010m5ls6u4gmdy0','cmp1cxexi0000m5lsfbfigi9x','penalty_grace_period','0','penalty','2026-05-11 15:29:10.626','2026-05-11 15:29:10.626'),
('cmp1cxg4k0012m5lsnh55ewl0','cmp1cxexi0000m5lsfbfigi9x','penalty_max_cap','0','penalty','2026-05-11 15:29:10.628','2026-05-11 15:29:10.628'),
('cmp1cxg4m0014m5ls24zxqxwk','cmp1cxexi0000m5lsfbfigi9x','customer_code_prefix','CUS','general','2026-05-11 15:29:10.631','2026-05-11 15:29:10.631'),
('cmp1cxg4p0016m5lsyr2s79li','cmp1cxexi0000m5lsfbfigi9x','loan_code_prefix','LN','general','2026-05-11 15:29:10.633','2026-05-11 15:29:10.633'),
('cmp1cxg4s0018m5lsxie36sqm','cmp1cxexi0000m5lsfbfigi9x','customer_code_counter','1','general','2026-05-11 15:29:10.636','2026-05-12 12:36:09.086'),
('cmp1cxg4v001am5lsz5lghd6o','cmp1cxexi0000m5lsfbfigi9x','loan_code_counter','17','general','2026-05-11 15:29:10.638','2026-05-18 12:26:13.186'),
('cmp2mn0p20001g8w0pvs35tuc','cmp1cxexi0000m5lsfbfigi9x','language','en','system','2026-05-12 12:48:46.407','2026-05-19 15:14:36.486'),
('cmpie6f86000s6p68sxrp876y','cmpidzhq500026p68kx42vzr4','customer_code_counter','1','general','2026-05-23 13:36:13.975','2026-05-23 13:36:13.975'),
('cmpie73bm000y6p68f2uxd698','cmpidzhq500026p68kx42vzr4','loan_counter_daily','1','general','2026-05-23 13:36:45.202','2026-05-23 13:36:45.202');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `approval_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `approval_requests` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES
('cmpfjznuj000y2wv8gvvc9pvy','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','database_wipe','system',NULL,NULL,'{\"wiped\":[\"loans\",\"customers\",\"accounting\",\"agents_routes\",\"approvals\"]}',NULL,NULL,'2026-05-21 13:55:37.723'),
('cmpfkek5k00112wv85gq5r1ar','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-21 14:07:12.776'),
('cmpi0nzmn0001uus4y64wxggu','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-23 07:17:58.942'),
('cmpi0pli50005uus4qel5b7q0','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','create','user','cmpi0plhw0003uus4paki7ap4',NULL,'{\"name\":\"admin3\",\"username\":\"admin3\",\"role\":\"admin\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-23 07:19:13.949'),
('cmpi152v60008uus40v886531','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36','2026-05-23 07:31:16.290'),
('cmpi1ivpi000auus48hgv2k7d','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','update','user','cmpi0plhw0003uus4paki7ap4',NULL,'{\"name\":\"admin3\",\"username\":\"admin3\",\"role\":\"admin\",\"appType\":\"microlending\",\"canCreateLoan\":false,\"status\":\"active\"}',NULL,NULL,'2026-05-23 07:42:00.198'),
('cmpi1j4b5000fuus47bf95n1x','cmp1cxexi0000m5lsfbfigi9x','cmpi0plhw0003uus4paki7ap4','login','auth','cmpi0plhw0003uus4paki7ap4',NULL,'{\"username\":\"admin3\",\"role\":\"admin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-23 07:42:11.345'),
('cmpi1km1s0001t8yx59s6jbqo','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-23 07:43:20.992'),
('cmpi1x5rs0003t8yxlh8qcbc8','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.0.0 Safari/537.36','2026-05-23 07:53:06.424'),
('cmpi6bzps00013i0k2ngcqaso','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-23 09:56:36.874'),
('cmpidvtvq00016p68olpm7gh3','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','auth','cmp1cxfp20008m5lsqle1q8u1',NULL,'{\"username\":\"developer\",\"role\":\"developer\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-23 13:27:59.748'),
('cmpidzhv400066p688539sjyj','cmpidzhq500026p68kx42vzr4','cmp1cxfp20008m5lsqle1q8u1','create','user','cmpidzhuy00046p68w5hl1pe0',NULL,'{\"name\":\"Vignesh \",\"username\":\"Vignesh\",\"role\":\"superadmin\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-23 13:30:50.801'),
('cmpie0hb3000c6p68zfggn60w','cmpidzhq500026p68kx42vzr4','cmpidzhuy00046p68w5hl1pe0','login','auth','cmpidzhuy00046p68w5hl1pe0',NULL,'{\"username\":\"Vignesh\",\"role\":\"superadmin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-23 13:31:36.735'),
('cmpie44xq000k6p68shim9nng','cmpidzhq500026p68kx42vzr4','cmpidzhuy00046p68w5hl1pe0','create','user','cmpie44xk000i6p68f1d20twu',NULL,'{\"name\":\"agent\",\"username\":\"agent1\",\"role\":\"agent\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-23 13:34:27.327'),
('cmpie4da4000n6p68iunzf331','cmpidzhq500026p68kx42vzr4','cmpidzhuy00046p68w5hl1pe0','update','user','cmpie44xk000i6p68f1d20twu',NULL,'{\"name\":\"agent\",\"username\":\"agent1\",\"role\":\"agent\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-23 13:34:38.141'),
('cmpie6f8g000w6p683t6mv6pl','cmpidzhq500026p68kx42vzr4','cmpidzhuy00046p68w5hl1pe0','create','customer','cmpie6f8a000u6p68pbfyie3p',NULL,'{\"customerCode\":\"ER-CUS-0001\",\"name\":\"Vignesh Sinnamaiyappan\",\"status\":\"active\"}',NULL,NULL,'2026-05-23 13:36:13.985'),
('cmpie73cp003w6p685d9hu9rf','cmpidzhq500026p68kx42vzr4','cmpidzhuy00046p68w5hl1pe0','create','loan','cmpie73c500126p68i6k90d5w',NULL,'{\"principal\":10000,\"tenure\":100,\"loanCode\":\"DL0001\"}',NULL,NULL,'2026-05-23 13:36:45.241'),
('cmpie79eu00476p68sfgnf50n','cmpidzhq500026p68kx42vzr4','cmpidzhuy00046p68w5hl1pe0','create','collection','cmpie794h00416p68tbcehxes',NULL,'{\"customer\":\"Vignesh Sinnamaiyappan\",\"loanCode\":\"DL0001\",\"delta\":100,\"totalReceived\":100,\"paymentMode\":\"cash\",\"allocation\":\"Direct payment for instalment #1 (+₹100)\"}',NULL,NULL,'2026-05-23 13:36:53.095'),
('cmpie85ra00496p68b57zu1n1','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-23 13:37:35.015'),
('cmpie8w25004b6p68qfr4giip','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','auth','cmp1cxfp20008m5lsqle1q8u1',NULL,'{\"username\":\"developer\",\"role\":\"developer\"}','0.0.0.0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-23 13:38:09.101'),
('cmpieepjk004d6p68o103cmv8','cmpidzhq500026p68kx42vzr4','cmp1cxfp20008m5lsqle1q8u1','update','user','cmpidzhuy00046p68w5hl1pe0',NULL,'{\"name\":\"Vignesh \",\"username\":\"Vignesh\",\"role\":\"superadmin\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-23 13:42:40.592');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `billing_invoices`
--

DROP TABLE IF EXISTS `billing_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `billing_invoices` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `due_date` datetime(3) NOT NULL,
  `paid_at` datetime(3) DEFAULT NULL,
  `razorpay_id` varchar(191) DEFAULT NULL,
  `invoice_url` varchar(191) DEFAULT NULL,
  `billing_period` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `tax` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `subscription_id` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `billing_invoices_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `billing_invoices_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `billing_invoices`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `billing_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `billing_invoices` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `branch_requests`
--

DROP TABLE IF EXISTS `branch_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `branch_requests` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `requested_by_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) DEFAULT NULL,
  `branch_name` varchar(191) DEFAULT NULL,
  `requested_modules` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`requested_modules`)),
  `reason` text DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `reviewed_by_id` varchar(191) DEFAULT NULL,
  `review_note` text DEFAULT NULL,
  `reviewed_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `branch_requests_tenantId_idx` (`tenant_id`),
  KEY `branch_requests_requestedById_idx` (`requested_by_id`),
  KEY `branch_requests_branchId_idx` (`branch_id`),
  KEY `branch_requests_reviewed_by_id_fkey` (`reviewed_by_id`),
  CONSTRAINT `branch_requests_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `branch_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `branch_requests_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `branch_requests_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branch_requests`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `branch_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `branch_requests` ENABLE KEYS */;
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
  `superadmin_id` varchar(191) DEFAULT NULL,
  `enabled_modules` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT json_array() CHECK (json_valid(`enabled_modules`)),
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branches_tenant_id_code_key` (`tenant_id`,`code`),
  KEY `branches_superadmin_id_fkey` (`superadmin_id`),
  CONSTRAINT `branches_superadmin_id_fkey` FOREIGN KEY (`superadmin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `branches_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `branches`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `branches` DISABLE KEYS */;
INSERT INTO `branches` VALUES
('cmp1cxext0002m5ls50zh8t71','cmp1cxexi0000m5lsfbfigi9x','Erode','HQ','Main Branch','','active','2026-05-11 15:29:09.090','2026-05-19 07:35:04.123','cmp9dwygs00017bb7ekcb8a3i','[\"microlending\",\"autofinance\",\"chitfunds\"]',NULL),
('cmpfiubov0002ag49jkcx4rvd','cmpfiubop0000ag49wddz1ao0','Main Branch',NULL,NULL,NULL,'active','2026-05-21 13:23:29.071','2026-05-21 13:23:29.071',NULL,'[]',NULL),
('cmpfiv43u00029n0mxiai317r','cmpfiv43o00009n0mf3sl2e2t','Main Branch',NULL,NULL,NULL,'active','2026-05-21 13:24:05.898','2026-05-21 13:24:05.898',NULL,'[]',NULL),
('cmpie0at6000a6p68mp3bjfla','cmpidzhq500026p68kx42vzr4','Erode2','ER02',NULL,'','active','2026-05-23 13:31:28.314','2026-05-23 13:42:40.614','cmpidzhuy00046p68w5hl1pe0','[\"microlending\"]',NULL);
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `bureau_credentials`
--

DROP TABLE IF EXISTS `bureau_credentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `bureau_credentials` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `provider` varchar(191) NOT NULL DEFAULT 'CRIF',
  `memberId` text NOT NULL,
  `apiKey` text NOT NULL,
  `apiSecret` text DEFAULT NULL,
  `bureauCert` text DEFAULT NULL,
  `bureauKey` text DEFAULT NULL,
  `environment` varchar(191) NOT NULL DEFAULT 'sandbox',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bureau_credentials_tenant_id_key` (`tenant_id`),
  CONSTRAINT `bureau_credentials_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bureau_credentials`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `bureau_credentials` DISABLE KEYS */;
/*!40000 ALTER TABLE `bureau_credentials` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `bureau_reports`
--

DROP TABLE IF EXISTS `bureau_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `bureau_reports` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `loan_id` varchar(191) DEFAULT NULL,
  `bureau_provider` varchar(191) NOT NULL,
  `pull_type` varchar(191) NOT NULL,
  `request_id` varchar(191) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `credit_score` int(11) DEFAULT NULL,
  `score_model` varchar(191) DEFAULT NULL,
  `total_accounts` int(11) DEFAULT NULL,
  `active_accounts` int(11) DEFAULT NULL,
  `overdue_accounts` int(11) DEFAULT NULL,
  `total_overdue_amt` decimal(12,2) DEFAULT NULL,
  `enquiry_count_90d` int(11) DEFAULT NULL,
  `active_mfi_loans` int(11) DEFAULT NULL,
  `active_mfi_loan_amt` decimal(12,2) DEFAULT NULL,
  `written_off_accounts` int(11) DEFAULT NULL,
  `suit_filed_accounts` int(11) DEFAULT NULL,
  `raw_response` longtext DEFAULT NULL,
  `consent_text` text NOT NULL,
  `consent_obtained` tinyint(1) NOT NULL DEFAULT 0,
  `consent_timestamp` datetime(3) DEFAULT NULL,
  `consent_ip` varchar(191) DEFAULT NULL,
  `consent_method` varchar(191) DEFAULT NULL,
  `valid_until` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bureau_reports_request_id_key` (`request_id`),
  KEY `bureau_reports_customer_id_created_at_idx` (`customer_id`,`created_at`),
  KEY `bureau_reports_tenant_id_created_at_idx` (`tenant_id`,`created_at`),
  CONSTRAINT `bureau_reports_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `bureau_reports_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bureau_reports`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `bureau_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `bureau_reports` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `cash_handovers`
--

DROP TABLE IF EXISTS `cash_handovers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_handovers` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `agent_id` varchar(191) NOT NULL,
  `admin_id` varchar(191) DEFAULT NULL,
  `route_id` varchar(191) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `requested_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `collected_at` datetime(3) DEFAULT NULL,
  `confirmed_at` datetime(3) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cash_handovers_tenant_id_agent_id_status_idx` (`tenant_id`,`agent_id`,`status`),
  KEY `cash_handovers_admin_id_idx` (`admin_id`),
  KEY `cash_handovers_agent_id_fkey` (`agent_id`),
  KEY `cash_handovers_route_id_fkey` (`route_id`),
  CONSTRAINT `cash_handovers_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `cash_handovers_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `cash_handovers_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `cash_handovers_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_handovers`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `cash_handovers` DISABLE KEYS */;
INSERT INTO `cash_handovers` VALUES
('cmpf6b1e3000or6i2i46fpcid','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfck0006m5lsp6xj0azh','cmp1cxf590004m5lsp05yll1b',NULL,300.00,'collected','2026-05-21 07:32:33.867','2026-05-21 07:32:33.864','2026-05-21 07:32:33.864',NULL);
/*!40000 ALTER TABLE `cash_handovers` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `chit_auctions` DISABLE KEYS */;
/*!40000 ALTER TABLE `chit_auctions` ENABLE KEYS */;
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
  `deleted_at` datetime(3) DEFAULT NULL,
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
/*!40000 ALTER TABLE `chit_groups` DISABLE KEYS */;
/*!40000 ALTER TABLE `chit_groups` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `chit_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `chit_members` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `chit_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `chit_subscriptions` ENABLE KEYS */;
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
  `tenant_id` varchar(191) DEFAULT NULL,
  `verification_status` varchar(191) NOT NULL DEFAULT 'pending',
  `idempotency_key` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `collection_entries_idempotency_key_key` (`idempotency_key`),
  KEY `collection_entries_collection_id_fkey` (`collection_id`),
  KEY `collection_entries_agent_id_fkey` (`agent_id`),
  KEY `collection_entries_customer_id_fkey` (`customer_id`),
  KEY `collection_entries_loan_id_fkey` (`loan_id`),
  KEY `collection_entries_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `collection_entries_agent_id_fkey` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `collection_entries_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `daily_collections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `collection_entries_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `collection_entries_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `collection_entries_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collection_entries`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `collection_entries` DISABLE KEYS */;
INSERT INTO `collection_entries` VALUES
('cmpie794h00416p68tbcehxes','d8e255ea-ba60-40ff-ba08-92414f02d075','cmpie6f8a000u6p68pbfyie3p','cmpie73c500126p68i6k90d5w',100.00,100.00,'cash','Direct payment for instalment #1 (+₹100)','cmpidzhuy00046p68w5hl1pe0','2026-05-23 13:36:52.721',1,'cmpidzhq500026p68kx42vzr4','pending','cmpidzhq500026p68kx42vzr4:cmpidzhuy00046p68w5hl1pe0:cmpie73c600136p68nqx42brn:100.00:cash:2026-05-23');
/*!40000 ALTER TABLE `collection_entries` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `cron_locks`
--

DROP TABLE IF EXISTS `cron_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cron_locks` (
  `id` varchar(191) NOT NULL DEFAULT 'penalty_accrual',
  `locked_at` datetime(3) NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cron_locks`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `cron_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cron_locks` ENABLE KEYS */;
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
  `deleted_at` datetime(3) DEFAULT NULL,
  `pan` varchar(191) DEFAULT NULL,
  `password_hash` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_tenant_id_customer_code_key` (`tenant_id`,`customer_code`),
  UNIQUE KEY `customers_user_id_key` (`user_id`),
  KEY `customers_branch_id_fkey` (`branch_id`),
  KEY `customers_route_id_fkey` (`route_id`),
  KEY `customers_agent_id_fkey` (`agent_id`),
  KEY `customers_tenant_id_app_type_status_idx` (`tenant_id`,`app_type`,`status`),
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
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES
('cmpfiuboz0004ag49a4iuhrvb','cmpfiubop0000ag49wddz1ao0','cmpfiubov0002ag49jkcx4rvd','CUST-001','Test Customer','1234567890',NULL,NULL,NULL,NULL,'approved',NULL,NULL,'active',NULL,'microlending','2026-05-21 13:23:29.075','2026-05-21 13:23:29.075',NULL,NULL,NULL),
('cmpfiv43w00049n0meipduf5h','cmpfiv43o00009n0mf3sl2e2t','cmpfiv43u00029n0mxiai317r','CUST-001','Test Customer','1234567890',NULL,NULL,NULL,NULL,'approved',NULL,NULL,'active',NULL,'microlending','2026-05-21 13:24:05.901','2026-05-21 13:24:05.901',NULL,NULL,NULL),
('cmpie6f8a000u6p68pbfyie3p','cmpidzhq500026p68kx42vzr4','cmpie0at6000a6p68mp3bjfla','ER-CUS-0001','Vignesh Sinnamaiyappan','07442941290','James black road, Flat 13, room 3, Manor Park student village,\r\nReception, 1 Alexander Fleming Road',NULL,'cmpie1egq000e6p682f3rlg3v','cmpie44xk000i6p68f1d20twu','pending',NULL,NULL,'active',NULL,'microlending','2026-05-23 13:36:13.978','2026-05-23 13:36:13.978',NULL,NULL,NULL);
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
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
  UNIQUE KEY `daily_collections_tenant_id_app_type_agent_id_date_key` (`tenant_id`,`app_type`,`agent_id`,`date`),
  KEY `daily_collections_date_idx` (`date`),
  KEY `daily_collections_tenant_id_fkey` (`tenant_id`),
  KEY `daily_collections_branch_id_fkey` (`branch_id`),
  KEY `daily_collections_route_id_fkey` (`route_id`),
  KEY `daily_collections_agent_id_idx` (`agent_id`),
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
/*!40000 ALTER TABLE `daily_collections` DISABLE KEYS */;
INSERT INTO `daily_collections` VALUES
('d8e255ea-ba60-40ff-ba08-92414f02d075','cmpidzhq500026p68kx42vzr4','cmpie0at6000a6p68mp3bjfla','cmpidzhuy00046p68w5hl1pe0','cmpie1egq000e6p682f3rlg3v','2026-05-23',100.00,100.00,1,'microlending','open',NULL,'2026-05-23 19:06:52.000','2026-05-23 13:36:53.090');
/*!40000 ALTER TABLE `daily_collections` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `guarantors` DISABLE KEYS */;
/*!40000 ALTER TABLE `guarantors` ENABLE KEYS */;
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
  `bureau_report_id` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `instalments_loan_id_instalment_no_key` (`loan_id`,`instalment_no`),
  UNIQUE KEY `instalments_collection_entry_id_key` (`collection_entry_id`),
  KEY `instalments_due_date_idx` (`due_date`),
  KEY `instalments_status_idx` (`status`),
  KEY `instalments_loan_id_due_date_status_idx` (`loan_id`,`due_date`,`status`),
  KEY `instalments_bureau_report_id_fkey` (`bureau_report_id`),
  CONSTRAINT `instalments_bureau_report_id_fkey` FOREIGN KEY (`bureau_report_id`) REFERENCES `bureau_reports` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `instalments_collection_entry_id_fkey` FOREIGN KEY (`collection_entry_id`) REFERENCES `collection_entries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `instalments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instalments`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `instalments` DISABLE KEYS */;
INSERT INTO `instalments` VALUES
('cmpie73c600136p68nqx42brn','cmpie73c500126p68i6k90d5w',1,'2026-05-23',100.00,100.00,NULL,'paid','2026-05-23 13:36:52.733',NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.748',NULL),
('cmpie73c600146p68435lbx9h','cmpie73c500126p68i6k90d5w',2,'2026-05-24',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.752',NULL),
('cmpie73c600156p68741fequr','cmpie73c500126p68i6k90d5w',3,'2026-05-25',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.755',NULL),
('cmpie73c600166p68hdyq7c8j','cmpie73c500126p68i6k90d5w',4,'2026-05-26',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.759',NULL),
('cmpie73c600176p68fgw4c84u','cmpie73c500126p68i6k90d5w',5,'2026-05-27',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.762',NULL),
('cmpie73c600186p68erkemzhy','cmpie73c500126p68i6k90d5w',6,'2026-05-28',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.767',NULL),
('cmpie73c600196p68pt62j1dj','cmpie73c500126p68i6k90d5w',7,'2026-05-29',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.770',NULL),
('cmpie73c6001a6p683satyfsi','cmpie73c500126p68i6k90d5w',8,'2026-05-30',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.773',NULL),
('cmpie73c6001b6p68yzwigtk9','cmpie73c500126p68i6k90d5w',9,'2026-05-31',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.776',NULL),
('cmpie73c6001c6p68rtecijxj','cmpie73c500126p68i6k90d5w',10,'2026-06-01',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.778',NULL),
('cmpie73c6001d6p68pt9w55ev','cmpie73c500126p68i6k90d5w',11,'2026-06-02',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.781',NULL),
('cmpie73c6001e6p688pzg86z1','cmpie73c500126p68i6k90d5w',12,'2026-06-03',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.784',NULL),
('cmpie73c6001f6p68mzh6gs2w','cmpie73c500126p68i6k90d5w',13,'2026-06-04',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.787',NULL),
('cmpie73c6001g6p6885vxg6dq','cmpie73c500126p68i6k90d5w',14,'2026-06-05',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.790',NULL),
('cmpie73c6001h6p68k5oudfx8','cmpie73c500126p68i6k90d5w',15,'2026-06-06',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.792',NULL),
('cmpie73c6001i6p68vyvdhyof','cmpie73c500126p68i6k90d5w',16,'2026-06-07',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.794',NULL),
('cmpie73c6001j6p68dby4307r','cmpie73c500126p68i6k90d5w',17,'2026-06-08',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.797',NULL),
('cmpie73c6001k6p68kl9bq04q','cmpie73c500126p68i6k90d5w',18,'2026-06-09',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.800',NULL),
('cmpie73c6001l6p68z5585tww','cmpie73c500126p68i6k90d5w',19,'2026-06-10',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.803',NULL),
('cmpie73c6001m6p68uvn8vyrz','cmpie73c500126p68i6k90d5w',20,'2026-06-11',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.806',NULL),
('cmpie73c6001n6p6839gus11l','cmpie73c500126p68i6k90d5w',21,'2026-06-12',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.809',NULL),
('cmpie73c6001o6p68b64mb65w','cmpie73c500126p68i6k90d5w',22,'2026-06-13',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.812',NULL),
('cmpie73c6001p6p68jsccq2ug','cmpie73c500126p68i6k90d5w',23,'2026-06-14',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.815',NULL),
('cmpie73c6001q6p68gqi0ijwq','cmpie73c500126p68i6k90d5w',24,'2026-06-15',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.818',NULL),
('cmpie73c6001r6p68gbl46yur','cmpie73c500126p68i6k90d5w',25,'2026-06-16',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.822',NULL),
('cmpie73c6001s6p68vni7y3ot','cmpie73c500126p68i6k90d5w',26,'2026-06-17',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.825',NULL),
('cmpie73c6001t6p68nmfr4jrt','cmpie73c500126p68i6k90d5w',27,'2026-06-18',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.829',NULL),
('cmpie73c6001u6p6894lrmkpb','cmpie73c500126p68i6k90d5w',28,'2026-06-19',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.832',NULL),
('cmpie73c6001v6p68fcd3ny6o','cmpie73c500126p68i6k90d5w',29,'2026-06-20',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.835',NULL),
('cmpie73c6001w6p687antjg7w','cmpie73c500126p68i6k90d5w',30,'2026-06-21',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.839',NULL),
('cmpie73c6001x6p68ni0nfunj','cmpie73c500126p68i6k90d5w',31,'2026-06-22',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.842',NULL),
('cmpie73c6001y6p68z3fdnhh5','cmpie73c500126p68i6k90d5w',32,'2026-06-23',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.846',NULL),
('cmpie73c6001z6p68jzzn7vr2','cmpie73c500126p68i6k90d5w',33,'2026-06-24',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.849',NULL),
('cmpie73c600206p68x38k53f7','cmpie73c500126p68i6k90d5w',34,'2026-06-25',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.852',NULL),
('cmpie73c600216p68bhq3xmvg','cmpie73c500126p68i6k90d5w',35,'2026-06-26',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.856',NULL),
('cmpie73c600226p689hv2lvb9','cmpie73c500126p68i6k90d5w',36,'2026-06-27',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.859',NULL),
('cmpie73c600236p68i8ewspis','cmpie73c500126p68i6k90d5w',37,'2026-06-28',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.863',NULL),
('cmpie73c700246p68mzo84of5','cmpie73c500126p68i6k90d5w',38,'2026-06-29',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.866',NULL),
('cmpie73c700256p68pmnyyp8g','cmpie73c500126p68i6k90d5w',39,'2026-06-30',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.869',NULL),
('cmpie73c700266p68gez1lz8y','cmpie73c500126p68i6k90d5w',40,'2026-07-01',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.872',NULL),
('cmpie73c700276p6866hm09za','cmpie73c500126p68i6k90d5w',41,'2026-07-02',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.875',NULL),
('cmpie73c700286p68qi1yq0ju','cmpie73c500126p68i6k90d5w',42,'2026-07-03',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.879',NULL),
('cmpie73c700296p68didt5tr9','cmpie73c500126p68i6k90d5w',43,'2026-07-04',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.883',NULL),
('cmpie73c7002a6p68jg3iqtv0','cmpie73c500126p68i6k90d5w',44,'2026-07-05',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.887',NULL),
('cmpie73c7002b6p685quf2kul','cmpie73c500126p68i6k90d5w',45,'2026-07-06',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.890',NULL),
('cmpie73c7002c6p68gjbvo4hy','cmpie73c500126p68i6k90d5w',46,'2026-07-07',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.894',NULL),
('cmpie73c7002d6p68828opp7e','cmpie73c500126p68i6k90d5w',47,'2026-07-08',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.897',NULL),
('cmpie73c7002e6p6850wkwtvp','cmpie73c500126p68i6k90d5w',48,'2026-07-09',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.901',NULL),
('cmpie73c7002f6p68nxnbsjwc','cmpie73c500126p68i6k90d5w',49,'2026-07-10',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.904',NULL),
('cmpie73c7002g6p681w09xiwu','cmpie73c500126p68i6k90d5w',50,'2026-07-11',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.907',NULL),
('cmpie73c7002h6p68ci595ba9','cmpie73c500126p68i6k90d5w',51,'2026-07-12',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.910',NULL),
('cmpie73c7002i6p68l62b0dpt','cmpie73c500126p68i6k90d5w',52,'2026-07-13',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.913',NULL),
('cmpie73c7002j6p680dz6a3n5','cmpie73c500126p68i6k90d5w',53,'2026-07-14',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.916',NULL),
('cmpie73c7002k6p687jmqzb6s','cmpie73c500126p68i6k90d5w',54,'2026-07-15',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.919',NULL),
('cmpie73c7002l6p684dky0bs1','cmpie73c500126p68i6k90d5w',55,'2026-07-16',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.922',NULL),
('cmpie73c7002m6p68vw648zlt','cmpie73c500126p68i6k90d5w',56,'2026-07-17',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.925',NULL),
('cmpie73c7002n6p68toq7qxme','cmpie73c500126p68i6k90d5w',57,'2026-07-18',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.928',NULL),
('cmpie73c7002o6p687bsmjbj7','cmpie73c500126p68i6k90d5w',58,'2026-07-19',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.931',NULL),
('cmpie73c7002p6p6844eb4pws','cmpie73c500126p68i6k90d5w',59,'2026-07-20',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.934',NULL),
('cmpie73c7002q6p68b05ca8y5','cmpie73c500126p68i6k90d5w',60,'2026-07-21',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.937',NULL),
('cmpie73c7002r6p68e7ysxbb8','cmpie73c500126p68i6k90d5w',61,'2026-07-22',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.940',NULL),
('cmpie73c7002s6p68o50bir5l','cmpie73c500126p68i6k90d5w',62,'2026-07-23',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.943',NULL),
('cmpie73c7002t6p68tf48x95b','cmpie73c500126p68i6k90d5w',63,'2026-07-24',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.946',NULL),
('cmpie73c7002u6p68idzfe9z4','cmpie73c500126p68i6k90d5w',64,'2026-07-25',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.948',NULL),
('cmpie73c7002v6p68n8uemhpl','cmpie73c500126p68i6k90d5w',65,'2026-07-26',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.951',NULL),
('cmpie73c7002w6p68llkp9s3u','cmpie73c500126p68i6k90d5w',66,'2026-07-27',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.954',NULL),
('cmpie73c7002x6p68w7dis1f6','cmpie73c500126p68i6k90d5w',67,'2026-07-28',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.957',NULL),
('cmpie73c7002y6p68ophdsq5w','cmpie73c500126p68i6k90d5w',68,'2026-07-29',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.961',NULL),
('cmpie73c7002z6p68kfr9dw78','cmpie73c500126p68i6k90d5w',69,'2026-07-30',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.965',NULL),
('cmpie73c700306p68s0hjfx6f','cmpie73c500126p68i6k90d5w',70,'2026-07-31',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.968',NULL),
('cmpie73c700316p68l579adib','cmpie73c500126p68i6k90d5w',71,'2026-08-01',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.971',NULL),
('cmpie73c700326p685qt301nm','cmpie73c500126p68i6k90d5w',72,'2026-08-02',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.974',NULL),
('cmpie73c700336p685qa4aoqv','cmpie73c500126p68i6k90d5w',73,'2026-08-03',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.977',NULL),
('cmpie73c800346p68b7fmb89m','cmpie73c500126p68i6k90d5w',74,'2026-08-04',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.982',NULL),
('cmpie73c800356p68kox4lb5w','cmpie73c500126p68i6k90d5w',75,'2026-08-05',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.985',NULL),
('cmpie73c800366p68kt3xwtn4','cmpie73c500126p68i6k90d5w',76,'2026-08-06',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.989',NULL),
('cmpie73c800376p6808gvgilu','cmpie73c500126p68i6k90d5w',77,'2026-08-07',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.993',NULL),
('cmpie73c800386p68qwpy89oj','cmpie73c500126p68i6k90d5w',78,'2026-08-08',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.996',NULL),
('cmpie73c800396p68k30llfdj','cmpie73c500126p68i6k90d5w',79,'2026-08-09',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:52.999',NULL),
('cmpie73c8003a6p68nmvdik8t','cmpie73c500126p68i6k90d5w',80,'2026-08-10',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.002',NULL),
('cmpie73c8003b6p68zip1h5v9','cmpie73c500126p68i6k90d5w',81,'2026-08-11',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.006',NULL),
('cmpie73c8003c6p68sbnuzssu','cmpie73c500126p68i6k90d5w',82,'2026-08-12',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.009',NULL),
('cmpie73c8003d6p68k6ehli65','cmpie73c500126p68i6k90d5w',83,'2026-08-13',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.013',NULL),
('cmpie73c8003e6p68dn1vgnfu','cmpie73c500126p68i6k90d5w',84,'2026-08-14',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.017',NULL),
('cmpie73c8003f6p68a1fp274d','cmpie73c500126p68i6k90d5w',85,'2026-08-15',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.020',NULL),
('cmpie73c8003g6p68y9t3nwo3','cmpie73c500126p68i6k90d5w',86,'2026-08-16',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.024',NULL),
('cmpie73c8003h6p68codr3l8g','cmpie73c500126p68i6k90d5w',87,'2026-08-17',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.028',NULL),
('cmpie73c8003i6p6859mgsj9m','cmpie73c500126p68i6k90d5w',88,'2026-08-18',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.031',NULL),
('cmpie73c8003j6p68snnz7tia','cmpie73c500126p68i6k90d5w',89,'2026-08-19',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.035',NULL),
('cmpie73c8003k6p68v31erbs5','cmpie73c500126p68i6k90d5w',90,'2026-08-20',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.039',NULL),
('cmpie73c8003l6p68lwvl38br','cmpie73c500126p68i6k90d5w',91,'2026-08-21',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.043',NULL),
('cmpie73c8003m6p68rd7006le','cmpie73c500126p68i6k90d5w',92,'2026-08-22',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.047',NULL),
('cmpie73c8003n6p68dkz9q4r2','cmpie73c500126p68i6k90d5w',93,'2026-08-23',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.050',NULL),
('cmpie73c8003o6p68hqlopjmi','cmpie73c500126p68i6k90d5w',94,'2026-08-24',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.055',NULL),
('cmpie73c8003p6p68rfpzsrso','cmpie73c500126p68i6k90d5w',95,'2026-08-25',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.059',NULL),
('cmpie73c8003q6p68n1avv7p2','cmpie73c500126p68i6k90d5w',96,'2026-08-26',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.062',NULL),
('cmpie73c8003r6p68hegvkjjl','cmpie73c500126p68i6k90d5w',97,'2026-08-27',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.066',NULL),
('cmpie73c8003s6p68dl5npj7o','cmpie73c500126p68i6k90d5w',98,'2026-08-28',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.070',NULL),
('cmpie73c8003t6p68fugfxtuq','cmpie73c500126p68i6k90d5w',99,'2026-08-29',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.074',NULL),
('cmpie73c8003u6p68w8t3tumx','cmpie73c500126p68i6k90d5w',100,'2026-08-30',100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-23 13:36:45.221','2026-05-23 13:36:53.077',NULL);
/*!40000 ALTER TABLE `instalments` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `kyc_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `kyc_documents` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `loan_collaterals` DISABLE KEYS */;
/*!40000 ALTER TABLE `loan_collaterals` ENABLE KEYS */;
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
  `deduction_type` varchar(191) NOT NULL DEFAULT 'fixed',
  PRIMARY KEY (`id`),
  KEY `loan_packages_tenant_id_fkey` (`tenant_id`),
  CONSTRAINT `loan_packages_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loan_packages`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `loan_packages` DISABLE KEYS */;
INSERT INTO `loan_packages` VALUES
('cmp1cxg54001cm5lsqhxg0acm','cmp1cxexi0000m5lsfbfigi9x','100-Day Daily',30000.00,3000.00,'daily',100,300.00,50.00,'microlending','active','2026-05-11 15:29:10.649','2026-05-14 13:41:39.560','fixed'),
('cmp1cxg5c001em5lsjrhrpzve','cmp1cxexi0000m5lsfbfigi9x','100-Day Daily',50000.00,5000.00,'daily',100,500.00,100.00,'microlending','active','2026-05-11 15:29:10.656','2026-05-14 13:41:39.568','fixed'),
('cmp1cxg5g001gm5lsoilkcphb','cmp1cxexi0000m5lsfbfigi9x','20-Week Weekly',20000.00,2000.00,'weekly',20,1000.00,200.00,'microlending','active','2026-05-11 15:29:10.660','2026-05-14 13:41:39.572','fixed'),
('cmp1cxg5j001im5lse51nqww5','cmp1cxexi0000m5lsfbfigi9x','10-Month Monthly',25000.00,2500.00,'monthly',10,2500.00,500.00,'microlending','active','2026-05-11 15:29:10.664','2026-05-14 13:41:39.576','fixed'),
('cmp5jnvey003b12atz02nordu','cmp1cxexi0000m5lsfbfigi9x','110-Month Monthly',10000.00,0.00,'monthly',110,91.00,100.00,'microlending','active','2026-05-14 13:48:45.898','2026-05-14 13:48:45.898','fixed'),
('cmpie73bv00106p686drf9j6z','cmpidzhq500026p68kx42vzr4','100-Day Daily',10000.00,0.00,'daily',100,100.00,50.00,'microlending','active','2026-05-23 13:36:45.211','2026-05-23 13:36:45.211','upfront_fixed');
/*!40000 ALTER TABLE `loan_packages` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `loan_provisioning`
--

DROP TABLE IF EXISTS `loan_provisioning`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_provisioning` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `loan_id` varchar(191) NOT NULL,
  `snapshot_date` date NOT NULL,
  `category` varchar(191) NOT NULL,
  `outstanding_amt` decimal(12,2) NOT NULL,
  `provisioning_rate` decimal(6,2) NOT NULL,
  `provisioning_amt` decimal(12,2) NOT NULL,
  `is_secured` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `loan_provisioning_loan_id_snapshot_date_key` (`loan_id`,`snapshot_date`),
  KEY `loan_provisioning_tenant_id_snapshot_date_idx` (`tenant_id`,`snapshot_date`),
  CONSTRAINT `loan_provisioning_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `loan_provisioning_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loan_provisioning`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `loan_provisioning` DISABLE KEYS */;
/*!40000 ALTER TABLE `loan_provisioning` ENABLE KEYS */;
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
  `deduction_type` varchar(191) NOT NULL DEFAULT 'fixed',
  `deleted_at` datetime(3) DEFAULT NULL,
  `npa_classified_at` datetime(3) DEFAULT NULL,
  `npa_status` varchar(191) DEFAULT NULL,
  `total_payable` decimal(12,2) NOT NULL DEFAULT 0.00,
  `due_day` int(11) DEFAULT NULL,
  `bureau_report_id` varchar(191) DEFAULT NULL,
  `is_secured` tinyint(1) NOT NULL DEFAULT 0,
  `last_npa_review_date` datetime(3) DEFAULT NULL,
  `npa_days_overdue` int(11) NOT NULL DEFAULT 0,
  `npa_sub_category` varchar(191) DEFAULT NULL,
  `npa_upgrade_eligible` tinyint(1) NOT NULL DEFAULT 0,
  `provisioning_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `provisioning_category` varchar(191) NOT NULL DEFAULT 'standard',
  `provisioning_rate` decimal(6,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `loans_tenant_id_loan_code_key` (`tenant_id`,`loan_code`),
  KEY `loans_branch_id_fkey` (`branch_id`),
  KEY `loans_customer_id_fkey` (`customer_id`),
  KEY `loans_package_id_fkey` (`package_id`),
  KEY `loans_created_by_id_fkey` (`created_by_id`),
  KEY `loans_guarantor_id_fkey` (`guarantor_id`),
  KEY `loans_tenant_id_app_type_status_idx` (`tenant_id`,`app_type`,`status`),
  KEY `loans_bureau_report_id_fkey` (`bureau_report_id`),
  KEY `loans_tenant_id_npa_status_idx` (`tenant_id`,`npa_status`),
  KEY `loans_tenant_id_npa_days_overdue_idx` (`tenant_id`,`npa_days_overdue`),
  CONSTRAINT `loans_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `loans_bureau_report_id_fkey` FOREIGN KEY (`bureau_report_id`) REFERENCES `bureau_reports` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
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
/*!40000 ALTER TABLE `loans` DISABLE KEYS */;
INSERT INTO `loans` VALUES
('cmpie73c500126p68i6k90d5w','cmpidzhq500026p68kx42vzr4','cmpie0at6000a6p68mp3bjfla','DL0001','cmpie6f8a000u6p68pbfyie3p','cmpie73bv00106p686drf9j6z','cheque','microlending','{\"bankName\":\"\",\"chequeNumber\":\"\",\"chequeAmount\":\"\"}',NULL,10000.00,0.00,10000.00,'daily',100,'2026-05-23','2026-08-31',100.00,50.00,'','active',1,100,100.00,NULL,'cmpidzhuy00046p68w5hl1pe0','2026-05-23 13:36:45.221','2026-05-23 13:36:53.081','upfront_fixed',NULL,NULL,NULL,10000.00,NULL,NULL,0,NULL,0,NULL,0,0.00,'standard',0.00);
/*!40000 ALTER TABLE `loans` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `module_requests`
--

DROP TABLE IF EXISTS `module_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `module_requests` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `requested_by_id` varchar(191) NOT NULL,
  `app_type` varchar(191) NOT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'pending',
  `reviewed_by_id` varchar(191) DEFAULT NULL,
  `review_note` text DEFAULT NULL,
  `reviewed_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `module_requests_tenant_id_status_idx` (`tenant_id`,`status`),
  KEY `module_requests_requested_by_id_idx` (`requested_by_id`),
  KEY `module_requests_reviewed_by_id_fkey` (`reviewed_by_id`),
  CONSTRAINT `module_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `module_requests_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `module_requests_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `module_requests`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `module_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `module_requests` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `notification_logs`
--

DROP TABLE IF EXISTS `notification_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_logs` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `channel` varchar(191) NOT NULL,
  `recipient` varchar(191) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'sent',
  `error_message` text DEFAULT NULL,
  `entity_type` varchar(191) DEFAULT NULL,
  `entity_id` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `notification_logs_tenant_id_channel_created_at_idx` (`tenant_id`,`channel`,`created_at`),
  CONSTRAINT `notification_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_logs`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `notification_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `notification_logs` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `notification_templates` DISABLE KEYS */;
INSERT INTO `notification_templates` VALUES
('cmp1cxg5m001km5lsszzq95ll','cmp1cxexi0000m5lsfbfigi9x','payment_reminder','sms',NULL,'Dear {{customer_name}}, your payment of {{currency_symbol}}{{amount}} for loan {{loan_code}} is due today. Please pay your agent.',1,'2026-05-11 15:29:10.667','2026-05-11 15:29:10.667'),
('cmp1cxg5r001mm5ls6kdhzcdn','cmp1cxexi0000m5lsfbfigi9x','payment_reminder','whatsapp',NULL,'Hi {{customer_name}} ????\n\nYour payment of {{currency_symbol}}{{amount}} for loan *{{loan_code}}* is due today.\n\nPlease arrange payment with your field agent.\n\nThank you!',1,'2026-05-11 15:29:10.672','2026-05-11 15:29:10.672'),
('cmp1cxg5u001om5lslgmfs381','cmp1cxexi0000m5lsfbfigi9x','overdue_alert','sms',NULL,'ALERT: Dear {{customer_name}}, your payment for loan {{loan_code}} is overdue by {{days}} days. Penalty of {{currency_symbol}}{{penalty}} has been applied.',1,'2026-05-11 15:29:10.674','2026-05-11 15:29:10.674'),
('cmp1cxg5x001qm5ls4ct8d5t3','cmp1cxexi0000m5lsfbfigi9x','loan_created','sms',NULL,'Dear {{customer_name}}, your loan {{loan_code}} of {{currency_symbol}}{{principal}} has been approved. Collection starts {{start_date}}. Per instalment: {{currency_symbol}}{{per_instalment}}.',1,'2026-05-11 15:29:10.677','2026-05-11 15:29:10.677');
/*!40000 ALTER TABLE `notification_templates` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `npa_history`
--

DROP TABLE IF EXISTS `npa_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `npa_history` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `loan_id` varchar(191) NOT NULL,
  `customer_id` varchar(191) NOT NULL,
  `from_category` varchar(191) NOT NULL,
  `to_category` varchar(191) NOT NULL,
  `days_overdue` int(11) NOT NULL,
  `outstanding_amt` decimal(12,2) NOT NULL,
  `triggered_by` varchar(191) NOT NULL,
  `triggered_by_id` varchar(191) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `provisioning_rate` decimal(6,2) NOT NULL,
  `provisioning_amount` decimal(12,2) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `npa_history_loan_id_created_at_idx` (`loan_id`,`created_at`),
  KEY `npa_history_tenant_id_to_category_created_at_idx` (`tenant_id`,`to_category`,`created_at`),
  CONSTRAINT `npa_history_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `npa_history_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `npa_history`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `npa_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `npa_history` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `payment_allocations`
--

DROP TABLE IF EXISTS `payment_allocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_allocations` (
  `id` varchar(191) NOT NULL,
  `payment_id` varchar(191) NOT NULL,
  `instalment_id` varchar(191) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `payment_allocations_payment_id_idx` (`payment_id`),
  KEY `payment_allocations_instalment_id_idx` (`instalment_id`),
  CONSTRAINT `payment_allocations_instalment_id_fkey` FOREIGN KEY (`instalment_id`) REFERENCES `instalments` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `payment_allocations_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_allocations`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `payment_allocations` DISABLE KEYS */;
INSERT INTO `payment_allocations` VALUES
('cmpie794r00456p685ni5bsmo','cmpie794m00436p685awmgbw2','cmpie73c600136p68nqx42brn',100.00,'2026-05-23 13:36:52.731');
/*!40000 ALTER TABLE `payment_allocations` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` varchar(191) NOT NULL,
  `tenant_id` varchar(191) NOT NULL,
  `loan_id` varchar(191) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_mode` varchar(191) NOT NULL,
  `reference_number` varchar(191) DEFAULT NULL,
  `payment_date` datetime(3) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'completed',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `payments_loan_id_idx` (`loan_id`),
  KEY `payments_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `payments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES
('cmpie794m00436p685awmgbw2','cmpidzhq500026p68kx42vzr4','cmpie73c500126p68i6k90d5w',100.00,'cash',NULL,'2026-05-23 13:36:52.725','completed','2026-05-23 13:36:52.727','2026-05-23 13:36:52.727');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
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
  `settled_at` datetime(3) DEFAULT NULL,
  `instalment_id` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `penalties_loan_id_fkey` (`loan_id`),
  KEY `penalties_customer_id_fkey` (`customer_id`),
  KEY `penalties_settled_by_id_fkey` (`settled_by_id`),
  KEY `penalties_instalment_id_fkey` (`instalment_id`),
  CONSTRAINT `penalties_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `penalties_instalment_id_fkey` FOREIGN KEY (`instalment_id`) REFERENCES `instalments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `penalties_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `penalties_settled_by_id_fkey` FOREIGN KEY (`settled_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `penalties`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `penalties` DISABLE KEYS */;
/*!40000 ALTER TABLE `penalties` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `rate_limits`
--

DROP TABLE IF EXISTS `rate_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `rate_limits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rate_key` varchar(512) NOT NULL,
  `count` int(11) NOT NULL DEFAULT 1,
  `window_start` datetime(3) NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `rate_limits_rate_key_key` (`rate_key`),
  KEY `rate_limits_expires_at_idx` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=455 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rate_limits`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `rate_limits` DISABLE KEYS */;
INSERT INTO `rate_limits` VALUES
(1,'login:user:admin',2,'2026-05-21 12:19:43.480','2026-05-21 12:34:43.480','2026-05-14 12:54:10.246','2026-05-21 12:25:49.558'),
(2,'login:ip:127.0.0.1',4,'2026-05-14 12:54:10.246','2026-05-14 13:09:10.246','2026-05-14 12:54:10.246','2026-05-14 13:08:29.582'),
(8,'login:user:superadmin',1,'2026-05-23 13:37:34.461','2026-05-23 13:52:34.461','2026-05-14 13:08:29.583','2026-05-23 13:37:34.461'),
(10,'login:ip:::1',1,'2026-05-20 13:55:08.781','2026-05-20 14:10:08.781','2026-05-15 11:00:40.076','2026-05-20 13:55:08.781'),
(11,'login:user:developer',2,'2026-05-23 13:27:59.199','2026-05-23 13:42:59.199','2026-05-16 07:57:58.110','2026-05-23 13:38:08.563'),
(114,'login:user:testadmin',1,'2026-05-21 07:58:19.113','2026-05-21 08:13:19.113','2026-05-17 09:00:46.666','2026-05-21 07:58:19.113'),
(117,'login:user:erodeadmin',1,'2026-05-21 07:35:49.177','2026-05-21 07:50:49.177','2026-05-17 09:17:51.681','2026-05-21 07:35:49.177'),
(121,'login:user:new',5,'2026-05-19 15:25:07.264','2026-05-19 15:40:07.264','2026-05-17 09:41:41.102','2026-05-19 15:26:06.842'),
(176,'login:user:karthik',3,'2026-05-21 09:20:09.150','2026-05-21 09:35:09.150','2026-05-17 13:54:52.433','2026-05-21 09:33:22.371'),
(238,'login:user:bad_user',1,'2026-05-18 15:36:50.244','2026-05-18 15:51:50.244','2026-05-18 15:36:50.244','2026-05-18 15:36:50.244'),
(335,'login:user:jhone',3,'2026-05-20 13:26:56.136','2026-05-20 13:41:56.136','2026-05-20 13:26:56.136','2026-05-20 13:27:40.048'),
(343,'login:ip:0.0.0.0',4,'2026-05-23 13:27:59.199','2026-05-23 13:42:59.199','2026-05-20 17:13:47.235','2026-05-23 13:38:08.561'),
(348,'login:user:pickle',1,'2026-05-20 17:15:01.958','2026-05-20 17:30:01.958','2026-05-20 17:15:01.958','2026-05-20 17:15:01.958'),
(356,'login:user:kathik',1,'2026-05-21 06:07:13.721','2026-05-21 06:22:13.721','2026-05-21 06:07:13.721','2026-05-21 06:07:13.721'),
(358,'login:user:karthikrajan',1,'2026-05-21 06:07:24.485','2026-05-21 06:22:24.485','2026-05-21 06:07:24.485','2026-05-21 06:07:24.485'),
(440,'login:user:admin3',1,'2026-05-23 07:42:11.165','2026-05-23 07:57:11.165','2026-05-23 07:42:11.165','2026-05-23 07:42:11.165'),
(449,'login:user:vignesh',1,'2026-05-23 13:31:36.606','2026-05-23 13:46:36.606','2026-05-23 13:31:36.606','2026-05-23 13:31:36.606');
/*!40000 ALTER TABLE `rate_limits` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `route_agents` DISABLE KEYS */;
/*!40000 ALTER TABLE `route_agents` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `routes` DISABLE KEYS */;
INSERT INTO `routes` VALUES
('cmpie1egq000e6p682f3rlg3v','cmpidzhq500026p68kx42vzr4',NULL,'erode',NULL,'active','2026-05-23 13:32:19.706','2026-05-23 13:32:19.706','microlending');
/*!40000 ALTER TABLE `routes` ENABLE KEYS */;
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
  `loan_id` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `security_cheques_customer_id_fkey` (`customer_id`),
  KEY `security_cheques_loan_id_fkey` (`loan_id`),
  CONSTRAINT `security_cheques_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `security_cheques_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `security_cheques`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `security_cheques` DISABLE KEYS */;
/*!40000 ALTER TABLE `security_cheques` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `superadmin_branches`
--

DROP TABLE IF EXISTS `superadmin_branches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `superadmin_branches` (
  `id` varchar(191) NOT NULL,
  `superadmin_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) NOT NULL,
  `assigned_by_id` varchar(191) DEFAULT NULL,
  `assigned_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `superadmin_branches_superadmin_id_branch_id_key` (`superadmin_id`,`branch_id`),
  KEY `superadmin_branches_branch_id_idx` (`branch_id`),
  KEY `superadmin_branches_assigned_by_id_fkey` (`assigned_by_id`),
  CONSTRAINT `superadmin_branches_assigned_by_id_fkey` FOREIGN KEY (`assigned_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `superadmin_branches_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `superadmin_branches_superadmin_id_fkey` FOREIGN KEY (`superadmin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `superadmin_branches`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `superadmin_branches` DISABLE KEYS */;
INSERT INTO `superadmin_branches` VALUES
('cmpieepk1004g6p6834p1qfv4','cmpidzhuy00046p68w5hl1pe0','cmpie0at6000a6p68mp3bjfla','cmp1cxfp20008m5lsqle1q8u1','2026-05-23 13:42:40.610');
/*!40000 ALTER TABLE `superadmin_branches` ENABLE KEYS */;
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
  `branch_id` varchar(191) DEFAULT NULL,
  `target_role` varchar(191) DEFAULT NULL,
  `target_user_id` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `system_notifications_tenant_id_app_type_is_read_idx` (`tenant_id`,`app_type`,`is_read`),
  KEY `system_notifications_created_at_idx` (`created_at`),
  KEY `system_notifications_branch_id_idx` (`branch_id`),
  KEY `system_notifications_target_user_id_is_read_idx` (`target_user_id`,`is_read`),
  CONSTRAINT `system_notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_notifications`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `system_notifications` DISABLE KEYS */;
INSERT INTO `system_notifications` VALUES
('cmp5nqzx5007f12atrlvn42yj','cmp1cxexi0000m5lsfbfigi9x','microlending','success','money_off','Penalty Waived','Penalty of 10 waived for loan LN0013 by admin.','/loans/cmp3xluko00uhtzssuiit0wqb',1,'2026-05-14 15:43:42.916',NULL,'2026-05-14 15:43:10.169',NULL,NULL,NULL),
('cmpfaj7qr00619ljpz045q1nj','cmp1cxexi0000m5lsfbfigi9x','microlending','request_rejected','cancel','Request rejected','Your edit collection request has been rejected.','/microlending/approvals',1,'2026-05-21 09:31:19.157',NULL,'2026-05-21 09:30:53.811',NULL,'agent','cmp1cxfck0006m5lsp6xj0azh'),
('cmpfam6j900779ljpkuq2qmzc','cmp1cxexi0000m5lsfbfigi9x','microlending','request_approved','check_circle','Request approved','Your edit collection request has been approved.','/microlending/approvals',1,'2026-05-21 09:33:35.247',NULL,'2026-05-21 09:33:12.214',NULL,'agent','cmp1cxfck0006m5lsp6xj0azh');
/*!40000 ALTER TABLE `system_notifications` ENABLE KEYS */;
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
  `enabled_modules` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`enabled_modules`)),
  `trial_ends_at` datetime(3) DEFAULT NULL,
  `current_period_end` datetime(3) DEFAULT NULL,
  `razorpay_sub_id` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `grace_period_end` datetime(3) DEFAULT NULL,
  `max_branches` int(11) NOT NULL DEFAULT 1,
  `whatsapp_sms_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `receipt_pdf_allowed` tinyint(1) NOT NULL DEFAULT 0,
  `bureau_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `bureau_pulls_included` int(11) NOT NULL DEFAULT 50,
  `bureau_pulls_used` int(11) NOT NULL DEFAULT 0,
  `npa_enabled` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_subscriptions_tenant_id_key` (`tenant_id`),
  UNIQUE KEY `tenant_subscriptions_razorpay_sub_id_key` (`razorpay_sub_id`),
  CONSTRAINT `tenant_subscriptions_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_subscriptions`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `tenant_subscriptions` DISABLE KEYS */;
INSERT INTO `tenant_subscriptions` VALUES
('cmp87ky4x0001z45xon2cjo0w','cmp1cxexi0000m5lsfbfigi9x','basic','active',200,10,'[\"microlending\",\"autofinance\",\"chitfunds\"]','2026-05-15 00:00:00.000','2026-05-31 00:00:00.000',NULL,'2026-05-16 10:33:52.588','2026-05-20 11:20:15.192',NULL,1,0,0,0,50,0,0),
('cmpidzhvb00086p68cvxjltii','cmpidzhq500026p68kx42vzr4','trial','active',100,5,'[\"microlending\"]',NULL,NULL,NULL,'2026-05-23 13:30:50.807','2026-05-23 13:42:40.598',NULL,1,0,0,0,50,0,0);
/*!40000 ALTER TABLE `tenant_subscriptions` ENABLE KEYS */;
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
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenants_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenants`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `tenants` DISABLE KEYS */;
INSERT INTO `tenants` VALUES
('cmp1cxexi0000m5lsfbfigi9x','LoanTrack','default','active','2026-05-11 15:29:09.072','2026-05-11 15:29:09.072',NULL),
('cmpfiubop0000ag49wddz1ao0','Test Tenant ML-D-001','test-1779369807014','active','2026-05-21 13:23:29.066','2026-05-21 13:23:29.066',NULL),
('cmpfiv43o00009n0mf3sl2e2t','Test Tenant ML-D-001','test-1779369843852','active','2026-05-21 13:24:05.893','2026-05-21 13:24:05.893',NULL),
('cmpidzhq500026p68kx42vzr4','Vignesh ','tnt_zh5kh34','active','2026-05-23 13:30:50.621','2026-05-23 13:30:50.621',NULL);
/*!40000 ALTER TABLE `tenants` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `user_branch_modules`
--

DROP TABLE IF EXISTS `user_branch_modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_branch_modules` (
  `id` varchar(191) NOT NULL,
  `user_id` varchar(191) NOT NULL,
  `branch_id` varchar(191) NOT NULL,
  `enabled_modules` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`enabled_modules`)),
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_branch_modules_user_id_branch_id_key` (`user_id`,`branch_id`),
  KEY `user_branch_modules_branchId_idx` (`branch_id`),
  CONSTRAINT `user_branch_modules_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_branch_modules_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_branch_modules`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `user_branch_modules` DISABLE KEYS */;
INSERT INTO `user_branch_modules` VALUES
('cmp9k950x000b1i4u9znbvget','cmp9k94zq00071i4u78foa56m','cmp1cxext0002m5ls50zh8t71','[\"chitfunds\"]','2026-05-17 09:16:22.832','2026-05-20 12:13:12.451'),
('cmp9okc4k000n1i4ub8s00p4v','cmp9jbz8s00011i4ukf18ij2x','cmp1cxext0002m5ls50zh8t71','[\"microlending\",\"autofinance\"]','2026-05-17 11:17:03.716','2026-05-18 13:31:12.306'),
('cmp9tu8bq0005x5ef166x7kbw','cmp9kz3ro000d1i4u4x0gqyop','cmp1cxext0002m5ls50zh8t71','[\"microlending\",\"autofinance\"]','2026-05-17 13:44:43.429','2026-05-19 15:26:00.052'),
('cmp9vijpt0009x5ef5ahd24hd','cmp1cxf590004m5lsp05yll1b','cmp1cxext0002m5ls50zh8t71','[\"microlending\",\"autofinance\"]','2026-05-17 14:31:37.553','2026-05-20 11:54:42.378'),
('cmpdyomxp000xfco1a0mpdg46','cmpdyomxb000tfco1l321sccv','cmp1cxext0002m5ls50zh8t71','[\"microlending\",\"autofinance\"]','2026-05-20 11:11:25.212','2026-05-20 11:11:25.212'),
('cmpe1176g002ffco1ifegctzs','cmpe11769002bfco1g0czkm2j','cmp1cxext0002m5ls50zh8t71','[\"chitfunds\"]','2026-05-20 12:17:10.553','2026-05-20 12:17:10.553'),
('cmpf3a0jb0020663yqoldxdrb','cmp1cxfck0006m5lsp6xj0azh','cmp1cxext0002m5ls50zh8t71','[\"microlending\"]','2026-05-21 06:07:47.255','2026-05-21 06:07:47.255'),
('cmpi1ivq2000duus4kqu74el3','cmpi0plhw0003uus4paki7ap4','cmp1cxext0002m5ls50zh8t71','[\"microlending\"]','2026-05-23 07:42:00.218','2026-05-23 07:42:00.218'),
('cmpie4dae000q6p68ddhksxkn','cmpie44xk000i6p68f1d20twu','cmpie0at6000a6p68mp3bjfla','[\"microlending\"]','2026-05-23 13:34:38.150','2026-05-23 13:34:38.150');
/*!40000 ALTER TABLE `user_branch_modules` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `user_modules`
--

DROP TABLE IF EXISTS `user_modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_modules` (
  `id` varchar(191) NOT NULL,
  `user_id` varchar(191) NOT NULL,
  `app_type` varchar(191) NOT NULL,
  `assigned_by_id` varchar(191) DEFAULT NULL,
  `assigned_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_modules_user_id_app_type_key` (`user_id`,`app_type`),
  KEY `user_modules_user_id_idx` (`user_id`),
  KEY `user_modules_assigned_by_id_fkey` (`assigned_by_id`),
  CONSTRAINT `user_modules_assigned_by_id_fkey` FOREIGN KEY (`assigned_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `user_modules_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_modules`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `user_modules` DISABLE KEYS */;
INSERT INTO `user_modules` VALUES
('cmpi1ivpt000buus42bskf5r3','cmpi0plhw0003uus4paki7ap4','microlending','cmp9dwygs00017bb7ekcb8a3i','2026-05-23 07:42:00.210'),
('cmpie4da9000o6p683i3yaswu','cmpie44xk000i6p68f1d20twu','microlending','cmpidzhuy00046p68w5hl1pe0','2026-05-23 13:34:38.146');
/*!40000 ALTER TABLE `user_modules` ENABLE KEYS */;
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
  `deleted_at` datetime(3) DEFAULT NULL,
  `totp_secret` varchar(191) DEFAULT NULL,
  `can_create_loan` tinyint(1) NOT NULL DEFAULT 0,
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
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
('cmp1cxf590004m5lsp05yll1b','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Admin User','9800000000',NULL,'admin','$2b$12$g0L/nd45weUtMZaoLFF0KOEAqOg4q3.zv6W1JicJAAXOFr.NiKHT2','admin','microlending','active',NULL,'2026-05-21 12:25:52.338','2026-05-11 15:29:09.357','2026-05-21 12:25:52.343',NULL,NULL,0),
('cmp1cxfck0006m5lsp6xj0azh','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Karthik Rajan','9876543210',NULL,'karthik','$2b$10$9WtrGj6ferC1xKPdwoJDYOSVhSSmMXD0TS8yNq4OgmLnA1FiJL0cO','agent','microlending','active',NULL,'2026-05-21 09:33:22.622','2026-05-11 15:29:09.620','2026-05-21 09:33:22.627',NULL,NULL,0),
('cmp1cxfp20008m5lsqle1q8u1','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Developer','9000000001',NULL,'developer','$2b$12$VcufXq4X0CNTAkx.DZXwYeOCyhnlRS1F12vTFwGy76CEuTx.s8ZB.','developer','microlending','active',NULL,'2026-05-23 13:38:09.093','2026-05-11 15:29:10.070','2026-05-23 13:38:09.095',NULL,NULL,0),
('cmp1cxg2t000am5lsjru6vfbe','cmp1cxexi0000m5lsfbfigi9x',NULL,'admin2','9000000002',NULL,'admin2','$2b$10$U3x7hi4sprH/hh/VKe3U0uhwnnf/xObJHETqvA4G0WHLr5wna9qtS','admin','microlending','inactive',NULL,'2026-05-16 18:36:18.122','2026-05-11 15:29:10.565','2026-05-18 14:52:20.123',NULL,NULL,0),
('cmp9dwygs00017bb7ekcb8a3i','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Super Admin','9998887776',NULL,'superadmin','$2b$12$R1Ywg3vkfgTtMPHMypK36uKA2DsgeuB0vd0u8e/0Xxxcx8q1GmZpG','superadmin','microlending','active',NULL,'2026-05-23 13:37:35.006','2026-05-17 06:18:56.764','2026-05-23 13:37:35.009',NULL,NULL,0),
('cmp9jbz8s00011i4ukf18ij2x','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Test Branch Admin','9876543222',NULL,'testadmin','$2b$10$RQN2jaXc5IPzf5aC/enC3epZM5jgCTAhcSAqTkGCyGIEh0B0zhptK','admin','microlending','active',NULL,'2026-05-21 07:58:19.291','2026-05-17 08:50:35.687','2026-05-21 07:58:19.295',NULL,NULL,0),
('cmp9k94zq00071i4u78foa56m','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Erode Branch Admin','9876543233',NULL,'erodeadmin','$2b$10$aCkU3KKcHa2tVJ9OVXWv7uxVdCd7QVp8DpzFzmBNj0qh2Wrwjfxsm','admin','chitfunds','active',NULL,'2026-05-21 07:35:49.337','2026-05-17 09:16:22.787','2026-05-21 07:35:49.339',NULL,NULL,0),
('cmp9kz3ro000d1i4u4x0gqyop','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','new','7442941290',NULL,'new','$2b$10$Jjh3S8.EFs.C.dXYAhLbMupP1k.RBHgcEU8NvZYKHUTojZG7xyIjS','agent','microlending','active',NULL,'2026-05-19 15:26:07.032','2026-05-17 09:36:34.260','2026-05-19 15:26:07.039',NULL,NULL,0),
('cmpdyomxb000tfco1l321sccv','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Pickle','987654123',NULL,'pickle','$2b$10$Wu22AFOXPgAmSDyI3GWBWuBKncYvxT2B16cikG5fBDbbKVljUgCxi','agent','microlending','active',NULL,'2026-05-20 17:15:02.199','2026-05-20 11:11:25.199','2026-05-20 17:15:02.205',NULL,NULL,0),
('cmpe11769002bfco1g0czkm2j','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','John','9876543211',NULL,'Jhone','$2b$10$HCOGEMu91z6/S.QvFZRR8u.HPVSgi3Qm17Mi0b4haWMzvA0w0qrZa','agent','chitfunds','active',NULL,'2026-05-20 13:27:40.174','2026-05-20 12:17:10.545','2026-05-20 13:27:40.177',NULL,NULL,0),
('cmpi0plhw0003uus4paki7ap4','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','admin3','7894561230',NULL,'admin3','$2b$10$PloJGAjP/xCY1.LtUhO4BupkrWyLYaqiHQvhhv55/3LCq5c6OWe2u','admin','microlending','active',NULL,'2026-05-23 07:42:11.333','2026-05-23 07:19:13.939','2026-05-23 07:42:11.339',NULL,NULL,0),
('cmpidzhuy00046p68w5hl1pe0','cmpidzhq500026p68kx42vzr4',NULL,'Vignesh ','9874561230',NULL,'Vignesh','$2b$10$AdJtZjYgE7S/eDFX/en/I.MQylnALIkTBvt8NKYs2fvic98lo.W4u','superadmin','microlending','active',NULL,'2026-05-23 13:31:36.727','2026-05-23 13:30:50.794','2026-05-23 13:42:40.583',NULL,NULL,0),
('cmpie44xk000i6p68f1d20twu','cmpidzhq500026p68kx42vzr4','cmpie0at6000a6p68mp3bjfla','agent','9874563210',NULL,'agent1','$2b$10$YZO12XSCw0e5il/mKIJSzO9915gnUKePmSgn5hQ4LzGwYdgmil39G','agent','microlending','active',NULL,NULL,'2026-05-23 13:34:27.320','2026-05-23 13:34:38.133',NULL,NULL,0);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
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
  `deleted_at` datetime(3) DEFAULT NULL,
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
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `webhook_events`
--

DROP TABLE IF EXISTS `webhook_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `webhook_events` (
  `id` varchar(191) NOT NULL,
  `provider` varchar(191) NOT NULL,
  `event_id` varchar(255) NOT NULL,
  `event` varchar(128) NOT NULL,
  `payload` text NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'processed',
  `processed_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `webhook_events_provider_event_id_key` (`provider`,`event_id`),
  KEY `webhook_events_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `webhook_events`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `webhook_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `webhook_events` ENABLE KEYS */;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-05-23 22:15:12
