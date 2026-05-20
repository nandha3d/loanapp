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
('cmp2mn0p20001g8w0pvs35tuc','cmp1cxexi0000m5lsfbfigi9x','language','en','system','2026-05-12 12:48:46.407','2026-05-19 15:14:36.486');
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
INSERT INTO `approval_requests` VALUES
('cmpcbikgx009rt82vhdwit5z8','cmp1cxexi0000m5lsfbfigi9x','microlending','customer_create','customer','cmpcbikgs009pt82v9tg5w9z2','cmp1cxfck0006m5lsp6xj0azh','{\"name\":\"Browser QA Pending Customer\"}','Browser QA pending approval','pending',NULL,NULL,NULL,'2026-05-19 07:35:04.738','2026-05-19 07:35:04.738');
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
('cmpbbognb0002sl2eol94ku7c','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','database_wipe','system',NULL,NULL,'{\"wiped\":[\"loans\",\"customers\",\"accounting\",\"agents_routes\",\"approvals\"]}',NULL,NULL,'2026-05-18 14:51:53.543'),
('cmpbbozib0004sl2eq02cq96r','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','update','user','cmp1cxf590004m5lsp05yll1b',NULL,'{\"status\":\"inactive\"}',NULL,NULL,'2026-05-18 14:52:17.987'),
('cmpbbp15r0006sl2eye087hpu','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','update','user','cmp1cxg2t000am5lsjru6vfbe',NULL,'{\"status\":\"inactive\"}',NULL,NULL,'2026-05-18 14:52:20.127'),
('cmpbbp3ta0008sl2ex78z1xuk','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','update','user','cmp9k94zq00071i4u78foa56m',NULL,'{\"status\":\"inactive\"}',NULL,NULL,'2026-05-18 14:52:23.566'),
('cmpbbp640000asl2eyxxzru2i','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','update','user','cmp9kz3ro000d1i4u4x0gqyop',NULL,'{\"status\":\"inactive\"}',NULL,NULL,'2026-05-18 14:52:26.544'),
('cmpbbp8dd000csl2ej57k3oai','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','update','user','cmp1cxfck0006m5lsp6xj0azh',NULL,'{\"status\":\"inactive\"}',NULL,NULL,'2026-05-18 14:52:29.474'),
('cmpbbp9j9000esl2e96tzvt8c','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','update','user','cmp9jbz8s00011i4ukf18ij2x',NULL,'{\"status\":\"inactive\"}',NULL,NULL,'2026-05-18 14:52:30.981'),
('cmpcbikh3009tt82v2xn51v0m','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-0',NULL,'{\"i\":0}',NULL,NULL,'2026-05-19 07:35:04.744'),
('cmpcbikh7009vt82vr4c5sudi','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-1',NULL,'{\"i\":1}',NULL,NULL,'2026-05-19 07:35:04.747'),
('cmpcbikhb009xt82v4zrd6i23','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-2',NULL,'{\"i\":2}',NULL,NULL,'2026-05-19 07:35:04.751'),
('cmpcbikhe009zt82vfct5jwrn','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-3',NULL,'{\"i\":3}',NULL,NULL,'2026-05-19 07:35:04.754'),
('cmpcbikhh00a1t82v4yizxnng','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-4',NULL,'{\"i\":4}',NULL,NULL,'2026-05-19 07:35:04.757'),
('cmpcbikhk00a3t82v0ixvvw85','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-5',NULL,'{\"i\":5}',NULL,NULL,'2026-05-19 07:35:04.761'),
('cmpcbikho00a5t82v0hpkdvb1','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-6',NULL,'{\"i\":6}',NULL,NULL,'2026-05-19 07:35:04.764'),
('cmpcbikhs00a7t82v1sbwq8on','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-7',NULL,'{\"i\":7}',NULL,NULL,'2026-05-19 07:35:04.768'),
('cmpcbikhv00a9t82v2ylbiury','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-8',NULL,'{\"i\":8}',NULL,NULL,'2026-05-19 07:35:04.772'),
('cmpcbikhx00abt82vxcsv3fxp','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-9',NULL,'{\"i\":9}',NULL,NULL,'2026-05-19 07:35:04.774'),
('cmpcbiki100adt82vgwsl6w2r','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-10',NULL,'{\"i\":10}',NULL,NULL,'2026-05-19 07:35:04.778'),
('cmpcbiki400aft82vohyt8bm5','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-11',NULL,'{\"i\":11}',NULL,NULL,'2026-05-19 07:35:04.781'),
('cmpcbiki700aht82v2w6lbhlc','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-12',NULL,'{\"i\":12}',NULL,NULL,'2026-05-19 07:35:04.784'),
('cmpcbikib00ajt82vv1mdmmqj','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-13',NULL,'{\"i\":13}',NULL,NULL,'2026-05-19 07:35:04.787'),
('cmpcbikie00alt82v56blvq6s','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-14',NULL,'{\"i\":14}',NULL,NULL,'2026-05-19 07:35:04.790'),
('cmpcbikih00ant82vu5it0kd1','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-15',NULL,'{\"i\":15}',NULL,NULL,'2026-05-19 07:35:04.793'),
('cmpcbikin00apt82v5ni4q1pj','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-16',NULL,'{\"i\":16}',NULL,NULL,'2026-05-19 07:35:04.799'),
('cmpcbikir00art82vdxuc1v0u','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-17',NULL,'{\"i\":17}',NULL,NULL,'2026-05-19 07:35:04.803'),
('cmpcbikiv00att82viqgwwopm','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-18',NULL,'{\"i\":18}',NULL,NULL,'2026-05-19 07:35:04.808'),
('cmpcbikj000avt82vxuxhs5sp','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-19',NULL,'{\"i\":19}',NULL,NULL,'2026-05-19 07:35:04.812'),
('cmpcbikj400axt82vn8ivoqre','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-20',NULL,'{\"i\":20}',NULL,NULL,'2026-05-19 07:35:04.816'),
('cmpcbikj900azt82v5kvir2an','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-21',NULL,'{\"i\":21}',NULL,NULL,'2026-05-19 07:35:04.821'),
('cmpcbikjd00b1t82v0juyh8xd','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-22',NULL,'{\"i\":22}',NULL,NULL,'2026-05-19 07:35:04.825'),
('cmpcbikjg00b3t82vok10nr68','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-23',NULL,'{\"i\":23}',NULL,NULL,'2026-05-19 07:35:04.828'),
('cmpcbikjk00b5t82vy20qlv50','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-24',NULL,'{\"i\":24}',NULL,NULL,'2026-05-19 07:35:04.832'),
('cmpcbikjn00b7t82vdzs8wgcs','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-25',NULL,'{\"i\":25}',NULL,NULL,'2026-05-19 07:35:04.836'),
('cmpcbikjs00b9t82v58svwruq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-26',NULL,'{\"i\":26}',NULL,NULL,'2026-05-19 07:35:04.840'),
('cmpcbikjv00bbt82v40vhje5a','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-27',NULL,'{\"i\":27}',NULL,NULL,'2026-05-19 07:35:04.844'),
('cmpcbikjz00bdt82vvm6ryvxu','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-28',NULL,'{\"i\":28}',NULL,NULL,'2026-05-19 07:35:04.847'),
('cmpcbikk300bft82v8mthxl1p','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-29',NULL,'{\"i\":29}',NULL,NULL,'2026-05-19 07:35:04.851'),
('cmpcbikk700bht82vf66hqxum','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-30',NULL,'{\"i\":30}',NULL,NULL,'2026-05-19 07:35:04.855'),
('cmpcbikkb00bjt82vzckd0a9x','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-31',NULL,'{\"i\":31}',NULL,NULL,'2026-05-19 07:35:04.860'),
('cmpcbikke00blt82vqnkeb0ew','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-32',NULL,'{\"i\":32}',NULL,NULL,'2026-05-19 07:35:04.863'),
('cmpcbikki00bnt82vm0qf769n','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-33',NULL,'{\"i\":33}',NULL,NULL,'2026-05-19 07:35:04.867'),
('cmpcbikkl00bpt82vpc2y4l62','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-34',NULL,'{\"i\":34}',NULL,NULL,'2026-05-19 07:35:04.870'),
('cmpcbikkp00brt82vprc3wd2g','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-35',NULL,'{\"i\":35}',NULL,NULL,'2026-05-19 07:35:04.873'),
('cmpcbikku00btt82vxuh9ccyt','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-36',NULL,'{\"i\":36}',NULL,NULL,'2026-05-19 07:35:04.878'),
('cmpcbikky00bvt82v874kqype','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-37',NULL,'{\"i\":37}',NULL,NULL,'2026-05-19 07:35:04.883'),
('cmpcbikl400bxt82vcbjfphq2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-38',NULL,'{\"i\":38}',NULL,NULL,'2026-05-19 07:35:04.888'),
('cmpcbikl700bzt82v0bgmqkd5','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-39',NULL,'{\"i\":39}',NULL,NULL,'2026-05-19 07:35:04.892'),
('cmpcbiklc00c1t82vk51egnn4','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-40',NULL,'{\"i\":40}',NULL,NULL,'2026-05-19 07:35:04.896'),
('cmpcbiklf00c3t82vuy29scnb','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-41',NULL,'{\"i\":41}',NULL,NULL,'2026-05-19 07:35:04.899'),
('cmpcbiklk00c5t82v8ghvxtvk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-42',NULL,'{\"i\":42}',NULL,NULL,'2026-05-19 07:35:04.904'),
('cmpcbiklp00c7t82vp5aw6o62','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-43',NULL,'{\"i\":43}',NULL,NULL,'2026-05-19 07:35:04.909'),
('cmpcbiklr00c9t82vokp1t7jq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-44',NULL,'{\"i\":44}',NULL,NULL,'2026-05-19 07:35:04.912'),
('cmpcbiklw00cbt82v84aipjp0','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-45',NULL,'{\"i\":45}',NULL,NULL,'2026-05-19 07:35:04.916'),
('cmpcbikm000cdt82vjqt7vw9a','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-46',NULL,'{\"i\":46}',NULL,NULL,'2026-05-19 07:35:04.920'),
('cmpcbikm500cft82vtqijwrab','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-47',NULL,'{\"i\":47}',NULL,NULL,'2026-05-19 07:35:04.925'),
('cmpcbikm900cht82vb4k5q2u0','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-48',NULL,'{\"i\":48}',NULL,NULL,'2026-05-19 07:35:04.930'),
('cmpcbikmd00cjt82vfxaj2ru0','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-49',NULL,'{\"i\":49}',NULL,NULL,'2026-05-19 07:35:04.933'),
('cmpcbikmi00clt82v4tjsxmzt','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-50',NULL,'{\"i\":50}',NULL,NULL,'2026-05-19 07:35:04.938'),
('cmpcbikmm00cnt82v4fjr0jr8','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-51',NULL,'{\"i\":51}',NULL,NULL,'2026-05-19 07:35:04.942'),
('cmpcbikmp00cpt82vkj5830k7','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-52',NULL,'{\"i\":52}',NULL,NULL,'2026-05-19 07:35:04.945'),
('cmpcbikmt00crt82v83w5a6rr','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-53',NULL,'{\"i\":53}',NULL,NULL,'2026-05-19 07:35:04.949'),
('cmpcbikmx00ctt82vvw5nqhl7','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-54',NULL,'{\"i\":54}',NULL,NULL,'2026-05-19 07:35:04.953'),
('cmpcbikn000cvt82v6y6pc4hq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-55',NULL,'{\"i\":55}',NULL,NULL,'2026-05-19 07:35:04.956'),
('cmpcbikn500cxt82v94sueb3k','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-56',NULL,'{\"i\":56}',NULL,NULL,'2026-05-19 07:35:04.961'),
('cmpcbikn800czt82vtk5nai87','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-57',NULL,'{\"i\":57}',NULL,NULL,'2026-05-19 07:35:04.964'),
('cmpcbiknb00d1t82v2qqejsa9','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-58',NULL,'{\"i\":58}',NULL,NULL,'2026-05-19 07:35:04.967'),
('cmpcbikng00d3t82v5k1jdr1z','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-59',NULL,'{\"i\":59}',NULL,NULL,'2026-05-19 07:35:04.973'),
('cmpcbiknj00d5t82vo1tlscf2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-60',NULL,'{\"i\":60}',NULL,NULL,'2026-05-19 07:35:04.976'),
('cmpcbikno00d7t82v09f2087k','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-61',NULL,'{\"i\":61}',NULL,NULL,'2026-05-19 07:35:04.980'),
('cmpcbikns00d9t82vlbp1sgju','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-62',NULL,'{\"i\":62}',NULL,NULL,'2026-05-19 07:35:04.984'),
('cmpcbiknx00dbt82vphzk99t2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-63',NULL,'{\"i\":63}',NULL,NULL,'2026-05-19 07:35:04.989'),
('cmpcbiko100ddt82vihy1svyk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-64',NULL,'{\"i\":64}',NULL,NULL,'2026-05-19 07:35:04.994'),
('cmpcbiko600dft82vdrhqvg7t','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-65',NULL,'{\"i\":65}',NULL,NULL,'2026-05-19 07:35:04.998'),
('cmpcbikoc00dht82vhjvqfcnk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-66',NULL,'{\"i\":66}',NULL,NULL,'2026-05-19 07:35:05.004'),
('cmpcbikog00djt82v4ueud987','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-67',NULL,'{\"i\":67}',NULL,NULL,'2026-05-19 07:35:05.008'),
('cmpcbikoj00dlt82vsds76gy6','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-68',NULL,'{\"i\":68}',NULL,NULL,'2026-05-19 07:35:05.012'),
('cmpcbikoo00dnt82vx5qywgty','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-69',NULL,'{\"i\":69}',NULL,NULL,'2026-05-19 07:35:05.016'),
('cmpcbikor00dpt82vhwjv0zh2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-70',NULL,'{\"i\":70}',NULL,NULL,'2026-05-19 07:35:05.020'),
('cmpcbikou00drt82vq60orb5o','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-71',NULL,'{\"i\":71}',NULL,NULL,'2026-05-19 07:35:05.022'),
('cmpcbikoz00dtt82vbule1tkj','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-72',NULL,'{\"i\":72}',NULL,NULL,'2026-05-19 07:35:05.027'),
('cmpcbikp300dvt82vkd1abfqt','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-73',NULL,'{\"i\":73}',NULL,NULL,'2026-05-19 07:35:05.031'),
('cmpcbikp600dxt82vyi4pkta1','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-74',NULL,'{\"i\":74}',NULL,NULL,'2026-05-19 07:35:05.035'),
('cmpcbikpc00dzt82v7zh614gj','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-75',NULL,'{\"i\":75}',NULL,NULL,'2026-05-19 07:35:05.040'),
('cmpcbikpg00e1t82vms5pylqk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-76',NULL,'{\"i\":76}',NULL,NULL,'2026-05-19 07:35:05.044'),
('cmpcbikpi00e3t82vjkcw2z54','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-77',NULL,'{\"i\":77}',NULL,NULL,'2026-05-19 07:35:05.046'),
('cmpcbikpl00e5t82vml4br8pt','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-78',NULL,'{\"i\":78}',NULL,NULL,'2026-05-19 07:35:05.050'),
('cmpcbikpo00e7t82v6x446uee','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-79',NULL,'{\"i\":79}',NULL,NULL,'2026-05-19 07:35:05.053'),
('cmpcbikpr00e9t82vxz04k1sx','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-80',NULL,'{\"i\":80}',NULL,NULL,'2026-05-19 07:35:05.056'),
('cmpcbikpt00ebt82vejccq1b9','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-81',NULL,'{\"i\":81}',NULL,NULL,'2026-05-19 07:35:05.058'),
('cmpcbikpx00edt82vkhadu3td','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-82',NULL,'{\"i\":82}',NULL,NULL,'2026-05-19 07:35:05.061'),
('cmpcbikpz00eft82vsec7yrkn','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-83',NULL,'{\"i\":83}',NULL,NULL,'2026-05-19 07:35:05.063'),
('cmpcbikq200eht82v1jnfnccw','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-84',NULL,'{\"i\":84}',NULL,NULL,'2026-05-19 07:35:05.066'),
('cmpcbikq500ejt82vxmbv9igh','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-85',NULL,'{\"i\":85}',NULL,NULL,'2026-05-19 07:35:05.070'),
('cmpcbikq800elt82v47nu0qq4','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-86',NULL,'{\"i\":86}',NULL,NULL,'2026-05-19 07:35:05.073'),
('cmpcbikqa00ent82vw717mxcb','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-87',NULL,'{\"i\":87}',NULL,NULL,'2026-05-19 07:35:05.075'),
('cmpcbikqd00ept82vmveunx8m','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-88',NULL,'{\"i\":88}',NULL,NULL,'2026-05-19 07:35:05.077'),
('cmpcbikqf00ert82vtrv9daht','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-89',NULL,'{\"i\":89}',NULL,NULL,'2026-05-19 07:35:05.080'),
('cmpcbikqi00ett82v9bj6yacq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-90',NULL,'{\"i\":90}',NULL,NULL,'2026-05-19 07:35:05.082'),
('cmpcbikql00evt82v8mwy4dbu','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-91',NULL,'{\"i\":91}',NULL,NULL,'2026-05-19 07:35:05.085'),
('cmpcbikqn00ext82vtr2z0w4b','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-92',NULL,'{\"i\":92}',NULL,NULL,'2026-05-19 07:35:05.088'),
('cmpcbikqq00ezt82vqdpwdhvx','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-93',NULL,'{\"i\":93}',NULL,NULL,'2026-05-19 07:35:05.091'),
('cmpcbikqt00f1t82v7rv79jeb','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-94',NULL,'{\"i\":94}',NULL,NULL,'2026-05-19 07:35:05.093'),
('cmpcbikqw00f3t82vpiybvhvg','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-95',NULL,'{\"i\":95}',NULL,NULL,'2026-05-19 07:35:05.096'),
('cmpcbikqy00f5t82vz6agayyc','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-96',NULL,'{\"i\":96}',NULL,NULL,'2026-05-19 07:35:05.099'),
('cmpcbikr100f7t82vrcjgu1f2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-97',NULL,'{\"i\":97}',NULL,NULL,'2026-05-19 07:35:05.101'),
('cmpcbikr500f9t82vyepmdwu9','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-98',NULL,'{\"i\":98}',NULL,NULL,'2026-05-19 07:35:05.105'),
('cmpcbikr800fbt82v4pi4suai','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-99',NULL,'{\"i\":99}',NULL,NULL,'2026-05-19 07:35:05.108'),
('cmpcbikrb00fdt82v4ioqawp2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-100',NULL,'{\"i\":100}',NULL,NULL,'2026-05-19 07:35:05.111'),
('cmpcbikrd00fft82vqtbj3kjq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-101',NULL,'{\"i\":101}',NULL,NULL,'2026-05-19 07:35:05.113'),
('cmpcbikrg00fht82v8reoyh9i','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-102',NULL,'{\"i\":102}',NULL,NULL,'2026-05-19 07:35:05.116'),
('cmpcbikri00fjt82vp2dzjwvh','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-103',NULL,'{\"i\":103}',NULL,NULL,'2026-05-19 07:35:05.119'),
('cmpcbikrl00flt82vf53od7w8','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','browser_qa','test','BROWSER-QA-104',NULL,'{\"i\":104}',NULL,NULL,'2026-05-19 07:35:05.121'),
('cmpcrtyl00001sz6yy6t600zr','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-19 15:11:50.099'),
('cmpcryci5000csz6yfnag4aj3','cmp1cxexi0000m5lsfbfigi9x','cmp9jbz8s00011i4ukf18ij2x','create','collection','cmpcrycaf0006sz6yzh8gsunh',NULL,'{\"customer\":\"Browser QA Customer 1\",\"loanCode\":\"BROWSER-QA-LOAN-1779176104324-0\",\"delta\":300,\"totalReceived\":300,\"paymentMode\":\"cash\",\"allocation\":\"Direct payment for instalment #7 (+₹300)\"}',NULL,NULL,'2026-05-19 15:15:14.765'),
('cmpcsb68d000ysz6yuji0k08n','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','auth','cmp1cxf590004m5lsp05yll1b',NULL,'{\"username\":\"admin\",\"role\":\"admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-19 15:25:13.165'),
('cmpcsbhs80010sz6yjwdrpanv','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','user','cmp9kz3ro000d1i4u4x0gqyop',NULL,'{\"name\":\"new\",\"username\":\"new\",\"status\":\"inactive\",\"role\":\"agent\",\"appType\":\"microlending\"}',NULL,NULL,'2026-05-19 15:25:28.137'),
('cmpcsbyb10014sz6yt5bo2r5i','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','auth','cmp1cxf590004m5lsp05yll1b',NULL,'{\"username\":\"admin\",\"role\":\"admin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-19 15:25:49.549'),
('cmpcsc6eo0016sz6ygnhbgaxp','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','user','cmp9kz3ro000d1i4u4x0gqyop',NULL,'{\"name\":\"new\",\"username\":\"new\",\"status\":\"active\",\"role\":\"agent\",\"appType\":\"microlending\"}',NULL,NULL,'2026-05-19 15:26:00.048'),
('cmpcscbt0001asz6yywlzyf7h','cmp1cxexi0000m5lsfbfigi9x','cmp9kz3ro000d1i4u4x0gqyop','login','auth','cmp9kz3ro000d1i4u4x0gqyop',NULL,'{\"username\":\"new\",\"role\":\"agent\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-19 15:26:07.045'),
('cmpcsd37p001csz6y5ypddn5o','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','auth','cmp1cxfp20008m5lsqle1q8u1',NULL,'{\"username\":\"developer\",\"role\":\"developer\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36','2026-05-19 15:26:42.566'),
('cmpcsx7wy001esz6y7yzu2nri','cmp1cxexi0000m5lsfbfigi9x','cmp9dwygs00017bb7ekcb8a3i','login','auth','cmp9dwygs00017bb7ekcb8a3i',NULL,'{\"username\":\"superadmin\",\"role\":\"superadmin\"}','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-05-19 15:42:21.778');
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
('cmp1cxext0002m5ls50zh8t71','cmp1cxexi0000m5lsfbfigi9x','Erode','HQ','Main Branch','','active','2026-05-11 15:29:09.090','2026-05-19 07:35:04.123','cmp9dwygs00017bb7ekcb8a3i','[\"microlending\",\"autofinance\",\"chitfunds\"]',NULL);
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
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
('cmpcrycaf0006sz6yzh8gsunh','a9374b79-ffe4-42a6-965e-dcc98a6e0e7c','cmpcbik0o0007t82v3gp02jo2','cmpcbik5h003jt82vnkpz5yox',300.00,300.00,'cash','Direct payment for instalment #7 (+₹300)','cmp9jbz8s00011i4ukf18ij2x','2026-05-19 15:15:14.487',1,'cmp1cxexi0000m5lsfbfigi9x','pending','cmp1cxexi0000m5lsfbfigi9x:cmp9jbz8s00011i4ukf18ij2x:cmpcbik64003xt82vdqtbi6kw:300.00:cash:2026-05-19');
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
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES
('cmpcbik0o0007t82v3gp02jo2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104151-1','Browser QA Customer 1','7710415101','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.152','2026-05-19 07:35:04.152',NULL,NULL),
('cmpcbik0s0009t82vpm1wxqda','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104155-2','Browser QA Customer 2','7710415502','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.157','2026-05-19 07:35:04.157',NULL,NULL),
('cmpcbik0v000bt82vz1mb1kju','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104159-3','Browser QA Customer 3','7710415903','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.160','2026-05-19 07:35:04.160',NULL,NULL),
('cmpcbik0z000dt82vyi2jarnj','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104162-4','Browser QA Customer 4','7710416204','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.163','2026-05-19 07:35:04.163',NULL,NULL),
('cmpcbik12000ft82v9fta8egz','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104166-5','Browser QA Customer 5','7710416605','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.167','2026-05-19 07:35:04.167',NULL,NULL),
('cmpcbik16000ht82vwvmx6eyk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104169-6','Browser QA Customer 6','7710416906','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.170','2026-05-19 07:35:04.170',NULL,NULL),
('cmpcbik19000jt82v0k0n8eq6','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104172-7','Browser QA Customer 7','7710417207','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.173','2026-05-19 07:35:04.173',NULL,NULL),
('cmpcbik1c000lt82v2rgmyvsk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104176-8','Browser QA Customer 8','7710417608','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.177','2026-05-19 07:35:04.177',NULL,NULL),
('cmpcbik1f000nt82vr6zx8biz','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104179-9','Browser QA Customer 9','7710417909','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.180','2026-05-19 07:35:04.180',NULL,NULL),
('cmpcbik1i000pt82vvewdv9c2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104182-10','Browser QA Customer 10','7710418210','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.183','2026-05-19 07:35:04.183',NULL,NULL),
('cmpcbik1l000rt82vs87nen5w','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104184-11','Browser QA Customer 11','7710418411','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.185','2026-05-19 07:35:04.185',NULL,NULL),
('cmpcbik1n000tt82vitn0a8kx','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104187-12','Browser QA Customer 12','7710418712','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.188','2026-05-19 07:35:04.188',NULL,NULL),
('cmpcbik1p000vt82v5f9f2gjb','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104189-13','Browser QA Customer 13','7710418913','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.189','2026-05-19 07:35:04.189',NULL,NULL),
('cmpcbik1r000xt82vmx7seu9e','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104191-14','Browser QA Customer 14','7710419114','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.191','2026-05-19 07:35:04.191',NULL,NULL),
('cmpcbik1u000zt82v67eumk66','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104194-15','Browser QA Customer 15','7710419415','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.195','2026-05-19 07:35:04.195',NULL,NULL),
('cmpcbik1w0011t82v3nkb4yjt','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104196-16','Browser QA Customer 16','7710419616','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.197','2026-05-19 07:35:04.197',NULL,NULL),
('cmpcbik1z0013t82v3njxz22n','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104199-17','Browser QA Customer 17','7710419917','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.200','2026-05-19 07:35:04.200',NULL,NULL),
('cmpcbik220015t82vzvgorix8','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104201-18','Browser QA Customer 18','7710420118','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.202','2026-05-19 07:35:04.202',NULL,NULL),
('cmpcbik240017t82vfazmv08q','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104203-19','Browser QA Customer 19','7710420419','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.204','2026-05-19 07:35:04.204',NULL,NULL),
('cmpcbik270019t82v1eejmi6s','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104206-20','Browser QA Customer 20','7710420620','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.207','2026-05-19 07:35:04.207',NULL,NULL),
('cmpcbik28001bt82vbbau1p8v','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104208-21','Browser QA Customer 21','7710420821','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.209','2026-05-19 07:35:04.209',NULL,NULL),
('cmpcbik2b001dt82vf6rm27xs','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104210-22','Browser QA Customer 22','7710421022','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.211','2026-05-19 07:35:04.211',NULL,NULL),
('cmpcbik2d001ft82vrps2f3r5','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104213-23','Browser QA Customer 23','7710421323','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.214','2026-05-19 07:35:04.214',NULL,NULL),
('cmpcbik2f001ht82v83ljq3hv','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104215-24','Browser QA Customer 24','7710421524','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.216','2026-05-19 07:35:04.216',NULL,NULL),
('cmpcbik2i001jt82vkjy0weas','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104217-25','Browser QA Customer 25','7710421725','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.218','2026-05-19 07:35:04.218',NULL,NULL),
('cmpcbik2k001lt82v9i9qmk48','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104219-26','Browser QA Customer 26','7710421926','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.220','2026-05-19 07:35:04.220',NULL,NULL),
('cmpcbik2n001nt82vqp27tapn','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104222-27','Browser QA Customer 27','7710422227','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.223','2026-05-19 07:35:04.223',NULL,NULL),
('cmpcbik2q001pt82vocslhsnf','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104226-28','Browser QA Customer 28','7710422628','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.227','2026-05-19 07:35:04.227',NULL,NULL),
('cmpcbik2t001rt82vg3b47rt5','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104228-29','Browser QA Customer 29','7710422829','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.229','2026-05-19 07:35:04.229',NULL,NULL),
('cmpcbik2w001tt82vemmw4ptp','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104232-30','Browser QA Customer 30','7710423230','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.232','2026-05-19 07:35:04.232',NULL,NULL),
('cmpcbik2z001vt82v1p8zz27i','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104234-31','Browser QA Customer 31','7710423431','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.235','2026-05-19 07:35:04.235',NULL,NULL),
('cmpcbik33001xt82vb21i4d2n','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104238-32','Browser QA Customer 32','7710423832','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.239','2026-05-19 07:35:04.239',NULL,NULL),
('cmpcbik36001zt82vop69nluq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104241-33','Browser QA Customer 33','7710424133','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.242','2026-05-19 07:35:04.242',NULL,NULL),
('cmpcbik390021t82vw97s0yoc','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104244-34','Browser QA Customer 34','7710424434','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.245','2026-05-19 07:35:04.245',NULL,NULL),
('cmpcbik3c0023t82v2xtgpizr','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104247-35','Browser QA Customer 35','7710424735','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.248','2026-05-19 07:35:04.248',NULL,NULL),
('cmpcbik3e0025t82vmuafujkc','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104250-36','Browser QA Customer 36','7710425036','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.250','2026-05-19 07:35:04.250',NULL,NULL),
('cmpcbik3g0027t82vx5q482e2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104252-37','Browser QA Customer 37','7710425237','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.253','2026-05-19 07:35:04.253',NULL,NULL),
('cmpcbik3k0029t82vl6b3kfjx','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104255-38','Browser QA Customer 38','7710425538','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.256','2026-05-19 07:35:04.256',NULL,NULL),
('cmpcbik3n002bt82vy1u8mu5s','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104258-39','Browser QA Customer 39','7710425839','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.259','2026-05-19 07:35:04.259',NULL,NULL),
('cmpcbik3q002dt82vcfzfneef','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104262-40','Browser QA Customer 40','7710426240','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.263','2026-05-19 07:35:04.263',NULL,NULL),
('cmpcbik3t002ft82vxux27d1m','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104264-41','Browser QA Customer 41','7710426441','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.265','2026-05-19 07:35:04.265',NULL,NULL),
('cmpcbik3w002ht82vbemvw4ne','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104267-42','Browser QA Customer 42','7710426742','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.268','2026-05-19 07:35:04.268',NULL,NULL),
('cmpcbik3y002jt82vr149pjgi','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104269-43','Browser QA Customer 43','7710426943','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.270','2026-05-19 07:35:04.270',NULL,NULL),
('cmpcbik41002lt82vqxc0vm80','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104272-44','Browser QA Customer 44','7710427244','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.273','2026-05-19 07:35:04.273',NULL,NULL),
('cmpcbik43002nt82vzsavtm94','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104274-45','Browser QA Customer 45','7710427445','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.275','2026-05-19 07:35:04.275',NULL,NULL),
('cmpcbik45002pt82vytajdwin','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104277-46','Browser QA Customer 46','7710427746','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.278','2026-05-19 07:35:04.278',NULL,NULL),
('cmpcbik48002rt82vmxbdl7ui','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104280-47','Browser QA Customer 47','7710428047','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.281','2026-05-19 07:35:04.281',NULL,NULL),
('cmpcbik4c002tt82vja4osj40','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104283-48','Browser QA Customer 48','7710428348','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.285','2026-05-19 07:35:04.285',NULL,NULL),
('cmpcbik4f002vt82vkwlf10ys','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104287-49','Browser QA Customer 49','7710428749','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.287','2026-05-19 07:35:04.287',NULL,NULL),
('cmpcbik4i002xt82vssrh1qbr','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104289-50','Browser QA Customer 50','7710428950','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.290','2026-05-19 07:35:04.290',NULL,NULL),
('cmpcbik4k002zt82vmd2yj0e9','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104292-51','Browser QA Customer 51','7710429251','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.292','2026-05-19 07:35:04.292',NULL,NULL),
('cmpcbik4m0031t82vgurgsd69','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104294-52','Browser QA Customer 52','7710429452','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.295','2026-05-19 07:35:04.295',NULL,NULL),
('cmpcbik4p0033t82v866gepj9','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104297-53','Browser QA Customer 53','7710429753','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.298','2026-05-19 07:35:04.298',NULL,NULL),
('cmpcbik4r0035t82vryp5t0z9','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104299-54','Browser QA Customer 54','7710429954','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.299','2026-05-19 07:35:04.299',NULL,NULL),
('cmpcbik4w0037t82vyybogy5f','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104303-55','Browser QA Customer 55','7710430355','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.304','2026-05-19 07:35:04.304',NULL,NULL),
('cmpcbik4z0039t82vsxqqxvo6','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104307-56','Browser QA Customer 56','7710430756','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.307','2026-05-19 07:35:04.307',NULL,NULL),
('cmpcbik52003bt82vzhoihiy4','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104309-57','Browser QA Customer 57','7710430957','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.310','2026-05-19 07:35:04.310',NULL,NULL),
('cmpcbik54003dt82vfptm1532','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104312-58','Browser QA Customer 58','7710431258','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.313','2026-05-19 07:35:04.313',NULL,NULL),
('cmpcbik5a003ft82vt19qrlk5','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104318-59','Browser QA Customer 59','7710431859','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.319','2026-05-19 07:35:04.319',NULL,NULL),
('cmpcbik5d003ht82vji5eky96','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-1779176104321-60','Browser QA Customer 60','7710432160','QA address',NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-19 07:35:04.322','2026-05-19 07:35:04.322',NULL,NULL),
('cmpcbikgs009pt82v9tg5w9z2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-PENDING-1779176104731','Browser QA Pending Customer','7876104731',NULL,NULL,'cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh','pending',NULL,NULL,'pending_review',NULL,'microlending','2026-05-19 07:35:04.732','2026-05-19 07:35:04.732',NULL,NULL);
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
('a9374b79-ffe4-42a6-965e-dcc98a6e0e7c','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','cmp9jbz8s00011i4ukf18ij2x','cmpcbik080003t82vpd19crpq','2026-05-19',300.00,300.00,1,'microlending','open',NULL,'2026-05-19 20:45:14.000','2026-05-19 15:15:14.734'),
('cmpcbikgl009nt82v57k25elq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','cmp1cxf590004m5lsp05yll1b','cmpcbik080003t82vpd19crpq','2026-05-18',3000.00,0.00,0,'microlending','open',NULL,'2026-05-19 07:35:04.725','2026-05-19 07:35:04.725');
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
/*!40000 ALTER TABLE `instalments` DISABLE KEYS */;
INSERT INTO `instalments` VALUES
('cmpcbik5m003lt82vrelrto54','cmpcbik5h003jt82vnkpz5yox',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.331','2026-05-19 15:15:14.534'),
('cmpcbik5r003nt82vzuuam6ew','cmpcbik5h003jt82vnkpz5yox',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.336','2026-05-19 15:15:14.546'),
('cmpcbik5u003pt82v8d143txc','cmpcbik5h003jt82vnkpz5yox',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.338','2026-05-19 15:15:14.557'),
('cmpcbik5x003rt82vc7pua63j','cmpcbik5h003jt82vnkpz5yox',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.341','2026-05-19 15:15:14.563'),
('cmpcbik5z003tt82v6ucryb5f','cmpcbik5h003jt82vnkpz5yox',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.343','2026-05-19 15:15:14.568'),
('cmpcbik62003vt82vyuo3mn6h','cmpcbik5h003jt82vnkpz5yox',6,'2026-05-18',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.346','2026-05-19 15:15:14.579'),
('cmpcbik64003xt82vdqtbi6kw','cmpcbik5h003jt82vnkpz5yox',7,'2026-05-19',300.00,300.00,NULL,'paid','2026-05-19 15:15:14.506','cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.348','2026-05-19 15:15:14.591'),
('cmpcbik67003zt82vhcr1jkdn','cmpcbik5h003jt82vnkpz5yox',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.352','2026-05-19 15:15:14.611'),
('cmpcbik690041t82vxqvmsiuz','cmpcbik5h003jt82vnkpz5yox',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.354','2026-05-19 15:15:14.624'),
('cmpcbik6b0043t82vsm53l0pr','cmpcbik5h003jt82vnkpz5yox',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.356','2026-05-19 15:15:14.646'),
('cmpcbik6h0047t82vwd99baqw','cmpcbik6e0045t82v5cj626m8',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.361','2026-05-19 07:35:04.361'),
('cmpcbik6l0049t82vpfm2oc9s','cmpcbik6e0045t82v5cj626m8',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.365','2026-05-19 07:35:04.365'),
('cmpcbik6n004bt82vsgqbcdrf','cmpcbik6e0045t82v5cj626m8',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.367','2026-05-19 07:35:04.367'),
('cmpcbik6r004dt82v0t9m3sf3','cmpcbik6e0045t82v5cj626m8',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.372','2026-05-19 07:35:04.372'),
('cmpcbik6u004ft82vaptzgefi','cmpcbik6e0045t82v5cj626m8',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.374','2026-05-19 07:35:04.374'),
('cmpcbik6y004ht82vfc9a3z7t','cmpcbik6e0045t82v5cj626m8',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.378','2026-05-19 07:35:04.378'),
('cmpcbik72004jt82vneh9sxui','cmpcbik6e0045t82v5cj626m8',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.383','2026-05-19 07:35:04.383'),
('cmpcbik78004lt82vhakg20lt','cmpcbik6e0045t82v5cj626m8',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.388','2026-05-19 07:35:04.388'),
('cmpcbik7d004nt82vu3c56zf0','cmpcbik6e0045t82v5cj626m8',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.393','2026-05-19 07:35:04.393'),
('cmpcbik7j004pt82vjekfrbls','cmpcbik6e0045t82v5cj626m8',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.399','2026-05-19 07:35:04.399'),
('cmpcbik7t004tt82vpw7hzoqb','cmpcbik7o004rt82vqcwnvkf8',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.409','2026-05-19 07:35:04.409'),
('cmpcbik7y004vt82v9l887q7w','cmpcbik7o004rt82vqcwnvkf8',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.414','2026-05-19 07:35:04.414'),
('cmpcbik81004xt82vqk4f935q','cmpcbik7o004rt82vqcwnvkf8',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.418','2026-05-19 07:35:04.418'),
('cmpcbik86004zt82ven2rw1am','cmpcbik7o004rt82vqcwnvkf8',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.423','2026-05-19 07:35:04.423'),
('cmpcbik8a0051t82vd1o2r02s','cmpcbik7o004rt82vqcwnvkf8',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.426','2026-05-19 07:35:04.426'),
('cmpcbik8e0053t82vrd8gybd7','cmpcbik7o004rt82vqcwnvkf8',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.431','2026-05-19 07:35:04.431'),
('cmpcbik8i0055t82v7szx2hii','cmpcbik7o004rt82vqcwnvkf8',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.435','2026-05-19 07:35:04.435'),
('cmpcbik8n0057t82vgaqsfik7','cmpcbik7o004rt82vqcwnvkf8',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.439','2026-05-19 07:35:04.439'),
('cmpcbik8r0059t82vlduiyeuy','cmpcbik7o004rt82vqcwnvkf8',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.443','2026-05-19 07:35:04.443'),
('cmpcbik8v005bt82vmlx4qjej','cmpcbik7o004rt82vqcwnvkf8',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.448','2026-05-19 07:35:04.448'),
('cmpcbik95005ft82vxji062pv','cmpcbik8z005dt82vg4j3ba1z',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.457','2026-05-19 07:35:04.457'),
('cmpcbik99005ht82vaxizni2b','cmpcbik8z005dt82vg4j3ba1z',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.461','2026-05-19 07:35:04.461'),
('cmpcbik9d005jt82v9w0nhfwj','cmpcbik8z005dt82vg4j3ba1z',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.465','2026-05-19 07:35:04.465'),
('cmpcbik9i005lt82vkki6haq1','cmpcbik8z005dt82vg4j3ba1z',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.470','2026-05-19 07:35:04.470'),
('cmpcbik9l005nt82vwncq3e6m','cmpcbik8z005dt82vg4j3ba1z',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.473','2026-05-19 07:35:04.473'),
('cmpcbik9p005pt82vd8zo9da4','cmpcbik8z005dt82vg4j3ba1z',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.478','2026-05-19 07:35:04.478'),
('cmpcbik9t005rt82vgl417b4j','cmpcbik8z005dt82vg4j3ba1z',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.481','2026-05-19 07:35:04.481'),
('cmpcbik9y005tt82v5srqk48j','cmpcbik8z005dt82vg4j3ba1z',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.486','2026-05-19 07:35:04.486'),
('cmpcbika1005vt82vnbs2p5te','cmpcbik8z005dt82vg4j3ba1z',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.490','2026-05-19 07:35:04.490'),
('cmpcbika7005xt82vkgw9b46t','cmpcbik8z005dt82vg4j3ba1z',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.495','2026-05-19 07:35:04.495'),
('cmpcbikaf0061t82vntvy7n2a','cmpcbikaa005zt82va5k4tzdc',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.504','2026-05-19 07:35:04.504'),
('cmpcbikak0063t82vasjl903q','cmpcbikaa005zt82va5k4tzdc',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.508','2026-05-19 07:35:04.508'),
('cmpcbikan0065t82vpm4c955n','cmpcbikaa005zt82va5k4tzdc',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.512','2026-05-19 07:35:04.512'),
('cmpcbikas0067t82v6cpckfuq','cmpcbikaa005zt82va5k4tzdc',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.516','2026-05-19 07:35:04.516'),
('cmpcbikav0069t82vqnf7vlsc','cmpcbikaa005zt82va5k4tzdc',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.519','2026-05-19 07:35:04.519'),
('cmpcbikb0006bt82vitvdgnuz','cmpcbikaa005zt82va5k4tzdc',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.524','2026-05-19 07:35:04.524'),
('cmpcbikb3006dt82vq8aa1pw7','cmpcbikaa005zt82va5k4tzdc',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.528','2026-05-19 07:35:04.528'),
('cmpcbikb7006ft82vwnsoydot','cmpcbikaa005zt82va5k4tzdc',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.532','2026-05-19 07:35:04.532'),
('cmpcbikba006ht82vcq2pjts2','cmpcbikaa005zt82va5k4tzdc',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.535','2026-05-19 07:35:04.535'),
('cmpcbikbf006jt82vpkyex7sa','cmpcbikaa005zt82va5k4tzdc',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.539','2026-05-19 07:35:04.539'),
('cmpcbikbq006nt82vjtjxldff','cmpcbikbj006lt82vl5wrq8ky',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.550','2026-05-19 07:35:04.550'),
('cmpcbikbt006pt82vx1xp1hdr','cmpcbikbj006lt82vl5wrq8ky',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.553','2026-05-19 07:35:04.553'),
('cmpcbikbx006rt82vyb6ffve3','cmpcbikbj006lt82vl5wrq8ky',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.557','2026-05-19 07:35:04.557'),
('cmpcbikc0006tt82vokzvirq4','cmpcbikbj006lt82vl5wrq8ky',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.560','2026-05-19 07:35:04.560'),
('cmpcbikc5006vt82v02qkq4lc','cmpcbikbj006lt82vl5wrq8ky',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.565','2026-05-19 07:35:04.565'),
('cmpcbikc8006xt82vwzkc8ktx','cmpcbikbj006lt82vl5wrq8ky',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.568','2026-05-19 07:35:04.568'),
('cmpcbikcc006zt82vqg99dlpk','cmpcbikbj006lt82vl5wrq8ky',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.572','2026-05-19 07:35:04.572'),
('cmpcbikcg0071t82v96vj14wz','cmpcbikbj006lt82vl5wrq8ky',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.576','2026-05-19 07:35:04.576'),
('cmpcbikcj0073t82v7u3l5yzv','cmpcbikbj006lt82vl5wrq8ky',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.579','2026-05-19 07:35:04.579'),
('cmpcbikco0075t82vwxiaay2u','cmpcbikbj006lt82vl5wrq8ky',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.584','2026-05-19 07:35:04.584'),
('cmpcbikct0079t82vkup3228c','cmpcbikcr0077t82vfz4gwacp',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.590','2026-05-19 07:35:04.590'),
('cmpcbikcv007bt82v77mmx5ov','cmpcbikcr0077t82vfz4gwacp',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.591','2026-05-19 07:35:04.591'),
('cmpcbikcy007dt82vv2a6w4aj','cmpcbikcr0077t82vfz4gwacp',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.594','2026-05-19 07:35:04.594'),
('cmpcbikd0007ft82v9rfqfwqb','cmpcbikcr0077t82vfz4gwacp',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.596','2026-05-19 07:35:04.596'),
('cmpcbikd1007ht82vjai85i9q','cmpcbikcr0077t82vfz4gwacp',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.598','2026-05-19 07:35:04.598'),
('cmpcbikd4007jt82vjc4qh5jh','cmpcbikcr0077t82vfz4gwacp',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.600','2026-05-19 07:35:04.600'),
('cmpcbikd6007lt82vmml7on9a','cmpcbikcr0077t82vfz4gwacp',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.602','2026-05-19 07:35:04.602'),
('cmpcbikd8007nt82v7ddvrq2i','cmpcbikcr0077t82vfz4gwacp',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.604','2026-05-19 07:35:04.604'),
('cmpcbikda007pt82vvqeuohhg','cmpcbikcr0077t82vfz4gwacp',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.606','2026-05-19 07:35:04.606'),
('cmpcbikdb007rt82vl3q7ptds','cmpcbikcr0077t82vfz4gwacp',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.608','2026-05-19 07:35:04.608'),
('cmpcbikdg007vt82vs08pviii','cmpcbikdd007tt82v9mzfqd7g',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.612','2026-05-19 07:35:04.612'),
('cmpcbikdi007xt82vklq24tfg','cmpcbikdd007tt82v9mzfqd7g',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.614','2026-05-19 07:35:04.614'),
('cmpcbikdj007zt82vpunv6xq7','cmpcbikdd007tt82v9mzfqd7g',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.616','2026-05-19 07:35:04.616'),
('cmpcbikdm0081t82vuk8gad62','cmpcbikdd007tt82v9mzfqd7g',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.618','2026-05-19 07:35:04.618'),
('cmpcbikdo0083t82vmvga62eu','cmpcbikdd007tt82v9mzfqd7g',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.620','2026-05-19 07:35:04.620'),
('cmpcbikdq0085t82vx2itnuzb','cmpcbikdd007tt82v9mzfqd7g',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.622','2026-05-19 07:35:04.622'),
('cmpcbikds0087t82vb6k849eu','cmpcbikdd007tt82v9mzfqd7g',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.624','2026-05-19 07:35:04.624'),
('cmpcbikdu0089t82vt9s4avga','cmpcbikdd007tt82v9mzfqd7g',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.626','2026-05-19 07:35:04.626'),
('cmpcbikdx008bt82vgzoo39nu','cmpcbikdd007tt82v9mzfqd7g',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.629','2026-05-19 07:35:04.629'),
('cmpcbikdz008dt82vmg3l2248','cmpcbikdd007tt82v9mzfqd7g',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.631','2026-05-19 07:35:04.631'),
('cmpcbike6008ht82vhujnfzr5','cmpcbike2008ft82vyn7m840x',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.638','2026-05-19 07:35:04.638'),
('cmpcbike9008jt82vilueafu6','cmpcbike2008ft82vyn7m840x',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.642','2026-05-19 07:35:04.642'),
('cmpcbikec008lt82v1cazy6e5','cmpcbike2008ft82vyn7m840x',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.645','2026-05-19 07:35:04.645'),
('cmpcbikef008nt82v4sd9mwww','cmpcbike2008ft82vyn7m840x',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.648','2026-05-19 07:35:04.648'),
('cmpcbikel008pt82v7leh5u4z','cmpcbike2008ft82vyn7m840x',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.653','2026-05-19 07:35:04.653'),
('cmpcbikep008rt82vw4pgz0vl','cmpcbike2008ft82vyn7m840x',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.658','2026-05-19 07:35:04.658'),
('cmpcbikev008tt82vjy7jgha4','cmpcbike2008ft82vyn7m840x',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.663','2026-05-19 07:35:04.663'),
('cmpcbikf0008vt82vfldllsk4','cmpcbike2008ft82vyn7m840x',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.668','2026-05-19 07:35:04.668'),
('cmpcbikf4008xt82vugdh5r6m','cmpcbike2008ft82vyn7m840x',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.672','2026-05-19 07:35:04.672'),
('cmpcbikf8008zt82vrm9fa6fp','cmpcbike2008ft82vyn7m840x',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.677','2026-05-19 07:35:04.677'),
('cmpcbikfi0093t82vik9y1xj9','cmpcbikfd0091t82vwnyc4gef',1,'2026-05-13',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.687','2026-05-19 07:35:04.687'),
('cmpcbikfl0095t82vlvntgs1q','cmpcbikfd0091t82vwnyc4gef',2,'2026-05-14',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.690','2026-05-19 07:35:04.690'),
('cmpcbikfp0097t82vy85xedlb','cmpcbikfd0091t82vwnyc4gef',3,'2026-05-15',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.693','2026-05-19 07:35:04.693'),
('cmpcbikft0099t82vd5c522fa','cmpcbikfd0091t82vwnyc4gef',4,'2026-05-16',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.697','2026-05-19 07:35:04.697'),
('cmpcbikfw009bt82vlm2nkv5o','cmpcbikfd0091t82vwnyc4gef',5,'2026-05-17',300.00,0.00,NULL,'missed',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.700','2026-05-19 07:35:04.700'),
('cmpcbikg0009dt82vfhh9916o','cmpcbikfd0091t82vwnyc4gef',6,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.705','2026-05-19 07:35:04.705'),
('cmpcbikg4009ft82vxpzuhyd1','cmpcbikfd0091t82vwnyc4gef',7,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.708','2026-05-19 07:35:04.708'),
('cmpcbikg9009ht82v1mu1i4uz','cmpcbikfd0091t82vwnyc4gef',8,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.713','2026-05-19 07:35:04.713'),
('cmpcbikgc009jt82v7z42sgpk','cmpcbikfd0091t82vwnyc4gef',9,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.717','2026-05-19 07:35:04.717'),
('cmpcbikgh009lt82vjc8e7uzl','cmpcbikfd0091t82vwnyc4gef',10,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,'cmp1cxfck0006m5lsp6xj0azh',NULL,NULL,0,NULL,'2026-05-19 07:35:04.721','2026-05-19 07:35:04.721');
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
('cmp5jnvey003b12atz02nordu','cmp1cxexi0000m5lsfbfigi9x','110-Month Monthly',10000.00,0.00,'monthly',110,91.00,100.00,'microlending','active','2026-05-14 13:48:45.898','2026-05-14 13:48:45.898','fixed');
/*!40000 ALTER TABLE `loan_packages` ENABLE KEYS */;
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
/*!40000 ALTER TABLE `loans` DISABLE KEYS */;
INSERT INTO `loans` VALUES
('cmpcbik5h003jt82vnkpz5yox','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104324-0','cmpcbik0o0007t82v3gp02jo2',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'overdue',1,10,300.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.326','2026-05-19 15:15:14.679','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbik6e0045t82v5cj626m8','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104357-1','cmpcbik0s0009t82vpm1wxqda',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.358','2026-05-19 07:35:04.358','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbik7o004rt82vqcwnvkf8','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104403-2','cmpcbik0v000bt82vz1mb1kju',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.404','2026-05-19 07:35:04.404','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbik8z005dt82vg4j3ba1z','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104450-3','cmpcbik0z000dt82vyi2jarnj',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.451','2026-05-19 07:35:04.451','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbikaa005zt82va5k4tzdc','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104497-4','cmpcbik12000ft82v9fta8egz',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.498','2026-05-19 07:35:04.498','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbikbj006lt82vl5wrq8ky','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104542-5','cmpcbik16000ht82vwvmx6eyk',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.544','2026-05-19 07:35:04.544','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbikcr0077t82vfz4gwacp','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104586-6','cmpcbik19000jt82v0k0n8eq6',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.587','2026-05-19 07:35:04.587','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbikdd007tt82v9mzfqd7g','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104608-7','cmpcbik1c000lt82v2rgmyvsk',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.609','2026-05-19 07:35:04.609','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbike2008ft82vyn7m840x','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104633-8','cmpcbik1f000nt82vr6zx8biz',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.634','2026-05-19 07:35:04.634','fixed',NULL,NULL,NULL,3000.00,NULL),
('cmpcbikfd0091t82vwnyc4gef','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA-LOAN-1779176104679-9','cmpcbik1i000pt82vvewdv9c2',NULL,'cheque','microlending',NULL,NULL,3000.00,0.00,3000.00,'daily',10,'2026-05-13','2026-05-22',300.00,50.00,NULL,'active',0,10,0.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-19 07:35:04.681','2026-05-19 07:35:04.681','fixed',NULL,NULL,NULL,3000.00,NULL);
/*!40000 ALTER TABLE `loans` ENABLE KEYS */;
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
('cmpcrycaw000asz6yzxb8lb9b','cmpcrycar0008sz6ycfu0fyfn','cmpcbik64003xt82vdqtbi6kw',300.00,'2026-05-19 15:15:14.505');
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
('cmpcrycar0008sz6ycfu0fyfn','cmp1cxexi0000m5lsfbfigi9x','cmpcbik5h003jt82vnkpz5yox',300.00,'cash',NULL,'2026-05-19 15:15:14.496','completed','2026-05-19 15:15:14.500','2026-05-19 15:15:14.500');
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
INSERT INTO `penalties` VALUES
('cmpcs7160000esz6ygjzlkn7t','cmpcbik5h003jt82vnkpz5yox','cmpcbik0o0007t82v3gp02jo2',6,300.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:21:59.976','2026-05-19 15:21:59.976',NULL,NULL),
('cmpcs7169000gsz6y6gu42tgg','cmpcbik6e0045t82v5cj626m8','cmpcbik0s0009t82vpm1wxqda',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:21:59.985','2026-05-19 15:21:59.985',NULL,NULL),
('cmpcs716g000isz6ywxd3jyz3','cmpcbik7o004rt82vqcwnvkf8','cmpcbik0v000bt82vz1mb1kju',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:21:59.992','2026-05-19 15:21:59.992',NULL,NULL),
('cmpcs716l000ksz6yot2imzet','cmpcbik8z005dt82vg4j3ba1z','cmpcbik0z000dt82vyi2jarnj',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:21:59.998','2026-05-19 15:21:59.998',NULL,NULL),
('cmpcs716s000msz6yhrwrmz7g','cmpcbikaa005zt82va5k4tzdc','cmpcbik12000ft82v9fta8egz',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:22:00.004','2026-05-19 15:22:00.004',NULL,NULL),
('cmpcs716y000osz6ydmrjcamp','cmpcbikbj006lt82vl5wrq8ky','cmpcbik16000ht82vwvmx6eyk',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:22:00.010','2026-05-19 15:22:00.010',NULL,NULL),
('cmpcs7174000qsz6yk3i5zn52','cmpcbikcr0077t82vfz4gwacp','cmpcbik19000jt82v0k0n8eq6',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:22:00.017','2026-05-19 15:22:00.017',NULL,NULL),
('cmpcs717a000ssz6y4u4awrw6','cmpcbikdd007tt82v9mzfqd7g','cmpcbik1c000lt82v2rgmyvsk',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:22:00.022','2026-05-19 15:22:00.022',NULL,NULL),
('cmpcs717f000usz6yf243gvej','cmpcbike2008ft82vyn7m840x','cmpcbik1f000nt82vr6zx8biz',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:22:00.027','2026-05-19 15:22:00.027',NULL,NULL),
('cmpcs717j000wsz6yflnah1m4','cmpcbikfd0091t82vwnyc4gef','cmpcbik1i000pt82vvewdv9c2',5,250.00,0.00,0.00,'pending',NULL,NULL,'2026-05-19 15:22:00.032','2026-05-19 15:22:00.032',NULL,NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=269 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rate_limits`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `rate_limits` DISABLE KEYS */;
INSERT INTO `rate_limits` VALUES
(1,'login:user:admin',2,'2026-05-19 15:25:12.602','2026-05-19 15:40:12.602','2026-05-14 12:54:10.246','2026-05-19 15:25:48.917'),
(2,'login:ip:127.0.0.1',4,'2026-05-14 12:54:10.246','2026-05-14 13:09:10.246','2026-05-14 12:54:10.246','2026-05-14 13:08:29.582'),
(8,'login:user:superadmin',1,'2026-05-19 15:42:21.146','2026-05-19 15:57:21.146','2026-05-14 13:08:29.583','2026-05-19 15:42:21.146'),
(10,'login:ip:::1',1,'2026-05-19 15:42:21.146','2026-05-19 15:57:21.146','2026-05-15 11:00:40.076','2026-05-19 15:42:21.146'),
(11,'login:user:developer',1,'2026-05-19 15:26:41.996','2026-05-19 15:41:41.996','2026-05-16 07:57:58.110','2026-05-19 15:26:41.996'),
(114,'login:user:testadmin',1,'2026-05-18 14:06:10.119','2026-05-18 14:21:10.119','2026-05-17 09:00:46.666','2026-05-18 14:06:10.119'),
(117,'login:user:erodeadmin',1,'2026-05-18 13:52:16.177','2026-05-18 14:07:16.177','2026-05-17 09:17:51.681','2026-05-18 13:52:16.177'),
(121,'login:user:new',5,'2026-05-19 15:25:07.264','2026-05-19 15:40:07.264','2026-05-17 09:41:41.102','2026-05-19 15:26:06.842'),
(176,'login:user:karthik',2,'2026-05-17 17:00:20.272','2026-05-17 17:15:20.272','2026-05-17 13:54:52.433','2026-05-17 17:00:50.249'),
(238,'login:user:bad_user',1,'2026-05-18 15:36:50.244','2026-05-18 15:51:50.244','2026-05-18 15:36:50.244','2026-05-18 15:36:50.244');
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
INSERT INTO `route_agents` VALUES
('cmpcbik0f0005t82vbn5h7mpe','cmpcbik080003t82vpd19crpq','cmp1cxfck0006m5lsp6xj0azh',1,'2026-05-19 07:35:04.144');
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
('cmpcbik080003t82vpd19crpq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','BROWSER-QA Route 1779176104135','cmp1cxfck0006m5lsp6xj0azh','active','2026-05-19 07:35:04.136','2026-05-19 07:35:04.136','microlending');
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
  PRIMARY KEY (`id`),
  KEY `system_notifications_tenant_id_app_type_is_read_idx` (`tenant_id`,`app_type`,`is_read`),
  KEY `system_notifications_created_at_idx` (`created_at`),
  KEY `system_notifications_branch_id_idx` (`branch_id`),
  CONSTRAINT `system_notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_notifications`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `system_notifications` DISABLE KEYS */;
INSERT INTO `system_notifications` VALUES
('cmp5nqzx5007f12atrlvn42yj','cmp1cxexi0000m5lsfbfigi9x','microlending','success','money_off','Penalty Waived','Penalty of 10 waived for loan LN0013 by admin.','/loans/cmp3xluko00uhtzssuiit0wqb',1,'2026-05-14 15:43:42.916',NULL,'2026-05-14 15:43:10.169',NULL,NULL);
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
('cmp87ky4x0001z45xon2cjo0w','cmp1cxexi0000m5lsfbfigi9x','basic','active',200,10,'[\"microlending\",\"autofinance\",\"chitfunds\"]','2026-05-15 00:00:00.000','2026-05-31 00:00:00.000',NULL,'2026-05-16 10:33:52.588','2026-05-17 06:55:23.184',NULL);
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
('cmp1cxexi0000m5lsfbfigi9x','LoanTrack','default','active','2026-05-11 15:29:09.072','2026-05-11 15:29:09.072',NULL);
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
('cmp9k950x000b1i4u9znbvget','cmp9k94zq00071i4u78foa56m','cmp1cxext0002m5ls50zh8t71','[\"autofinance\",\"chitfunds\"]','2026-05-17 09:16:22.832','2026-05-18 13:52:09.028'),
('cmp9okc4k000n1i4ub8s00p4v','cmp9jbz8s00011i4ukf18ij2x','cmp1cxext0002m5ls50zh8t71','[\"microlending\",\"autofinance\"]','2026-05-17 11:17:03.716','2026-05-18 13:31:12.306'),
('cmp9tu8bq0005x5ef166x7kbw','cmp9kz3ro000d1i4u4x0gqyop','cmp1cxext0002m5ls50zh8t71','[\"microlending\",\"autofinance\"]','2026-05-17 13:44:43.429','2026-05-19 15:26:00.052'),
('cmp9vijpt0009x5ef5ahd24hd','cmp1cxf590004m5lsp05yll1b','cmp1cxext0002m5ls50zh8t71','[\"microlending\",\"autofinance\",\"chitfunds\"]','2026-05-17 14:31:37.553','2026-05-19 07:35:04.129');
/*!40000 ALTER TABLE `user_branch_modules` ENABLE KEYS */;
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
('cmp1cxf590004m5lsp05yll1b','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Admin User','9800000000',NULL,'admin','$2b$12$g0L/nd45weUtMZaoLFF0KOEAqOg4q3.zv6W1JicJAAXOFr.NiKHT2','admin','autofinance','active',NULL,'2026-05-19 15:25:49.537','2026-05-11 15:29:09.357','2026-05-19 15:25:49.544',NULL,NULL),
('cmp1cxfck0006m5lsp6xj0azh','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Karthik Rajan','9876543210',NULL,'karthik','$2b$12$QxaKsPBC0/yCaggIaus9F.Gd5AB5pf1fcHslINOuDa1nUnVTXPRCe','agent','microlending','inactive',NULL,'2026-05-17 17:00:53.149','2026-05-11 15:29:09.620','2026-05-18 14:52:29.468',NULL,NULL),
('cmp1cxfp20008m5lsqle1q8u1','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Developer','9000000001',NULL,'developer','$2b$12$VcufXq4X0CNTAkx.DZXwYeOCyhnlRS1F12vTFwGy76CEuTx.s8ZB.','developer','microlending','active',NULL,'2026-05-19 15:26:42.555','2026-05-11 15:29:10.070','2026-05-19 15:26:42.560',NULL,NULL),
('cmp1cxg2t000am5lsjru6vfbe','cmp1cxexi0000m5lsfbfigi9x',NULL,'admin2','9000000002',NULL,'admin2','$2b$10$U3x7hi4sprH/hh/VKe3U0uhwnnf/xObJHETqvA4G0WHLr5wna9qtS','admin','microlending','inactive',NULL,'2026-05-16 18:36:18.122','2026-05-11 15:29:10.565','2026-05-18 14:52:20.123',NULL,NULL),
('cmp9dwygs00017bb7ekcb8a3i','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Super Admin','9998887776',NULL,'superadmin','$2b$12$R1Ywg3vkfgTtMPHMypK36uKA2DsgeuB0vd0u8e/0Xxxcx8q1GmZpG','superadmin','chitfunds','active',NULL,'2026-05-19 15:42:21.757','2026-05-17 06:18:56.764','2026-05-19 15:42:21.765',NULL,NULL),
('cmp9jbz8s00011i4ukf18ij2x','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Test Branch Admin','9876543222',NULL,'testadmin','$2b$10$RQN2jaXc5IPzf5aC/enC3epZM5jgCTAhcSAqTkGCyGIEh0B0zhptK','admin','microlending','inactive',NULL,'2026-05-18 14:06:10.426','2026-05-17 08:50:35.687','2026-05-18 14:52:30.976',NULL,NULL),
('cmp9k94zq00071i4u78foa56m','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Erode Branch Admin','9876543233',NULL,'erodeadmin','$2b$10$CEKuAhLOZvoR5KruXBnBFOargKJSgmjSe2U.fvNfY8MErFAqeLxCK','admin','autofinance','inactive',NULL,'2026-05-18 13:52:16.416','2026-05-17 09:16:22.787','2026-05-18 14:52:23.555',NULL,NULL),
('cmp9kz3ro000d1i4u4x0gqyop','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','new','7442941290',NULL,'new','$2b$10$Jjh3S8.EFs.C.dXYAhLbMupP1k.RBHgcEU8NvZYKHUTojZG7xyIjS','agent','microlending','active',NULL,'2026-05-19 15:26:07.032','2026-05-17 09:36:34.260','2026-05-19 15:26:07.039',NULL,NULL);
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

-- Dump completed on 2026-05-19 21:29:12
