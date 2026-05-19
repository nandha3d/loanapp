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
('dee3dde2-2fe0-4403-b774-c59cb1634eff','763b815b295d719399ae51845e50a916e40574e579ea1cee21b84ed14f2a9d06','2026-05-16 14:15:29.800','20260516190000_user_management_realignment','',NULL,'2026-05-16 14:15:29.800',0);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
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
('cmp1cxg4v001am5lsz5lghd6o','cmp1cxexi0000m5lsfbfigi9x','loan_code_counter','16','general','2026-05-11 15:29:10.638','2026-05-14 13:48:45.873'),
('cmp2mn0p20001g8w0pvs35tuc','cmp1cxexi0000m5lsfbfigi9x','language','en','system','2026-05-12 12:48:46.407','2026-05-14 15:39:02.869');
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
('cmp2ba2e3000fyfs6eeh17umk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-12 07:30:46.299'),
('cmp3nhs2d00bhp5p1g42jbom7','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-13 06:00:27.734'),
('cmp3ni97300edp5p1m10ru0ts','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','create','loan','cmp3ni94g00bjp5p1e4w5foaf',NULL,'{\"principal\":30000,\"tenure\":100,\"loanCode\":\"LN0005\"}',NULL,NULL,'2026-05-13 06:00:49.935'),
('cmp3om68w0001nbxk8imhp95q','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-13 06:31:52.352'),
('cmp3osht20003nbxkt5djal8e','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','instalment','cmp3ni94g00bkp5p1v3lmyvws',NULL,'{\"receivedAmount\":300,\"paymentMode\":\"cash\",\"status\":\"paid\"}',NULL,NULL,'2026-05-13 06:36:47.271'),
('cmp3xuz3h0005si316enz4jvs','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjb410001tzssgpdd8cf5',NULL,'{\"customerCode\":\"CUST100\",\"name\":\"CM Vijay\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:50:39.533'),
('cmp3xvg550007si31q4kj5noy','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjba30003tzss161x0exy',NULL,'{\"customerCode\":\"CUST101\",\"name\":\"MK Stalin\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:51:01.625'),
('cmp3xwn8i0009si31ormm6t91','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjbro0005tzss4ob3gdfi',NULL,'{\"customerCode\":\"CUST102\",\"name\":\"Edappadi Palanisamy\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:51:57.474'),
('cmp3xx75x000bsi31h68yzkha','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjc4v0007tzssg1ce06dp',NULL,'{\"customerCode\":\"CUST103\",\"name\":\"Seeman\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:52:23.301'),
('cmp3xxrsj000dsi31n0vrxwmp','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjckm0009tzssi1qdimlk',NULL,'{\"customerCode\":\"CUST104\",\"name\":\"Suresh Raina\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:52:50.035'),
('cmp3xy9x4000fsi31m9f54omd','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjcy2000btzssn6ct346q',NULL,'{\"customerCode\":\"CUST105\",\"name\":\"Ajithkumar\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:53:13.529'),
('cmp3xyspq000hsi31hb61fgee','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjc4v0007tzssg1ce06dp',NULL,'{\"customerCode\":\"CUST103\",\"name\":\"Sivakarthikeyan\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:53:37.887'),
('cmp3xziqr000jsi31sa7o3ydw','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjded000dtzssblkfcdne',NULL,'{\"customerCode\":\"CUST106\",\"name\":\"Mahendra Singh Dhoni\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:54:11.620'),
('cmp3y073g000lsi310wfo5q8m','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','customer','cmp3xjdu8000ftzsspt9qgs25',NULL,'{\"customerCode\":\"CUST107\",\"name\":\"Mukesh Ambani\",\"status\":\"active\"}',NULL,NULL,'2026-05-13 10:54:43.181'),
('cmp3y92k9000nsi31qwbk6skq','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','loan','cmp3xlltb00ovtzss6gpg8c8n',NULL,'{\"principal\":30000,\"tenure\":100,\"coreChanged\":false}',NULL,NULL,'2026-05-13 11:01:37.210'),
('cmp3ylh38000psi31m44zzfwo','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','loan','cmp3xlltb00ovtzss6gpg8c8n',NULL,'{\"principal\":30000,\"tenure\":100,\"coreChanged\":false}',NULL,NULL,'2026-05-13 11:11:15.909'),
('cmp3yzgxi000rsi3161ywq8v6','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','loan','cmp3xlltb00ovtzss6gpg8c8n',NULL,'{\"principal\":30000,\"tenure\":100,\"coreChanged\":false}',NULL,NULL,'2026-05-13 11:22:08.886'),
('cmp3zd3tw000tsi31sievwab1','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','update','loan','cmp3xkvx600fhtzsskpfwt6dk',NULL,'{\"principal\":30000,\"tenure\":20,\"coreChanged\":false}',NULL,NULL,'2026-05-13 11:32:45.092'),
('cmp46ih9p000pxarmg0r9qf4c','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-13 14:52:53.101'),
('cmp46jeed000rxarmjat484mv','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-13 14:53:36.037'),
('cmp46k5s9000txarmbsu2csfe','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-13 14:54:11.529'),
('cmp49b4ws0001k8ts4449bsvz','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-13 16:11:09.339'),
('cmp5hpqks000112at9918dm17','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-14 12:54:13.704'),
('cmp5i104y000712atq3gj8l5y','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-14 13:02:59.314'),
('cmp5i1x93000912atnocnd76q','cmp1cxexi0000m5lsfbfigi9x','cmp1cxf590004m5lsp05yll1b','login','user','cmp1cxf590004m5lsp05yll1b',NULL,NULL,NULL,NULL,'2026-05-14 13:03:42.231'),
('cmp5i8591000b12atlz7nx8of','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-14 13:08:32.533'),
('cmp5jnvg3006h12at1x2qj8i7','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','create','loan','cmp5jnvfd003d12atqahjbbxa',NULL,'{\"principal\":10000,\"tenure\":110,\"loanCode\":\"LN0016\"}',NULL,NULL,'2026-05-14 13:48:45.939'),
('cmp5jqpy2006o12atvgrzf176','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','create','collection','cmp5jqpn1006m12at0bblpyr0',NULL,'{\"customer\":\"Mahendra Singh Dhoni\",\"loanCode\":\"LN0006\",\"receivedAmount\":220,\"paymentMode\":\"cash\",\"allocation\":\"Auto-allocated across instalments: #1 paid 220/220\"}',NULL,NULL,'2026-05-14 13:50:58.779'),
('cmp5n3ufc007212atf295ccd7','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','update','collection','cmp5n3udg007012ati0yfhp8j',NULL,'{\"customer\":\"Mukesh Ambani\",\"loanCode\":\"LN0007\",\"delta\":-1650,\"totalReceived\":0,\"paymentMode\":\"cash\",\"allocation\":\"Payment adjustment for instalment #4 (1650 → 0)\"}',NULL,NULL,'2026-05-14 15:25:09.960'),
('cmp5n46t5007712atod31qw9b','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','create','collection','cmp5n46qx007512at9plwmvur',NULL,'{\"customer\":\"Mukesh Ambani\",\"loanCode\":\"LN0007\",\"delta\":3300,\"totalReceived\":3300,\"paymentMode\":\"cash\",\"allocation\":\"Direct payment for instalment #5 (+₹3300)\"}',NULL,NULL,'2026-05-14 15:25:26.010'),
('cmp5nqzx3007d12atphefanu2','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','update','penalty','cmp4a7ae3000b128m34ap4s7f',NULL,'{\"action\":\"waive\",\"waivedAmount\":10}',NULL,NULL,'2026-05-14 15:43:10.167'),
('cmp5nrewx007h12atjedyreli','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','update','penalty','cmp4a7ady0009128mcbgz6i4t',NULL,'{\"action\":\"settle\",\"settledAmount\":75}',NULL,NULL,'2026-05-14 15:43:29.601'),
('cmp6t3nhe0001ucixvuhm1hun','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','login','user','cmp1cxg2t000am5lsjru6vfbe',NULL,NULL,NULL,NULL,'2026-05-15 11:00:44.832'),
('cmp6t6ngc000aucixqnpynj92','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','update','collection','cmp6t6neb0004ucix4ehtkmbt',NULL,'{\"customer\":\"Mukesh Ambani\",\"loanCode\":\"LN0007\",\"delta\":-3300,\"totalReceived\":0,\"paymentMode\":\"cash\",\"allocation\":\"Payment adjustment for instalment #5 (3300 → 0)\"}',NULL,NULL,'2026-05-15 11:03:04.764'),
('cmp6t72pk000jucixmtl1zlgy','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','update','collection','cmp6t72ng000ducix91a9bpbl',NULL,'{\"customer\":\"Mukesh Ambani\",\"loanCode\":\"LN0007\",\"delta\":-1650,\"totalReceived\":0,\"paymentMode\":\"cash\",\"allocation\":\"Payment adjustment for instalment #2 (1650 → 0)\"}',NULL,NULL,'2026-05-15 11:03:24.536'),
('cmp6t7d1y000sucix2mlexgji','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','create','collection','cmp6t7d0e000mucix1qyr7zig',NULL,'{\"customer\":\"Mukesh Ambani\",\"loanCode\":\"LN0007\",\"delta\":3300,\"totalReceived\":3300,\"paymentMode\":\"cash\",\"allocation\":\"Direct payment for instalment #5 (+₹3300)\"}',NULL,NULL,'2026-05-15 11:03:37.942'),
('cmp6t9f2q0011ucix1t2kgc4b','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','update','collection','cmp6t9f19000vucix4tslzsr4',NULL,'{\"customer\":\"Mukesh Ambani\",\"loanCode\":\"LN0007\",\"delta\":-3300,\"totalReceived\":0,\"paymentMode\":\"cash\",\"allocation\":\"Payment adjustment for instalment #5 (3300 → 0)\"}',NULL,NULL,'2026-05-15 11:05:13.874'),
('cmp820k5b0001lfhksrosr9le','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','login','user','cmp1cxfp20008m5lsqle1q8u1',NULL,NULL,NULL,NULL,'2026-05-16 07:58:03.260'),
('cmp8h58g900012r3eqrhze4kw','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','update','user','cmp1cxg2t000am5lsjru6vfbe',NULL,'{\"name\":\"Super Admin\",\"username\":\"superadmin\",\"role\":\"superadmin\",\"appType\":\"autofinance\",\"status\":\"active\"}',NULL,NULL,'2026-05-16 15:01:35.624'),
('cmp8h5gfh00032r3e7g10dl8f','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','update','user','cmp1cxg2t000am5lsjru6vfbe',NULL,'{\"name\":\"Super Admin\",\"username\":\"superadmin\",\"role\":\"superadmin\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-16 15:01:45.965'),
('cmp8h88f700052r3evoqqkj4c','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','update','user','cmp1cxg2t000am5lsjru6vfbe',NULL,'{\"name\":\"Super Admin\",\"username\":\"superadmin\",\"role\":\"superadmin\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-16 15:03:55.555'),
('cmp8hcs4z00072r3epsfudibk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','update','user','cmp1cxg2t000am5lsjru6vfbe',NULL,'{\"name\":\"Super Admin\",\"username\":\"superadmin\",\"role\":\"superadmin\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-16 15:07:27.732'),
('cmp8hd7ez00092r3esom88dtm','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','update','user','cmp1cxg2t000am5lsjru6vfbe',NULL,'{\"name\":\"Super Admin\",\"username\":\"superadmin\",\"role\":\"superadmin\",\"appType\":\"autofinance\",\"status\":\"active\"}',NULL,NULL,'2026-05-16 15:07:47.532'),
('cmp8hgop9000b2r3ei99bt9ds','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','update','user','cmp1cxg2t000am5lsjru6vfbe',NULL,'{\"name\":\"Super Admin\",\"username\":\"superadmin\",\"role\":\"superadmin\",\"appType\":\"autofinance\",\"status\":\"active\"}',NULL,NULL,'2026-05-16 15:10:29.901'),
('cmp8hj5f7000d2r3ed1h487kp','cmp1cxexi0000m5lsfbfigi9x','cmp1cxfp20008m5lsqle1q8u1','update','branch','cmp1cxext0002m5ls50zh8t71',NULL,'{\"name\":\"Erode\",\"code\":\"HQ\",\"status\":\"active\"}',NULL,NULL,'2026-05-16 15:12:24.883'),
('cmp8p1upz00012b7agxhzdxty','cmp1cxexi0000m5lsfbfigi9x','cmp1cxg2t000am5lsjru6vfbe','update','user','cmp1cxg2t000am5lsjru6vfbe',NULL,'{\"name\":\"admin2\",\"username\":\"admin2\",\"role\":\"admin\",\"appType\":\"microlending\",\"status\":\"active\"}',NULL,NULL,'2026-05-16 18:42:54.790');
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
('cmp1cxext0002m5ls50zh8t71','cmp1cxexi0000m5lsfbfigi9x','Erode','HQ','Main Branch','','active','2026-05-11 15:29:09.090','2026-05-16 15:12:24.877','cmp1cxg2t000am5lsjru6vfbe','[]');
/*!40000 ALTER TABLE `branches` ENABLE KEYS */;
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
  PRIMARY KEY (`id`),
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
('cmp5jqpn1006m12at0bblpyr0','cmp5jqpml006k12atq9ss6x9o','cmp3xjded000dtzssblkfcdne','cmp3xkd0p009vtzsseb8h2w1z',220.00,220.00,'cash','Auto-allocated across instalments: #1 paid 220/220','cmp1cxg2t000am5lsjru6vfbe','2026-05-14 13:50:58.381',1,NULL),
('cmp5n3udg007012ati0yfhp8j','2470c8fe-37bd-4e05-942d-5c66a812cb6c','cmp3xjdu8000ftzsspt9qgs25','cmp3xkvx600fhtzsskpfwt6dk',1650.00,-1650.00,'cash','Payment adjustment for instalment #4 (1650 → 0)','cmp1cxg2t000am5lsjru6vfbe','2026-05-14 15:25:09.892',1,NULL),
('cmp5n46qx007512at9plwmvur','2470c8fe-37bd-4e05-942d-5c66a812cb6c','cmp3xjdu8000ftzsspt9qgs25','cmp3xkvx600fhtzsskpfwt6dk',1650.00,3300.00,'cash','Direct payment for instalment #5 (+₹3300)','cmp1cxg2t000am5lsjru6vfbe','2026-05-14 15:25:25.929',1,NULL),
('cmp6t6neb0004ucix4ehtkmbt','13fe2c56-04a8-4764-947f-bfbdaf889584','cmp3xjdu8000ftzsspt9qgs25','cmp3xkvx600fhtzsskpfwt6dk',1650.00,-3300.00,'cash','Payment adjustment for instalment #5 (3300 → 0)','cmp1cxg2t000am5lsjru6vfbe','2026-05-15 11:03:04.691',1,'cmp1cxexi0000m5lsfbfigi9x'),
('cmp6t72ng000ducix91a9bpbl','13fe2c56-04a8-4764-947f-bfbdaf889584','cmp3xjdu8000ftzsspt9qgs25','cmp3xkvx600fhtzsskpfwt6dk',1650.00,-1650.00,'cash','Payment adjustment for instalment #2 (1650 → 0)','cmp1cxg2t000am5lsjru6vfbe','2026-05-15 11:03:24.461',1,'cmp1cxexi0000m5lsfbfigi9x'),
('cmp6t7d0e000mucix1qyr7zig','13fe2c56-04a8-4764-947f-bfbdaf889584','cmp3xjdu8000ftzsspt9qgs25','cmp3xkvx600fhtzsskpfwt6dk',1650.00,3300.00,'cash','Edited by Admin:  | Direct payment for instalment #5 (+₹3300)','cmp1cxg2t000am5lsjru6vfbe','2026-05-15 11:03:37.887',1,'cmp1cxexi0000m5lsfbfigi9x'),
('cmp6t9f19000vucix4tslzsr4','13fe2c56-04a8-4764-947f-bfbdaf889584','cmp3xjdu8000ftzsspt9qgs25','cmp3xkvx600fhtzsskpfwt6dk',1650.00,-3300.00,'cash','Edited by Admin:  | Payment adjustment for instalment #5 (3300 → 0)','cmp1cxg2t000am5lsjru6vfbe','2026-05-15 11:05:13.821',1,'cmp1cxexi0000m5lsfbfigi9x');
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
('cmp3xjb410001tzssgpdd8cf5','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','CUST100','CM Vijay','9876500100','10, Main Road, Anna Nagar, Chennai',NULL,'cmp2m3njx00037i7ws8csnqzg','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-13 10:41:35.234','2026-05-13 10:50:39.457',NULL,NULL),
('cmp3xjba30003tzss161x0exy','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','CUST101','MK Stalin','9876500101','11, Main Road, Anna Nagar, Chennai',NULL,'route-chithode','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-13 10:41:35.451','2026-05-13 10:51:01.479',NULL,NULL),
('cmp3xjbro0005tzss4ob3gdfi','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','CUST102','Edappadi Palanisamy','9876500102','12, Main Road, Anna Nagar, Chennai',NULL,'route-gobichettipalayam','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-13 10:41:36.085','2026-05-13 10:51:57.393',NULL,NULL),
('cmp3xjc4v0007tzssg1ce06dp','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','CUST103','Sivakarthikeyan','9876500103','13, Main Road, Anna Nagar, Chennai',NULL,'route-bhavani','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-13 10:41:36.560','2026-05-13 10:53:37.808',NULL,NULL),
('cmp3xjckm0009tzssi1qdimlk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','CUST104','Suresh Raina','9876500104','14, Main Road, Anna Nagar, Chennai',NULL,'cmp2m3njx00037i7ws8csnqzg','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-13 10:41:37.126','2026-05-13 10:52:49.753',NULL,NULL),
('cmp3xjcy2000btzssn6ct346q','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','CUST105','Ajithkumar','9876500105','15, Main Road, Anna Nagar, Chennai',NULL,'route-bhavani','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-13 10:41:37.610','2026-05-13 10:53:13.379',NULL,NULL),
('cmp3xjded000dtzssblkfcdne','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','CUST106','Mahendra Singh Dhoni','9876500106','16, Main Road, Anna Nagar, Chennai',NULL,'cmp2m3njx00037i7ws8csnqzg','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-13 10:41:38.197','2026-05-13 10:54:11.492',NULL,NULL),
('cmp3xjdu8000ftzsspt9qgs25','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','CUST107','Mukesh Ambani','9876500107','17, Main Road, Anna Nagar, Chennai',NULL,'route-chithode','cmp1cxfck0006m5lsp6xj0azh','verified',NULL,NULL,'active',NULL,'microlending','2026-05-13 10:41:38.769','2026-05-13 10:54:43.042',NULL,NULL);
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
('13fe2c56-04a8-4764-947f-bfbdaf889584','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','cmp1cxg2t000am5lsjru6vfbe','route-chithode','2026-05-15',6600.00,-4950.00,4,'microlending','open',NULL,'2026-05-15 16:33:04.000','2026-05-15 11:05:13.871'),
('2470c8fe-37bd-4e05-942d-5c66a812cb6c','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','cmp1cxg2t000am5lsjru6vfbe','route-chithode','2026-05-14',3300.00,1650.00,2,'microlending','open',NULL,'2026-05-14 20:55:09.000','2026-05-14 15:25:26.005'),
('cmp5jqpml006k12atq9ss6x9o','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','cmp1cxg2t000am5lsjru6vfbe','cmp2m3njx00037i7ws8csnqzg','2026-05-13',220.00,220.00,1,'microlending','open',NULL,'2026-05-14 13:50:58.365','2026-05-14 13:50:58.773');
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
('cmp3xjekv000jtzsscr3nfkgo','cmp3xjef2000htzssuy6fgcbm',1,'2026-04-20',1100.00,440.00,NULL,'partial','2026-04-20 10:41:39.516',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:39.728','2026-05-13 11:17:33.810'),
('cmp3xjeq6000ltzsspp7t2lmg','cmp3xjef2000htzssuy6fgcbm',2,'2026-04-27',1100.00,440.00,NULL,'partial','2026-04-27 10:41:39.516',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:39.918','2026-05-13 11:17:33.810'),
('cmp3xjeyz000ntzssq4c6zf53','cmp3xjef2000htzssuy6fgcbm',3,'2026-05-04',1100.00,1100.00,NULL,'paid','2026-05-04 10:41:39.516',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:40.235','2026-05-13 11:17:33.810'),
('cmp3xjf8g000ptzssbum4azwo','cmp3xjef2000htzssuy6fgcbm',4,'2026-05-11',1100.00,440.00,NULL,'partial','2026-05-11 10:41:39.516',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:40.576','2026-05-13 11:17:33.810'),
('cmp3xjfeh000rtzssrft6ayrh','cmp3xjef2000htzssuy6fgcbm',5,'2026-05-18',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:40.794','2026-05-13 11:17:33.810'),
('cmp3xjfk1000ttzsscznwte59','cmp3xjef2000htzssuy6fgcbm',6,'2026-05-25',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:40.993','2026-05-13 11:17:33.810'),
('cmp3xjfqp000vtzssvnpkg9lk','cmp3xjef2000htzssuy6fgcbm',7,'2026-06-01',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:41.234','2026-05-13 11:17:33.810'),
('cmp3xjfzc000xtzss87yujf20','cmp3xjef2000htzssuy6fgcbm',8,'2026-06-08',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:41.544','2026-05-13 11:17:33.810'),
('cmp3xjg3t000ztzssglk38lyg','cmp3xjef2000htzssuy6fgcbm',9,'2026-06-15',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:41.705','2026-05-13 11:17:33.810'),
('cmp3xjgrt0011tzsswyuf5qrs','cmp3xjef2000htzssuy6fgcbm',10,'2026-06-22',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:42.569','2026-05-13 11:17:33.810'),
('cmp3xjh2p0013tzsshgbvr9fy','cmp3xjef2000htzssuy6fgcbm',11,'2026-06-29',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:42.961','2026-05-13 11:17:33.810'),
('cmp3xjhdi0015tzss7ewmadkl','cmp3xjef2000htzssuy6fgcbm',12,'2026-07-06',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:43.351','2026-05-13 11:17:33.810'),
('cmp3xjhkz0017tzssawox4p6m','cmp3xjef2000htzssuy6fgcbm',13,'2026-07-13',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:43.619','2026-05-13 11:17:33.810'),
('cmp3xjhop0019tzssbgjr9wzq','cmp3xjef2000htzssuy6fgcbm',14,'2026-07-20',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:43.753','2026-05-13 11:17:33.810'),
('cmp3xjhvd001btzssg1sm2261','cmp3xjef2000htzssuy6fgcbm',15,'2026-07-27',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:43.994','2026-05-13 11:17:33.810'),
('cmp3xji3a001dtzssvxiys2n4','cmp3xjef2000htzssuy6fgcbm',16,'2026-08-03',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:44.278','2026-05-13 11:17:33.810'),
('cmp3xji99001ftzss6n9s49w6','cmp3xjef2000htzssuy6fgcbm',17,'2026-08-10',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:44.494','2026-05-13 11:17:33.810'),
('cmp3xjif3001htzssnz6f6q38','cmp3xjef2000htzssuy6fgcbm',18,'2026-08-17',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:44.703','2026-05-13 11:17:33.810'),
('cmp3xjiis001jtzssvvoq5uli','cmp3xjef2000htzssuy6fgcbm',19,'2026-08-24',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:44.836','2026-05-13 11:17:33.810'),
('cmp3xjio3001ltzss85ol2qin','cmp3xjef2000htzssuy6fgcbm',20,'2026-08-31',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:45.027','2026-05-13 11:17:33.810'),
('cmp3xjjb4001ptzssalrpi4g3','cmp3xjj4j001ntzss4cpeou4y',1,'2026-05-13',2750.00,2750.00,NULL,'paid','2026-05-13 10:41:45.617',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:45.856','2026-05-13 11:17:34.334'),
('cmp3xjjkr001rtzssghon7u1u','cmp3xjj4j001ntzss4cpeou4y',2,'2026-06-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:46.203','2026-05-13 11:17:34.334'),
('cmp3xjjt2001ttzss54znj251','cmp3xjj4j001ntzss4cpeou4y',3,'2026-07-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:46.503','2026-05-13 11:17:34.334'),
('cmp3xjjyv001vtzsstnjp873t','cmp3xjj4j001ntzss4cpeou4y',4,'2026-08-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:46.712','2026-05-13 11:17:34.334'),
('cmp3xjk47001xtzss7uryb06d','cmp3xjj4j001ntzss4cpeou4y',5,'2026-09-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:46.903','2026-05-13 11:17:34.334'),
('cmp3xjk9z001ztzssxr6yenx9','cmp3xjj4j001ntzss4cpeou4y',6,'2026-10-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:47.112','2026-05-13 11:17:34.334'),
('cmp3xjklk0021tzssqrratfob','cmp3xjj4j001ntzss4cpeou4y',7,'2026-11-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:47.528','2026-05-13 11:17:34.334'),
('cmp3xjkp90023tzsscfy5l8md','cmp3xjj4j001ntzss4cpeou4y',8,'2026-12-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:47.662','2026-05-13 11:17:34.334'),
('cmp3xjkul0025tzssp6nc6td4','cmp3xjj4j001ntzss4cpeou4y',9,'2027-01-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:47.853','2026-05-13 11:17:34.334'),
('cmp3xjkyi0027tzsso7vf4vbc','cmp3xjj4j001ntzss4cpeou4y',10,'2027-02-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:47.995','2026-05-13 11:17:34.334'),
('cmp3xjl8p0029tzsss1njblmo','cmp3xjj4j001ntzss4cpeou4y',11,'2027-03-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:48.361','2026-05-13 11:17:34.334'),
('cmp3xjlgd002btzsslf8hdaf4','cmp3xjj4j001ntzss4cpeou4y',12,'2027-04-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:48.637','2026-05-13 11:17:34.334'),
('cmp3xjm1w002ftzssisd3eex6','cmp3xjltb002dtzssr0bkhan6',1,'2026-04-14',550.00,550.00,NULL,'paid','2026-04-14 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:49.412','2026-05-13 11:17:34.559'),
('cmp3xjm7g002htzss96yk8y3b','cmp3xjltb002dtzssr0bkhan6',2,'2026-04-15',550.00,550.00,NULL,'paid','2026-04-15 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:49.612','2026-05-13 11:17:34.559'),
('cmp3xjmem002jtzssaqc2rc6f','cmp3xjltb002dtzssr0bkhan6',3,'2026-04-16',550.00,550.00,NULL,'paid','2026-04-16 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:49.871','2026-05-13 11:17:34.559'),
('cmp3xjmjx002ltzssy2w5wmmy','cmp3xjltb002dtzssr0bkhan6',4,'2026-04-17',550.00,550.00,NULL,'paid','2026-04-17 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:50.062','2026-05-13 11:17:34.559'),
('cmp3xjmsa002ntzss4lf8t1ng','cmp3xjltb002dtzssr0bkhan6',5,'2026-04-18',550.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:50.363','2026-05-13 11:17:34.559'),
('cmp3xjmzg002ptzss2umax625','cmp3xjltb002dtzssr0bkhan6',6,'2026-04-19',550.00,550.00,NULL,'paid','2026-04-19 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:50.621','2026-05-13 11:17:34.559'),
('cmp3xjn5x002rtzssewdmagwu','cmp3xjltb002dtzssr0bkhan6',7,'2026-04-20',550.00,550.00,NULL,'paid','2026-04-20 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:50.854','2026-05-13 11:17:34.559'),
('cmp3xjnci002ttzss7phetox4','cmp3xjltb002dtzssr0bkhan6',8,'2026-04-21',550.00,550.00,NULL,'paid','2026-04-21 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:51.090','2026-05-13 11:17:34.559'),
('cmp3xjnm5002vtzssfc6e8ubx','cmp3xjltb002dtzssr0bkhan6',9,'2026-04-22',550.00,220.00,NULL,'partial','2026-04-22 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:51.438','2026-05-13 11:17:34.559'),
('cmp3xjnpv002xtzssxjg02ufv','cmp3xjltb002dtzssr0bkhan6',10,'2026-04-23',550.00,550.00,NULL,'paid','2026-04-23 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:51.571','2026-05-13 11:17:34.559'),
('cmp3xjnwc002ztzsslk9i7jm5','cmp3xjltb002dtzssr0bkhan6',11,'2026-04-24',550.00,550.00,NULL,'paid','2026-04-24 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:51.804','2026-05-13 11:17:34.559'),
('cmp3xjo240031tzss3gh6coiy','cmp3xjltb002dtzssr0bkhan6',12,'2026-04-25',550.00,550.00,NULL,'paid','2026-04-25 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:52.013','2026-05-13 11:17:34.559'),
('cmp3xjo5u0033tzss03n3rxfd','cmp3xjltb002dtzssr0bkhan6',13,'2026-04-26',550.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:52.146','2026-05-13 11:17:34.559'),
('cmp3xjofb0035tzssvaz5sfvi','cmp3xjltb002dtzssr0bkhan6',14,'2026-04-27',550.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:52.488','2026-05-13 11:17:34.559'),
('cmp3xjolc0037tzss8tork8kn','cmp3xjltb002dtzssr0bkhan6',15,'2026-04-28',550.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:52.704','2026-05-13 11:17:34.559'),
('cmp3xjor50039tzsspe0k3hbi','cmp3xjltb002dtzssr0bkhan6',16,'2026-04-29',550.00,550.00,NULL,'paid','2026-04-29 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:52.913','2026-05-13 11:17:34.559'),
('cmp3xjowg003btzss7v6q73l8','cmp3xjltb002dtzssr0bkhan6',17,'2026-04-30',550.00,220.00,NULL,'partial','2026-04-30 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:53.104','2026-05-13 11:17:34.559'),
('cmp3xjp43003dtzsswt95gz7a','cmp3xjltb002dtzssr0bkhan6',18,'2026-05-01',550.00,220.00,NULL,'partial','2026-05-01 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:53.379','2026-05-13 11:17:34.559'),
('cmp3xjp81003ftzssdff2qtus','cmp3xjltb002dtzssr0bkhan6',19,'2026-05-02',550.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:53.521','2026-05-13 11:17:34.559'),
('cmp3xjpez003htzsszokd26vy','cmp3xjltb002dtzssr0bkhan6',20,'2026-05-03',550.00,550.00,NULL,'paid','2026-05-03 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:53.771','2026-05-13 11:17:34.559'),
('cmp3xjpka003jtzss35l5jvc0','cmp3xjltb002dtzssr0bkhan6',21,'2026-05-04',550.00,550.00,NULL,'paid','2026-05-04 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:53.963','2026-05-13 11:17:34.559'),
('cmp3xjpti003ltzssyepya107','cmp3xjltb002dtzssr0bkhan6',22,'2026-05-05',550.00,550.00,NULL,'paid','2026-05-05 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:54.295','2026-05-13 11:17:34.559'),
('cmp3xjq24003ntzss1mbype7e','cmp3xjltb002dtzssr0bkhan6',23,'2026-05-06',550.00,550.00,NULL,'paid','2026-05-06 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:54.604','2026-05-13 11:17:34.559'),
('cmp3xjq62003ptzss5nv16e9c','cmp3xjltb002dtzssr0bkhan6',24,'2026-05-07',550.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:54.746','2026-05-13 11:17:34.559'),
('cmp3xjqbn003rtzss67gy79a0','cmp3xjltb002dtzssr0bkhan6',25,'2026-05-08',550.00,550.00,NULL,'paid','2026-05-08 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:54.947','2026-05-13 11:17:34.559'),
('cmp3xjqfc003ttzssd2wzwjor','cmp3xjltb002dtzssr0bkhan6',26,'2026-05-09',550.00,550.00,NULL,'paid','2026-05-09 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:55.080','2026-05-13 11:17:34.559'),
('cmp3xjqnn003vtzss3u5la0zw','cmp3xjltb002dtzssr0bkhan6',27,'2026-05-10',550.00,550.00,NULL,'paid','2026-05-10 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:55.379','2026-05-13 11:17:34.559'),
('cmp3xjqx5003xtzssbc03hs1c','cmp3xjltb002dtzssr0bkhan6',28,'2026-05-11',550.00,550.00,NULL,'paid','2026-05-11 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:55.721','2026-05-13 11:17:34.559'),
('cmp3xjr2y003ztzssyetxn15y','cmp3xjltb002dtzssr0bkhan6',29,'2026-05-12',550.00,550.00,NULL,'paid','2026-05-12 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:55.931','2026-05-13 11:17:34.559'),
('cmp3xjr6o0041tzssw499jb1k','cmp3xjltb002dtzssr0bkhan6',30,'2026-05-13',550.00,550.00,NULL,'paid','2026-05-13 10:41:49.101',NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:56.064','2026-05-13 11:17:34.559'),
('cmp3xjrgd0043tzss5eohhxz5','cmp3xjltb002dtzssr0bkhan6',31,'2026-05-14',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:56.413','2026-05-13 11:17:34.559'),
('cmp3xjrox0045tzss7ldt5zmo','cmp3xjltb002dtzssr0bkhan6',32,'2026-05-15',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:56.722','2026-05-13 11:17:34.559'),
('cmp3xjrwc0047tzsspjl4apz1','cmp3xjltb002dtzssr0bkhan6',33,'2026-05-16',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:56.988','2026-05-13 11:17:34.559'),
('cmp3xjs0a0049tzss6ziaq6af','cmp3xjltb002dtzssr0bkhan6',34,'2026-05-17',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:57.130','2026-05-13 11:17:34.559'),
('cmp3xjsfk004btzssup1lozne','cmp3xjltb002dtzssr0bkhan6',35,'2026-05-18',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:57.680','2026-05-13 11:17:34.559'),
('cmp3xjso4004dtzss7h8kwek8','cmp3xjltb002dtzssr0bkhan6',36,'2026-05-19',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:57.989','2026-05-13 11:17:34.559'),
('cmp3xjszq004ftzss12llw5z8','cmp3xjltb002dtzssr0bkhan6',37,'2026-05-20',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:58.406','2026-05-13 11:17:34.559'),
('cmp3xjta4004htzsswzv2z6ex','cmp3xjltb002dtzssr0bkhan6',38,'2026-05-21',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:58.780','2026-05-13 11:17:34.559'),
('cmp3xjtgu004jtzss7m2cvo12','cmp3xjltb002dtzssr0bkhan6',39,'2026-05-22',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:59.023','2026-05-13 11:17:34.559'),
('cmp3xjtpc004ltzsssm9iogvo','cmp3xjltb002dtzssr0bkhan6',40,'2026-05-23',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:59.329','2026-05-13 11:17:34.559'),
('cmp3xju02004ntzssa8bfl17v','cmp3xjltb002dtzssr0bkhan6',41,'2026-05-24',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:59.714','2026-05-13 11:17:34.559'),
('cmp3xju78004ptzssj6k9029m','cmp3xjltb002dtzssr0bkhan6',42,'2026-05-25',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:41:59.973','2026-05-13 11:17:34.559'),
('cmp3xjuck004rtzsswd1iggik','cmp3xjltb002dtzssr0bkhan6',43,'2026-05-26',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:00.164','2026-05-13 11:17:34.559'),
('cmp3xjuot004ttzss9efdzv7x','cmp3xjltb002dtzssr0bkhan6',44,'2026-05-27',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:00.605','2026-05-13 11:17:34.559'),
('cmp3xjuvk004vtzsskvliqa40','cmp3xjltb002dtzssr0bkhan6',45,'2026-05-28',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:00.848','2026-05-13 11:17:34.559'),
('cmp3xjv0v004xtzssg82dqvij','cmp3xjltb002dtzssr0bkhan6',46,'2026-05-29',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:01.039','2026-05-13 11:17:34.559'),
('cmp3xjv4t004ztzssw8xaso6r','cmp3xjltb002dtzssr0bkhan6',47,'2026-05-30',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:01.181','2026-05-13 11:17:34.559'),
('cmp3xjve30051tzsskx1zigrr','cmp3xjltb002dtzssr0bkhan6',48,'2026-05-31',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:01.515','2026-05-13 11:17:34.559'),
('cmp3xjvlh0053tzssfbq5338j','cmp3xjltb002dtzssr0bkhan6',49,'2026-06-01',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:01.781','2026-05-13 11:17:34.559'),
('cmp3xjvpf0055tzss69sp5qjt','cmp3xjltb002dtzssr0bkhan6',50,'2026-06-02',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:01.923','2026-05-13 11:17:34.559'),
('cmp3xjvxe0057tzssy5a4e5b0','cmp3xjltb002dtzssr0bkhan6',51,'2026-06-03',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:02.210','2026-05-13 11:17:34.559'),
('cmp3xjw8e0059tzssghc83nck','cmp3xjltb002dtzssr0bkhan6',52,'2026-06-04',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:02.607','2026-05-13 11:17:34.559'),
('cmp3xjwfc005btzssaudl57fl','cmp3xjltb002dtzssr0bkhan6',53,'2026-06-05',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:02.856','2026-05-13 11:17:34.559'),
('cmp3xjwm2005dtzssv5x37kur','cmp3xjltb002dtzssr0bkhan6',54,'2026-06-06',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:03.099','2026-05-13 11:17:34.559'),
('cmp3xjwps005ftzsszie7hqee','cmp3xjltb002dtzssr0bkhan6',55,'2026-06-07',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:03.232','2026-05-13 11:17:34.559'),
('cmp3xjx0f005htzssborzpj1c','cmp3xjltb002dtzssr0bkhan6',56,'2026-06-08',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:03.615','2026-05-13 11:17:34.559'),
('cmp3xjx4x005jtzssrird51ih','cmp3xjltb002dtzssr0bkhan6',57,'2026-06-09',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:03.777','2026-05-13 11:17:34.559'),
('cmp3xjxau005ltzssyhq4y9ua','cmp3xjltb002dtzssr0bkhan6',58,'2026-06-10',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:03.990','2026-05-13 11:17:34.559'),
('cmp3xjxh3005ntzssw6nzqjd8','cmp3xjltb002dtzssr0bkhan6',59,'2026-06-11',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:04.215','2026-05-13 11:17:34.559'),
('cmp3xjxpv005ptzss1nfddgm1','cmp3xjltb002dtzssr0bkhan6',60,'2026-06-12',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:04.532','2026-05-13 11:17:34.559'),
('cmp3xjxwm005rtzss375syiik','cmp3xjltb002dtzssr0bkhan6',61,'2026-06-13',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:04.774','2026-05-13 11:17:34.559'),
('cmp3xjy2u005ttzsswn859csn','cmp3xjltb002dtzssr0bkhan6',62,'2026-06-14',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:04.998','2026-05-13 11:17:34.559'),
('cmp3xjy9k005vtzss8vdeicts','cmp3xjltb002dtzssr0bkhan6',63,'2026-06-15',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:05.240','2026-05-13 11:17:34.559'),
('cmp3xjyh7005xtzss0ssh7izh','cmp3xjltb002dtzssr0bkhan6',64,'2026-06-16',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:05.515','2026-05-13 11:17:34.559'),
('cmp3xjyno005ztzssxyoxx202','cmp3xjltb002dtzssr0bkhan6',65,'2026-06-17',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:05.749','2026-05-13 11:17:34.559'),
('cmp3xjyue0061tzss912y7ay3','cmp3xjltb002dtzssr0bkhan6',66,'2026-06-18',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:05.990','2026-05-13 11:17:34.559'),
('cmp3xjyzy0063tzssffpgno4y','cmp3xjltb002dtzssr0bkhan6',67,'2026-06-19',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:06.191','2026-05-13 11:17:34.559'),
('cmp3xjz820065tzssfenfkf05','cmp3xjltb002dtzssr0bkhan6',68,'2026-06-20',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:06.483','2026-05-13 11:17:34.559'),
('cmp3xjzf80067tzssio39qayq','cmp3xjltb002dtzssr0bkhan6',69,'2026-06-21',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:06.741','2026-05-13 11:17:34.559'),
('cmp3xjzkk0069tzssxjqkr74t','cmp3xjltb002dtzssr0bkhan6',70,'2026-06-22',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:06.932','2026-05-13 11:17:34.559'),
('cmp3xjzqd006btzssxga4h3p3','cmp3xjltb002dtzssr0bkhan6',71,'2026-06-23',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:07.141','2026-05-13 11:17:34.559'),
('cmp3xjzu2006dtzssyu0kll6y','cmp3xjltb002dtzssr0bkhan6',72,'2026-06-24',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:07.274','2026-05-13 11:17:34.559'),
('cmp3xk02m006ftzsswyrkzn43','cmp3xjltb002dtzssr0bkhan6',73,'2026-06-25',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:07.582','2026-05-13 11:17:34.559'),
('cmp3xk0ai006htzssl3dni0oc','cmp3xjltb002dtzssr0bkhan6',74,'2026-06-26',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:07.866','2026-05-13 11:17:34.559'),
('cmp3xk0e7006jtzss3n8f19rz','cmp3xjltb002dtzssr0bkhan6',75,'2026-06-27',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:07.999','2026-05-13 11:17:34.559'),
('cmp3xk0l5006ltzssa1m67dos','cmp3xjltb002dtzssr0bkhan6',76,'2026-06-28',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:08.249','2026-05-13 11:17:34.559'),
('cmp3xk0un006ntzssf362huec','cmp3xjltb002dtzssr0bkhan6',77,'2026-06-29',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:08.591','2026-05-13 11:17:34.559'),
('cmp3xk10n006ptzss5yfx810p','cmp3xjltb002dtzssr0bkhan6',78,'2026-06-30',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:08.808','2026-05-13 11:17:34.559'),
('cmp3xk19p006rtzsspkxdigjv','cmp3xjltb002dtzssr0bkhan6',79,'2026-07-01',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:09.133','2026-05-13 11:17:34.559'),
('cmp3xk1hk006ttzss77xc0yev','cmp3xjltb002dtzssr0bkhan6',80,'2026-07-02',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:09.416','2026-05-13 11:17:34.559'),
('cmp3xk1p7006vtzssrifm59i3','cmp3xjltb002dtzssr0bkhan6',81,'2026-07-03',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:09.692','2026-05-13 11:17:34.559'),
('cmp3xk1uj006xtzss9rlwsegl','cmp3xjltb002dtzssr0bkhan6',82,'2026-07-04',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:09.883','2026-05-13 11:17:34.559'),
('cmp3xk21p006ztzss1k59bqrr','cmp3xjltb002dtzssr0bkhan6',83,'2026-07-05',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:10.142','2026-05-13 11:17:34.559'),
('cmp3xk2aa0071tzss3cu122p9','cmp3xjltb002dtzssr0bkhan6',84,'2026-07-06',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:10.450','2026-05-13 11:17:34.559'),
('cmp3xk2kr0073tzssm4mu2h2f','cmp3xjltb002dtzssr0bkhan6',85,'2026-07-07',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:10.827','2026-05-13 11:17:34.559'),
('cmp3xk2oe0075tzss62lb1q28','cmp3xjltb002dtzssr0bkhan6',86,'2026-07-08',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:10.958','2026-05-13 11:17:34.559'),
('cmp3xk2vc0077tzssjem1cl6w','cmp3xjltb002dtzssr0bkhan6',87,'2026-07-09',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:11.209','2026-05-13 11:17:34.559'),
('cmp3xk32n0079tzss4n75b1xf','cmp3xjltb002dtzssr0bkhan6',88,'2026-07-10',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:11.471','2026-05-13 11:17:34.559'),
('cmp3xk3c1007btzssope7uvtx','cmp3xjltb002dtzssr0bkhan6',89,'2026-07-11',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:11.809','2026-05-13 11:17:34.559'),
('cmp3xk3i9007dtzsse21b9p3t','cmp3xjltb002dtzssr0bkhan6',90,'2026-07-12',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:12.033','2026-05-13 11:17:34.559'),
('cmp3xk3m7007ftzssub0dplkq','cmp3xjltb002dtzssr0bkhan6',91,'2026-07-13',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:12.175','2026-05-13 11:17:34.559'),
('cmp3xk403007htzssf3dy8au0','cmp3xjltb002dtzssr0bkhan6',92,'2026-07-14',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:12.675','2026-05-13 11:17:34.559'),
('cmp3xk49d007jtzss5cizcc81','cmp3xjltb002dtzssr0bkhan6',93,'2026-07-15',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:13.009','2026-05-13 11:17:34.559'),
('cmp3xk4gr007ltzssq391tk9x','cmp3xjltb002dtzssr0bkhan6',94,'2026-07-16',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:13.275','2026-05-13 11:17:34.559'),
('cmp3xk4om007ntzssapmk7fhf','cmp3xjltb002dtzssr0bkhan6',95,'2026-07-17',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:13.559','2026-05-13 11:17:34.559'),
('cmp3xk4t9007ptzss79072hpj','cmp3xjltb002dtzssr0bkhan6',96,'2026-07-18',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:13.726','2026-05-13 11:17:34.559'),
('cmp3xk4yu007rtzss4nqt4cx0','cmp3xjltb002dtzssr0bkhan6',97,'2026-07-19',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:13.926','2026-05-13 11:17:34.559'),
('cmp3xk552007ttzss0g87wt6j','cmp3xjltb002dtzssr0bkhan6',98,'2026-07-20',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:14.151','2026-05-13 11:17:34.559'),
('cmp3xk5cy007vtzssi02gxzff','cmp3xjltb002dtzssr0bkhan6',99,'2026-07-21',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:14.435','2026-05-13 11:17:34.559'),
('cmp3xk5sg007xtzssbciq64oj','cmp3xjltb002dtzssr0bkhan6',100,'2026-07-22',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:14.993','2026-05-13 11:17:34.559'),
('cmp3xk6bg0081tzss2mhpb9bv','cmp3xk62e007ztzssprfp5nin',1,'2026-04-20',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:15.676','2026-05-13 11:21:52.338'),
('cmp3xk6id0083tzssqs7u0oc2','cmp3xk62e007ztzssprfp5nin',2,'2026-04-27',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:15.926','2026-05-13 11:21:52.338'),
('cmp3xk6ny0085tzss63vw20ro','cmp3xk62e007ztzssprfp5nin',3,'2026-05-04',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:16.126','2026-05-13 11:21:52.338'),
('cmp3xk6t90087tzssuomkycaw','cmp3xk62e007ztzssprfp5nin',4,'2026-05-11',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:16.317','2026-05-13 11:21:52.338'),
('cmp3xk7690089tzssa4quhdwj','cmp3xk62e007ztzssprfp5nin',5,'2026-05-18',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:16.785','2026-05-13 11:21:52.338'),
('cmp3xk7bj008btzssbsa6oqss','cmp3xk62e007ztzssprfp5nin',6,'2026-05-25',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:16.976','2026-05-13 11:21:52.338'),
('cmp3xk7h4008dtzssloea65pu','cmp3xk62e007ztzssprfp5nin',7,'2026-06-01',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:17.177','2026-05-13 11:21:52.338'),
('cmp3xk7ku008ftzss1tmgeszr','cmp3xk62e007ztzssprfp5nin',8,'2026-06-08',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:17.310','2026-05-13 11:21:52.338'),
('cmp3xk7so008htzssjruqzetg','cmp3xk62e007ztzssprfp5nin',9,'2026-06-15',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:17.593','2026-05-13 11:21:52.338'),
('cmp3xk82n008jtzsso330r5q6','cmp3xk62e007ztzssprfp5nin',10,'2026-06-22',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:17.951','2026-05-13 11:21:52.338'),
('cmp3xk86c008ltzsse65jre05','cmp3xk62e007ztzssprfp5nin',11,'2026-06-29',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:18.084','2026-05-13 11:21:52.338'),
('cmp3xk8db008ntzsskrmbv0kq','cmp3xk62e007ztzssprfp5nin',12,'2026-07-06',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:18.335','2026-05-13 11:21:52.338'),
('cmp3xk8mb008ptzssit0vt5hy','cmp3xk62e007ztzssprfp5nin',13,'2026-07-13',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:18.660','2026-05-13 11:21:52.338'),
('cmp3xk8q1008rtzssp79vzhmr','cmp3xk62e007ztzssprfp5nin',14,'2026-07-20',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:18.793','2026-05-13 11:21:52.338'),
('cmp3xk8x0008ttzssm3667abk','cmp3xk62e007ztzssprfp5nin',15,'2026-07-27',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:19.044','2026-05-13 11:21:52.338'),
('cmp3xk946008vtzssd22p4e5h','cmp3xk62e007ztzssprfp5nin',16,'2026-08-03',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:19.302','2026-05-13 11:21:52.338'),
('cmp3xk9c1008xtzss3j2quh86','cmp3xk62e007ztzssprfp5nin',17,'2026-08-10',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:19.585','2026-05-13 11:21:52.338'),
('cmp3xk9n5008ztzssdolk0a70','cmp3xk62e007ztzssprfp5nin',18,'2026-08-17',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:19.985','2026-05-13 11:21:52.338'),
('cmp3xk9tn0091tzss8s0y28f1','cmp3xk62e007ztzssprfp5nin',19,'2026-08-24',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:20.219','2026-05-13 11:21:52.338'),
('cmp3xk9xc0093tzssew1fgqtp','cmp3xk62e007ztzssprfp5nin',20,'2026-08-31',5500.00,5500.00,NULL,'paid','2026-05-13 11:21:52.337',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:20.352','2026-05-13 11:21:52.338'),
('cmp3xkaky0097tzssjbr3hkkz','cmp3xkafe0095tzssd9krqy6x',1,'2026-05-13',917.00,917.00,NULL,'paid','2026-05-13 10:42:21.000',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:21.202','2026-05-13 11:17:35.451'),
('cmp3xkaq90099tzss7yaxj3k7','cmp3xkafe0095tzssd9krqy6x',2,'2026-06-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:21.394','2026-05-13 11:17:35.451'),
('cmp3xkazj009btzssch0b3fpp','cmp3xkafe0095tzssd9krqy6x',3,'2026-07-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:21.727','2026-05-13 11:17:35.451'),
('cmp3xkb38009dtzsse1sg0krl','cmp3xkafe0095tzssd9krqy6x',4,'2026-08-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:21.860','2026-05-13 11:17:35.451'),
('cmp3xkb9y009ftzss7opabbyb','cmp3xkafe0095tzssd9krqy6x',5,'2026-09-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:22.103','2026-05-13 11:17:35.451'),
('cmp3xkbf9009htzssaytwpw3s','cmp3xkafe0095tzssd9krqy6x',6,'2026-10-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:22.294','2026-05-13 11:17:35.451'),
('cmp3xkboc009jtzss2fqrv06y','cmp3xkafe0095tzssd9krqy6x',7,'2026-11-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:22.620','2026-05-13 11:17:35.451'),
('cmp3xkbwe009ltzssbedd8d46','cmp3xkafe0095tzssd9krqy6x',8,'2026-12-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:22.910','2026-05-13 11:17:35.451'),
('cmp3xkc4a009ntzssf5yk6w59','cmp3xkafe0095tzssd9krqy6x',9,'2027-01-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:23.195','2026-05-13 11:17:35.451'),
('cmp3xkc9m009ptzssk0dqt6ip','cmp3xkafe0095tzssd9krqy6x',10,'2027-02-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:23.386','2026-05-13 11:17:35.451'),
('cmp3xkch1009rtzssn4rz2ayu','cmp3xkafe0095tzssd9krqy6x',11,'2027-03-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:23.653','2026-05-13 11:17:35.451'),
('cmp3xkcow009ttzssd0pz1ovp','cmp3xkafe0095tzssd9krqy6x',12,'2027-04-13',917.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:23.936','2026-05-13 11:17:35.451'),
('cmp3xkd7f009xtzssj1y1h8dq','cmp3xkd0p009vtzsseb8h2w1z',1,'2026-04-14',220.00,220.00,NULL,'paid','2026-05-14 13:50:58.382',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:24.604','2026-05-14 13:50:58.392'),
('cmp3xkdhu009ztzss6cey6sg7','cmp3xkd0p009vtzsseb8h2w1z',2,'2026-04-15',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:24.978','2026-05-14 13:50:58.399'),
('cmp3xkdmh00a1tzsse5wb050o','cmp3xkd0p009vtzsseb8h2w1z',3,'2026-04-16',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:25.145','2026-05-14 13:50:58.403'),
('cmp3xkdsp00a3tzssneknaf55','cmp3xkd0p009vtzsseb8h2w1z',4,'2026-04-17',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:25.369','2026-05-14 13:50:58.407'),
('cmp3xke0m00a5tzsslng29rr7','cmp3xkd0p009vtzsseb8h2w1z',5,'2026-04-18',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:25.654','2026-05-14 13:50:58.410'),
('cmp3xke8800a7tzss9l7mwtbs','cmp3xkd0p009vtzsseb8h2w1z',6,'2026-04-19',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:25.928','2026-05-14 13:50:58.414'),
('cmp3xkee800a9tzsssaf0o9xj','cmp3xkd0p009vtzsseb8h2w1z',7,'2026-04-20',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:26.145','2026-05-14 13:50:58.417'),
('cmp3xkejs00abtzssq9eq646x','cmp3xkd0p009vtzsseb8h2w1z',8,'2026-04-21',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:26.345','2026-05-14 13:50:58.420'),
('cmp3xkerz00adtzssgvm4oavh','cmp3xkd0p009vtzsseb8h2w1z',9,'2026-04-22',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:26.639','2026-05-14 13:50:58.424'),
('cmp3xkf0x00aftzss4mjh0cae','cmp3xkd0p009vtzsseb8h2w1z',10,'2026-04-23',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:26.961','2026-05-14 13:50:58.427'),
('cmp3xkf4n00ahtzssczpjxnap','cmp3xkd0p009vtzsseb8h2w1z',11,'2026-04-24',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:27.095','2026-05-14 13:50:58.430'),
('cmp3xkfc200ajtzss9u55jmmw','cmp3xkd0p009vtzsseb8h2w1z',12,'2026-04-25',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:27.362','2026-05-14 13:50:58.434'),
('cmp3xkfhm00altzssy2mvpmtf','cmp3xkd0p009vtzsseb8h2w1z',13,'2026-04-26',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:27.562','2026-05-14 13:50:58.439'),
('cmp3xkfph00antzssumi9rwsz','cmp3xkd0p009vtzsseb8h2w1z',14,'2026-04-27',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:27.845','2026-05-14 13:50:58.447'),
('cmp3xkft600aptzss1s9lz6vw','cmp3xkd0p009vtzsseb8h2w1z',15,'2026-04-28',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:27.978','2026-05-14 13:50:58.451'),
('cmp3xkfyr00artzssjdlcigi7','cmp3xkd0p009vtzsseb8h2w1z',16,'2026-04-29',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:28.179','2026-05-14 13:50:58.455'),
('cmp3xkg4200attzssmuhsngb7','cmp3xkd0p009vtzsseb8h2w1z',17,'2026-04-30',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:28.370','2026-05-14 13:50:58.459'),
('cmp3xkgas00avtzsskexfcnni','cmp3xkd0p009vtzsseb8h2w1z',18,'2026-05-01',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:28.612','2026-05-14 13:50:58.463'),
('cmp3xkgki00axtzssib9pbjyl','cmp3xkd0p009vtzsseb8h2w1z',19,'2026-05-02',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:28.963','2026-05-14 13:50:58.467'),
('cmp3xkgr700aztzsscwlz24mq','cmp3xkd0p009vtzsseb8h2w1z',20,'2026-05-03',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:29.204','2026-05-14 13:50:58.472'),
('cmp3xkgux00b1tzss4hoknvqt','cmp3xkd0p009vtzsseb8h2w1z',21,'2026-05-04',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:29.337','2026-05-14 13:50:58.475'),
('cmp3xkh3y00b3tzss7sgbq729','cmp3xkd0p009vtzsseb8h2w1z',22,'2026-05-05',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:29.663','2026-05-14 13:50:58.479'),
('cmp3xkhbd00b5tzssdv8fru6x','cmp3xkd0p009vtzsseb8h2w1z',23,'2026-05-06',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:29.929','2026-05-14 13:50:58.483'),
('cmp3xkhjp00b7tzssizgze6ok','cmp3xkd0p009vtzsseb8h2w1z',24,'2026-05-07',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:30.229','2026-05-14 13:50:58.486'),
('cmp3xkhne00b9tzssnmg1t584','cmp3xkd0p009vtzsseb8h2w1z',25,'2026-05-08',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:30.362','2026-05-14 13:50:58.490'),
('cmp3xkhva00bbtzss96c3krjr','cmp3xkd0p009vtzsseb8h2w1z',26,'2026-05-09',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:30.646','2026-05-14 13:50:58.494'),
('cmp3xki8p00bdtzsswqa2x5k6','cmp3xkd0p009vtzsseb8h2w1z',27,'2026-05-10',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:31.129','2026-05-14 13:50:58.497'),
('cmp3xkiff00bftzssrtbt1zln','cmp3xkd0p009vtzsseb8h2w1z',28,'2026-05-11',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:31.371','2026-05-14 13:50:58.501'),
('cmp3xkin200bhtzssnuzegg4o','cmp3xkd0p009vtzsseb8h2w1z',29,'2026-05-12',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:31.646','2026-05-14 13:50:58.504'),
('cmp3xkiuh00bjtzss0m50955s','cmp3xkd0p009vtzsseb8h2w1z',30,'2026-05-13',220.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:31.913','2026-05-14 13:50:58.507'),
('cmp3xkizs00bltzsse2kg6e12','cmp3xkd0p009vtzsseb8h2w1z',31,'2026-05-14',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:32.104','2026-05-14 13:50:58.511'),
('cmp3xkj5d00bntzss1mbg0u70','cmp3xkd0p009vtzsseb8h2w1z',32,'2026-05-15',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:32.305','2026-05-14 13:50:58.514'),
('cmp3xkj9200bptzssuasoqm56','cmp3xkd0p009vtzsseb8h2w1z',33,'2026-05-16',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:32.438','2026-05-14 13:50:58.518'),
('cmp3xkjgh00brtzssfdx9a7ua','cmp3xkd0p009vtzsseb8h2w1z',34,'2026-05-17',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:32.705','2026-05-14 13:50:58.521'),
('cmp3xkjoc00bttzssllggi3rb','cmp3xkd0p009vtzsseb8h2w1z',35,'2026-05-18',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:32.989','2026-05-14 13:50:58.525'),
('cmp3xkjtn00bvtzss816m5m4c','cmp3xkd0p009vtzsseb8h2w1z',36,'2026-05-19',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:33.179','2026-05-14 13:50:58.529'),
('cmp3xkjxd00bxtzsszcxotu05','cmp3xkd0p009vtzsseb8h2w1z',37,'2026-05-20',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:33.313','2026-05-14 13:50:58.533'),
('cmp3xkk2x00bztzssdvxtupyz','cmp3xkd0p009vtzsseb8h2w1z',38,'2026-05-21',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:33.513','2026-05-14 13:50:58.537'),
('cmp3xkk9v00c1tzsse44bprjo','cmp3xkd0p009vtzsseb8h2w1z',39,'2026-05-22',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:33.763','2026-05-14 13:50:58.540'),
('cmp3xkkff00c3tzssq41eu6e0','cmp3xkd0p009vtzsseb8h2w1z',40,'2026-05-23',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:33.964','2026-05-14 13:50:58.544'),
('cmp3xkkkr00c5tzss53qqr9eq','cmp3xkd0p009vtzsseb8h2w1z',41,'2026-05-24',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:34.155','2026-05-14 13:50:58.548'),
('cmp3xkkog00c7tzssltxuweyj','cmp3xkd0p009vtzsseb8h2w1z',42,'2026-05-25',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:34.288','2026-05-14 13:50:58.552'),
('cmp3xkku000c9tzsspr43rvot','cmp3xkd0p009vtzsseb8h2w1z',43,'2026-05-26',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:34.489','2026-05-14 13:50:58.555'),
('cmp3xkl0h00cbtzssk6q5z1pc','cmp3xkd0p009vtzsseb8h2w1z',44,'2026-05-27',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:34.722','2026-05-14 13:50:58.559'),
('cmp3xkl6200cdtzss83cbyh5f','cmp3xkd0p009vtzsseb8h2w1z',45,'2026-05-28',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:34.922','2026-05-14 13:50:58.563'),
('cmp3xkl9s00cftzssmb9c3roy','cmp3xkd0p009vtzsseb8h2w1z',46,'2026-05-29',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:35.056','2026-05-14 13:50:58.567'),
('cmp3xklf200chtzsso6q90cbf','cmp3xkd0p009vtzsseb8h2w1z',47,'2026-05-30',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:35.247','2026-05-14 13:50:58.571'),
('cmp3xkloc00cjtzssdqat2r5k','cmp3xkd0p009vtzsseb8h2w1z',48,'2026-05-31',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:35.581','2026-05-14 13:50:58.574'),
('cmp3xklx500cltzssn77zzaqm','cmp3xkd0p009vtzsseb8h2w1z',49,'2026-06-01',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:35.897','2026-05-14 13:50:58.578'),
('cmp3xkm0u00cntzss3fh29v1k','cmp3xkd0p009vtzsseb8h2w1z',50,'2026-06-02',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:36.030','2026-05-14 13:50:58.582'),
('cmp3xkm7s00cptzss0tudmaeg','cmp3xkd0p009vtzsseb8h2w1z',51,'2026-06-03',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:36.280','2026-05-14 13:50:58.584'),
('cmp3xkmdc00crtzssqaxg184x','cmp3xkd0p009vtzsseb8h2w1z',52,'2026-06-04',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:36.481','2026-05-14 13:50:58.588'),
('cmp3xkmlg00cttzss9t6xgbbk','cmp3xkd0p009vtzsseb8h2w1z',53,'2026-06-05',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:36.772','2026-05-14 13:50:58.592'),
('cmp3xkmu900cvtzssu932kjwn','cmp3xkd0p009vtzsseb8h2w1z',54,'2026-06-06',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:37.090','2026-05-14 13:50:58.596'),
('cmp3xkmxz00cxtzsssjup2i53','cmp3xkd0p009vtzsseb8h2w1z',55,'2026-06-07',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:37.223','2026-05-14 13:50:58.600'),
('cmp3xkn6j00cztzss81ciu5zl','cmp3xkd0p009vtzsseb8h2w1z',56,'2026-06-08',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:37.531','2026-05-14 13:50:58.603'),
('cmp3xkndx00d1tzssblmylkko','cmp3xkd0p009vtzsseb8h2w1z',57,'2026-06-09',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:37.798','2026-05-14 13:50:58.606'),
('cmp3xknkv00d3tzss38dczmj7','cmp3xkd0p009vtzsseb8h2w1z',58,'2026-06-10',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:38.047','2026-05-14 13:50:58.609'),
('cmp3xknol00d5tzss22cqkryp','cmp3xkd0p009vtzsseb8h2w1z',59,'2026-06-11',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:38.181','2026-05-14 13:50:58.613'),
('cmp3xknvr00d7tzssyni89w28','cmp3xkd0p009vtzsseb8h2w1z',60,'2026-06-12',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:38.439','2026-05-14 13:50:58.616'),
('cmp3xko6600d9tzssutzrte5b','cmp3xkd0p009vtzsseb8h2w1z',61,'2026-06-13',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:38.814','2026-05-14 13:50:58.619'),
('cmp3xkoe100dbtzsspegnvtc3','cmp3xkd0p009vtzsseb8h2w1z',62,'2026-06-14',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:39.098','2026-05-14 13:50:58.623'),
('cmp3xkojl00ddtzsst8um3fyd','cmp3xkd0p009vtzsseb8h2w1z',63,'2026-06-15',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:39.298','2026-05-14 13:50:58.629'),
('cmp3xkope00dftzssj4loptji','cmp3xkd0p009vtzsseb8h2w1z',64,'2026-06-16',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:39.507','2026-05-14 13:50:58.632'),
('cmp3xkovn00dhtzssbspvcxb4','cmp3xkd0p009vtzsseb8h2w1z',65,'2026-06-17',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:39.731','2026-05-14 13:50:58.636'),
('cmp3xkp3i00djtzsskgkkpsxu','cmp3xkd0p009vtzsseb8h2w1z',66,'2026-06-18',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:40.015','2026-05-14 13:50:58.639'),
('cmp3xkpah00dltzssawvlqm4f','cmp3xkd0p009vtzsseb8h2w1z',67,'2026-06-19',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:40.265','2026-05-14 13:50:58.642'),
('cmp3xkpe600dntzsswvto7d2d','cmp3xkd0p009vtzsseb8h2w1z',68,'2026-06-20',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:40.398','2026-05-14 13:50:58.645'),
('cmp3xkplt00dptzss19iephma','cmp3xkd0p009vtzsseb8h2w1z',69,'2026-06-21',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:40.673','2026-05-14 13:50:58.649'),
('cmp3xkptp00drtzsseq70ghok','cmp3xkd0p009vtzsseb8h2w1z',70,'2026-06-22',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:40.957','2026-05-14 13:50:58.653'),
('cmp3xkpz800dttzsszysth4pt','cmp3xkd0p009vtzsseb8h2w1z',71,'2026-06-23',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:41.156','2026-05-14 13:50:58.657'),
('cmp3xkq4t00dvtzss21hzfps7','cmp3xkd0p009vtzsseb8h2w1z',72,'2026-06-24',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:41.357','2026-05-14 13:50:58.661'),
('cmp3xkqe100dxtzss1klbveye','cmp3xkd0p009vtzsseb8h2w1z',73,'2026-06-25',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:41.690','2026-05-14 13:50:58.665'),
('cmp3xkqmm00dztzss04qa0d9k','cmp3xkd0p009vtzsseb8h2w1z',74,'2026-06-26',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:41.999','2026-05-14 13:50:58.668'),
('cmp3xkqqk00e1tzssis5b8gs8','cmp3xkd0p009vtzsseb8h2w1z',75,'2026-06-27',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:42.140','2026-05-14 13:50:58.671'),
('cmp3xkqw400e3tzsszrftznau','cmp3xkd0p009vtzsseb8h2w1z',76,'2026-06-28',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:42.340','2026-05-14 13:50:58.674'),
('cmp3xkr2o00e5tzssxmxye8x2','cmp3xkd0p009vtzsseb8h2w1z',77,'2026-06-29',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:42.576','2026-05-14 13:50:58.678'),
('cmp3xkrdh00e7tzssptplyre2','cmp3xkd0p009vtzsseb8h2w1z',78,'2026-06-30',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:42.965','2026-05-14 13:50:58.681'),
('cmp3xkrh600e9tzssj5h15s58','cmp3xkd0p009vtzsseb8h2w1z',79,'2026-07-01',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:43.099','2026-05-14 13:50:58.685'),
('cmp3xkrol00ebtzssdhk5ywkt','cmp3xkd0p009vtzsseb8h2w1z',80,'2026-07-02',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:43.366','2026-05-14 13:50:58.689'),
('cmp3xkru600edtzssqqpgbamr','cmp3xkd0p009vtzsseb8h2w1z',81,'2026-07-03',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:43.566','2026-05-14 13:50:58.693'),
('cmp3xks2900eftzssjmvvhg37','cmp3xkd0p009vtzsseb8h2w1z',82,'2026-07-04',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:43.857','2026-05-14 13:50:58.696'),
('cmp3xks7t00ehtzss494ye1nc','cmp3xkd0p009vtzsseb8h2w1z',83,'2026-07-05',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:44.057','2026-05-14 13:50:58.699'),
('cmp3xksbj00ejtzssz9l8elii','cmp3xkd0p009vtzsseb8h2w1z',84,'2026-07-06',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:44.191','2026-05-14 13:50:58.703'),
('cmp3xksju00eltzsso1vdap3k','cmp3xkd0p009vtzsseb8h2w1z',85,'2026-07-07',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:44.490','2026-05-14 13:50:58.706'),
('cmp3xkstc00entzss2y0txhrj','cmp3xkd0p009vtzsseb8h2w1z',86,'2026-07-08',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:44.832','2026-05-14 13:50:58.709'),
('cmp3xkt1700eptzssmbmjyx7l','cmp3xkd0p009vtzsseb8h2w1z',87,'2026-07-09',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:45.116','2026-05-14 13:50:58.713'),
('cmp3xkt4x00ertzssodgn2yf2','cmp3xkd0p009vtzsseb8h2w1z',88,'2026-07-10',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:45.249','2026-05-14 13:50:58.717'),
('cmp3xktdq00ettzsslviejkks','cmp3xkd0p009vtzsseb8h2w1z',89,'2026-07-11',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:45.566','2026-05-14 13:50:58.721'),
('cmp3xktk700evtzss8b9522yg','cmp3xkd0p009vtzsseb8h2w1z',90,'2026-07-12',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:45.799','2026-05-14 13:50:58.724'),
('cmp3xkts200extzssfihbf693','cmp3xkd0p009vtzsseb8h2w1z',91,'2026-07-13',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:46.083','2026-05-14 13:50:58.728'),
('cmp3xktxm00eztzssl56f4fdx','cmp3xkd0p009vtzsseb8h2w1z',92,'2026-07-14',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:46.283','2026-05-14 13:50:58.731'),
('cmp3xku3600f1tzssa4ym8j1s','cmp3xkd0p009vtzsseb8h2w1z',93,'2026-07-15',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:46.483','2026-05-14 13:50:58.734'),
('cmp3xkuba00f3tzsslyjhtxgm','cmp3xkd0p009vtzsseb8h2w1z',94,'2026-07-16',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:46.775','2026-05-14 13:50:58.738'),
('cmp3xkuip00f5tzssk8mmg154','cmp3xkd0p009vtzsseb8h2w1z',95,'2026-07-17',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:47.041','2026-05-14 13:50:58.741'),
('cmp3xkusf00f7tzss60qchzd5','cmp3xkd0p009vtzsseb8h2w1z',96,'2026-07-18',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:47.391','2026-05-14 13:50:58.744'),
('cmp3xkuzu00f9tzssf55m2y6j','cmp3xkd0p009vtzsseb8h2w1z',97,'2026-07-19',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:47.658','2026-05-14 13:50:58.748'),
('cmp3xkv7h00fbtzssdev5owgy','cmp3xkd0p009vtzsseb8h2w1z',98,'2026-07-20',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:47.933','2026-05-14 13:50:58.752'),
('cmp3xkvd100fdtzsse14lwx41','cmp3xkd0p009vtzsseb8h2w1z',99,'2026-07-21',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:48.133','2026-05-14 13:50:58.756'),
('cmp3xkvjq00fftzss8pv66fzb','cmp3xkd0p009vtzsseb8h2w1z',100,'2026-07-22',220.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:48.375','2026-05-14 13:50:58.759'),
('cmp3xkw5100fjtzsski0nni8o','cmp3xkvx600fhtzsskpfwt6dk',1,'2026-04-20',1650.00,1650.00,NULL,'paid','2026-04-20 10:42:48.857',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:49.141','2026-05-15 11:05:13.832'),
('cmp3xkw9g00fltzssbsduv0g3','cmp3xkvx600fhtzsskpfwt6dk',2,'2026-04-27',1650.00,0.00,NULL,'missed',NULL,NULL,'Edited by Admin: ',NULL,0,NULL,'2026-05-13 10:42:49.300','2026-05-15 11:05:13.834'),
('cmp3xkwgu00fntzssq92k589q','cmp3xkvx600fhtzsskpfwt6dk',3,'2026-05-04',1650.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:49.567','2026-05-15 11:05:13.835'),
('cmp3xkwoi00fptzssgk43kmbk','cmp3xkvx600fhtzsskpfwt6dk',4,'2026-05-11',1650.00,0.00,NULL,'missed',NULL,NULL,'Edited by Admin: ',NULL,0,NULL,'2026-05-13 10:42:49.842','2026-05-15 11:05:13.837'),
('cmp3xkwwd00frtzss75x4egly','cmp3xkvx600fhtzsskpfwt6dk',5,'2026-05-18',1650.00,0.00,NULL,'upcoming',NULL,NULL,'Edited by Admin: Edited by Admin: ',NULL,0,NULL,'2026-05-13 10:42:50.125','2026-05-15 11:05:13.838'),
('cmp3xkx3b00fttzssneqv5nmp','cmp3xkvx600fhtzsskpfwt6dk',6,'2026-05-25',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:50.375','2026-05-15 11:05:13.839'),
('cmp3xkxc900fvtzsso3m6uk4i','cmp3xkvx600fhtzsskpfwt6dk',7,'2026-06-01',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:50.698','2026-05-15 11:05:13.841'),
('cmp3xkxko00fxtzss7tzzu6nd','cmp3xkvx600fhtzsskpfwt6dk',8,'2026-06-08',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:51.000','2026-05-15 11:05:13.843'),
('cmp3xkxt800fztzssay5wupk3','cmp3xkvx600fhtzsskpfwt6dk',9,'2026-06-15',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:51.309','2026-05-15 11:05:13.845'),
('cmp3xkxys00g1tzsskmpcsc7l','cmp3xkvx600fhtzsskpfwt6dk',10,'2026-06-22',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:51.509','2026-05-15 11:05:13.847'),
('cmp3xky8o00g3tzsscgp91pov','cmp3xkvx600fhtzsskpfwt6dk',11,'2026-06-29',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:51.865','2026-05-15 11:05:13.848'),
('cmp3xkyde00g5tzss73885fkv','cmp3xkvx600fhtzsskpfwt6dk',12,'2026-07-06',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:52.034','2026-05-15 11:05:13.850'),
('cmp3xkykc00g7tzss5z6jlypw','cmp3xkvx600fhtzsskpfwt6dk',13,'2026-07-13',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:52.284','2026-05-15 11:05:13.851'),
('cmp3xkypv00g9tzss920v91d0','cmp3xkvx600fhtzsskpfwt6dk',14,'2026-07-20',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:52.484','2026-05-15 11:05:13.852'),
('cmp3xkyvg00gbtzss77y32ibv','cmp3xkvx600fhtzsskpfwt6dk',15,'2026-07-27',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:52.684','2026-05-15 11:05:13.854'),
('cmp3xkz4900gdtzssf5jski2x','cmp3xkvx600fhtzsskpfwt6dk',16,'2026-08-03',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:53.001','2026-05-15 11:05:13.855'),
('cmp3xkz7y00gftzss7bdc43cj','cmp3xkvx600fhtzsskpfwt6dk',17,'2026-08-10',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:53.134','2026-05-15 11:05:13.856'),
('cmp3xkzdi00ghtzss1klrkcsl','cmp3xkvx600fhtzsskpfwt6dk',18,'2026-08-17',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:53.334','2026-05-15 11:05:13.858'),
('cmp3xkzi600gjtzss1ooq9xbx','cmp3xkvx600fhtzsskpfwt6dk',19,'2026-08-24',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:53.503','2026-05-15 11:05:13.860'),
('cmp3xkzq700gltzsskztzt6zi','cmp3xkvx600fhtzsskpfwt6dk',20,'2026-08-31',1650.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:53.791','2026-05-15 11:05:13.863'),
('cmp3xl0an00gptzsscm2mmh83','cmp3xl01500gntzssy1rv6rs7',1,'2026-05-13',4583.00,4583.00,NULL,'paid','2026-05-13 10:42:54.183',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:54.527','2026-05-13 11:17:36.527'),
('cmp3xl0hy00grtzss582ngpky','cmp3xl01500gntzssy1rv6rs7',2,'2026-06-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:54.790','2026-05-13 11:17:36.527'),
('cmp3xl0pw00gttzss9x1czmyq','cmp3xl01500gntzssy1rv6rs7',3,'2026-07-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:55.076','2026-05-13 11:17:36.527'),
('cmp3xl0tl00gvtzssfano2sl1','cmp3xl01500gntzssy1rv6rs7',4,'2026-08-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:55.210','2026-05-13 11:17:36.527'),
('cmp3xl0z600gxtzssk5ca3592','cmp3xl01500gntzssy1rv6rs7',5,'2026-09-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:55.410','2026-05-13 11:17:36.527'),
('cmp3xl13k00gztzss05qajmt2','cmp3xl01500gntzssy1rv6rs7',6,'2026-10-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:55.568','2026-05-13 11:17:36.527'),
('cmp3xl17y00h1tzss8xbl8n7i','cmp3xl01500gntzssy1rv6rs7',7,'2026-11-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:55.726','2026-05-13 11:17:36.527'),
('cmp3xl1l500h3tzssu93ttn0n','cmp3xl01500gntzssy1rv6rs7',8,'2026-12-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:56.201','2026-05-13 11:17:36.527'),
('cmp3xl1qp00h5tzss1vywv0jl','cmp3xl01500gntzssy1rv6rs7',9,'2027-01-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:56.402','2026-05-13 11:17:36.527'),
('cmp3xl1w900h7tzssna2iyz7q','cmp3xl01500gntzssy1rv6rs7',10,'2027-02-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:56.602','2026-05-13 11:17:36.527'),
('cmp3xl1zz00h9tzss5pd2evrj','cmp3xl01500gntzssy1rv6rs7',11,'2027-03-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:56.735','2026-05-13 11:17:36.527'),
('cmp3xl2a600hbtzss4mxwu2c1','cmp3xl01500gntzssy1rv6rs7',12,'2027-04-13',4583.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:57.102','2026-05-13 11:17:36.527'),
('cmp3xl2qd00hftzssfwjesk2h','cmp3xl2kt00hdtzssvstmwquj',1,'2026-04-14',1100.00,1100.00,NULL,'paid','2026-04-14 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:57.685','2026-05-13 11:17:36.729'),
('cmp3xl2y000hhtzss2u60ldlv','cmp3xl2kt00hdtzssvstmwquj',2,'2026-04-15',1100.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:57.960','2026-05-13 11:17:36.729'),
('cmp3xl33k00hjtzss5358lsev','cmp3xl2kt00hdtzssvstmwquj',3,'2026-04-16',1100.00,1100.00,NULL,'paid','2026-04-16 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:58.160','2026-05-13 11:17:36.729'),
('cmp3xl39400hltzssait4nl64','cmp3xl2kt00hdtzssvstmwquj',4,'2026-04-17',1100.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:58.360','2026-05-13 11:17:36.729'),
('cmp3xl3g200hntzsskizxcnh7','cmp3xl2kt00hdtzssvstmwquj',5,'2026-04-18',1100.00,1100.00,NULL,'paid','2026-04-18 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:58.610','2026-05-13 11:17:36.729'),
('cmp3xl3n800hptzssd2rykn0c','cmp3xl2kt00hdtzssvstmwquj',6,'2026-04-19',1100.00,440.00,NULL,'partial','2026-04-19 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:58.868','2026-05-13 11:17:36.729'),
('cmp3xl3rn00hrtzsswdw5qv0t','cmp3xl2kt00hdtzssvstmwquj',7,'2026-04-20',1100.00,440.00,NULL,'partial','2026-04-20 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:59.027','2026-05-13 11:17:36.729'),
('cmp3xl3x700httzss4h5zbny2','cmp3xl2kt00hdtzssvstmwquj',8,'2026-04-21',1100.00,1100.00,NULL,'paid','2026-04-21 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:59.227','2026-05-13 11:17:36.729'),
('cmp3xl42r00hvtzsspx4umybz','cmp3xl2kt00hdtzssvstmwquj',9,'2026-04-22',1100.00,1100.00,NULL,'paid','2026-04-22 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:59.427','2026-05-13 11:17:36.729'),
('cmp3xl46h00hxtzssz2rqrzuc','cmp3xl2kt00hdtzssvstmwquj',10,'2026-04-23',1100.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:59.561','2026-05-13 11:17:36.729'),
('cmp3xl4ec00hztzssgoi71cxf','cmp3xl2kt00hdtzssvstmwquj',11,'2026-04-24',1100.00,440.00,NULL,'partial','2026-04-24 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:42:59.844','2026-05-13 11:17:36.729'),
('cmp3xl4nl00i1tzsszjcrshv7','cmp3xl2kt00hdtzssvstmwquj',12,'2026-04-25',1100.00,440.00,NULL,'partial','2026-04-25 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:00.178','2026-05-13 11:17:36.729'),
('cmp3xl4vx00i3tzss6wgoqssi','cmp3xl2kt00hdtzssvstmwquj',13,'2026-04-26',1100.00,440.00,NULL,'partial','2026-04-26 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:00.478','2026-05-13 11:17:36.729'),
('cmp3xl4zn00i5tzss39kn24v9','cmp3xl2kt00hdtzssvstmwquj',14,'2026-04-27',1100.00,1100.00,NULL,'paid','2026-04-27 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:00.611','2026-05-13 11:17:36.729'),
('cmp3xl5al00i7tzss8v6cg3gn','cmp3xl2kt00hdtzssvstmwquj',15,'2026-04-28',1100.00,1100.00,NULL,'paid','2026-04-28 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:01.005','2026-05-13 11:17:36.729'),
('cmp3xl5fd00i9tzssbd5g5rr4','cmp3xl2kt00hdtzssvstmwquj',16,'2026-04-29',1100.00,1100.00,NULL,'paid','2026-04-29 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:01.177','2026-05-13 11:17:36.729'),
('cmp3xl5j300ibtzssql1268nt','cmp3xl2kt00hdtzssvstmwquj',17,'2026-04-30',1100.00,1100.00,NULL,'paid','2026-04-30 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:01.311','2026-05-13 11:17:36.729'),
('cmp3xl5on00idtzss7o7fymdt','cmp3xl2kt00hdtzssvstmwquj',18,'2026-05-01',1100.00,1100.00,NULL,'paid','2026-05-01 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:01.511','2026-05-13 11:17:36.729'),
('cmp3xl5w100iftzss74r1t75y','cmp3xl2kt00hdtzssvstmwquj',19,'2026-05-02',1100.00,1100.00,NULL,'paid','2026-05-02 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:01.778','2026-05-13 11:17:36.729'),
('cmp3xl63g00ihtzssbvgc0k1b','cmp3xl2kt00hdtzssvstmwquj',20,'2026-05-03',1100.00,1100.00,NULL,'paid','2026-05-03 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:02.045','2026-05-13 11:17:36.729'),
('cmp3xl69z00ijtzsspsuyrwuc','cmp3xl2kt00hdtzssvstmwquj',21,'2026-05-04',1100.00,1100.00,NULL,'paid','2026-05-04 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:02.280','2026-05-13 11:17:36.729'),
('cmp3xl6fi00iltzss5agbxy44','cmp3xl2kt00hdtzssvstmwquj',22,'2026-05-05',1100.00,1100.00,NULL,'paid','2026-05-05 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:02.478','2026-05-13 11:17:36.729'),
('cmp3xl6nd00intzssou90b1p8','cmp3xl2kt00hdtzssvstmwquj',23,'2026-05-06',1100.00,440.00,NULL,'partial','2026-05-06 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:02.761','2026-05-13 11:17:36.729'),
('cmp3xl6wv00iptzssjyc6efrl','cmp3xl2kt00hdtzssvstmwquj',24,'2026-05-07',1100.00,440.00,NULL,'partial','2026-05-07 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:03.103','2026-05-13 11:17:36.729'),
('cmp3xl75o00irtzss7vioq68i','cmp3xl2kt00hdtzssvstmwquj',25,'2026-05-08',1100.00,440.00,NULL,'partial','2026-05-08 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:03.420','2026-05-13 11:17:36.729'),
('cmp3xl7ar00ittzssma6u5yds','cmp3xl2kt00hdtzssvstmwquj',26,'2026-05-09',1100.00,1100.00,NULL,'paid','2026-05-09 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:03.603','2026-05-13 11:17:36.729'),
('cmp3xl7pt00ivtzssdee68oav','cmp3xl2kt00hdtzssvstmwquj',27,'2026-05-10',1100.00,1100.00,NULL,'paid','2026-05-10 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:04.145','2026-05-13 11:17:36.729'),
('cmp3xl7x800ixtzss6hjny4wg','cmp3xl2kt00hdtzssvstmwquj',28,'2026-05-11',1100.00,1100.00,NULL,'paid','2026-05-11 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:04.412','2026-05-13 11:17:36.729'),
('cmp3xl84500iztzssz31yfezn','cmp3xl2kt00hdtzssvstmwquj',29,'2026-05-12',1100.00,440.00,NULL,'partial','2026-05-12 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:04.661','2026-05-13 11:17:36.729'),
('cmp3xl87u00j1tzsshc6ogztq','cmp3xl2kt00hdtzssvstmwquj',30,'2026-05-13',1100.00,1100.00,NULL,'paid','2026-05-13 10:42:57.484',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:04.795','2026-05-13 11:17:36.729'),
('cmp3xl8go00j3tzss5e883jur','cmp3xl2kt00hdtzssvstmwquj',31,'2026-05-14',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:05.112','2026-05-13 11:17:36.729'),
('cmp3xl8m800j5tzssliqrinac','cmp3xl2kt00hdtzssvstmwquj',32,'2026-05-15',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:05.312','2026-05-13 11:17:36.729'),
('cmp3xl8px00j7tzssf1hodicv','cmp3xl2kt00hdtzssvstmwquj',33,'2026-05-16',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:05.445','2026-05-13 11:17:36.729'),
('cmp3xl8vh00j9tzssn5xrz64u','cmp3xl2kt00hdtzssvstmwquj',34,'2026-05-17',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:05.645','2026-05-13 11:17:36.729'),
('cmp3xl8z600jbtzssqyh4c4ec','cmp3xl2kt00hdtzssvstmwquj',35,'2026-05-18',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:05.779','2026-05-13 11:17:36.729'),
('cmp3xl9a200jdtzss0iuxlqld','cmp3xl2kt00hdtzssvstmwquj',36,'2026-05-19',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:06.170','2026-05-13 11:17:36.729'),
('cmp3xl9eh00jftzsskc7mep4g','cmp3xl2kt00hdtzssvstmwquj',37,'2026-05-20',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:06.329','2026-05-13 11:17:36.729'),
('cmp3xl9lf00jhtzssdatw0gkb','cmp3xl2kt00hdtzssvstmwquj',38,'2026-05-21',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:06.579','2026-05-13 11:17:36.729'),
('cmp3xl9p400jjtzss1t2djj33','cmp3xl2kt00hdtzssvstmwquj',39,'2026-05-22',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:06.712','2026-05-13 11:17:36.729'),
('cmp3xl9z800jltzsspmipa749','cmp3xl2kt00hdtzssvstmwquj',40,'2026-05-23',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:07.077','2026-05-13 11:17:36.729'),
('cmp3xla6y00jntzssprzi59jq','cmp3xl2kt00hdtzssvstmwquj',41,'2026-05-24',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:07.354','2026-05-13 11:17:36.729'),
('cmp3xlaan00jptzssadf6yyzm','cmp3xl2kt00hdtzssvstmwquj',42,'2026-05-25',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:07.487','2026-05-13 11:17:36.729'),
('cmp3xlahl00jrtzssolxk2kco','cmp3xl2kt00hdtzssvstmwquj',43,'2026-05-26',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:07.737','2026-05-13 11:17:36.729'),
('cmp3xlaty00jttzssydgoognm','cmp3xl2kt00hdtzssvstmwquj',44,'2026-05-27',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:08.182','2026-05-13 11:17:36.729'),
('cmp3xlb1q00jvtzssre3glttv','cmp3xl2kt00hdtzssvstmwquj',45,'2026-05-28',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:08.462','2026-05-13 11:17:36.729'),
('cmp3xlb5g00jxtzsspna9gm70','cmp3xl2kt00hdtzssvstmwquj',46,'2026-05-29',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:08.596','2026-05-13 11:17:36.729'),
('cmp3xlbb000jztzss5uyhbclg','cmp3xl2kt00hdtzssvstmwquj',47,'2026-05-30',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:08.796','2026-05-13 11:17:36.729'),
('cmp3xlbjt00k1tzss9mu0jy0y','cmp3xl2kt00hdtzssvstmwquj',48,'2026-05-31',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:09.113','2026-05-13 11:17:36.729'),
('cmp3xlbr700k3tzssxceg07rh','cmp3xl2kt00hdtzssvstmwquj',49,'2026-06-01',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:09.380','2026-05-13 11:17:36.729'),
('cmp3xlbwr00k5tzssfw3w9slm','cmp3xl2kt00hdtzssvstmwquj',50,'2026-06-02',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:09.579','2026-05-13 11:17:36.729'),
('cmp3xlc2b00k7tzssanm45uou','cmp3xl2kt00hdtzssvstmwquj',51,'2026-06-03',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:09.780','2026-05-13 11:17:36.729'),
('cmp3xlc9i00k9tzss5lt769ti','cmp3xl2kt00hdtzssvstmwquj',52,'2026-06-04',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:10.038','2026-05-13 11:17:36.729'),
('cmp3xlcib00kbtzssxy6jyhvf','cmp3xl2kt00hdtzssvstmwquj',53,'2026-06-05',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:10.355','2026-05-13 11:17:36.729'),
('cmp3xlcpp00kdtzssrwvwwip4','cmp3xl2kt00hdtzssvstmwquj',54,'2026-06-06',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:10.621','2026-05-13 11:17:36.729'),
('cmp3xlctf00kftzss93x642z8','cmp3xl2kt00hdtzssvstmwquj',55,'2026-06-07',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:10.755','2026-05-13 11:17:36.729'),
('cmp3xld6600khtzssl4h11spx','cmp3xl2kt00hdtzssvstmwquj',56,'2026-06-08',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:11.214','2026-05-13 11:17:36.729'),
('cmp3xldcw00kjtzssalixfx2n','cmp3xl2kt00hdtzssvstmwquj',57,'2026-06-09',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:11.456','2026-05-13 11:17:36.729'),
('cmp3xldig00kltzsszh8s5usr','cmp3xl2kt00hdtzssvstmwquj',58,'2026-06-10',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:11.656','2026-05-13 11:17:36.729'),
('cmp3xldsd00kntzssi1bb1gxd','cmp3xl2kt00hdtzssvstmwquj',59,'2026-06-11',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:12.013','2026-05-13 11:17:36.729'),
('cmp3xle0y00kptzssi0yhftse','cmp3xl2kt00hdtzssvstmwquj',60,'2026-06-12',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:12.322','2026-05-13 11:17:36.729'),
('cmp3xle7w00krtzssxa1isv3r','cmp3xl2kt00hdtzssvstmwquj',61,'2026-06-13',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:12.572','2026-05-13 11:17:36.729'),
('cmp3xlegg00kttzss98bb9rq6','cmp3xl2kt00hdtzssvstmwquj',62,'2026-06-14',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:12.880','2026-05-13 11:17:36.729'),
('cmp3xlelb00kvtzssu3yhzgdp','cmp3xl2kt00hdtzssvstmwquj',63,'2026-06-15',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.055','2026-05-13 11:17:36.729'),
('cmp3xlenv00kxtzssv8g19fu8','cmp3xl2kt00hdtzssvstmwquj',64,'2026-06-16',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.147','2026-05-13 11:17:36.729'),
('cmp3xleqm00kztzsslzm2o4lw','cmp3xl2kt00hdtzssvstmwquj',65,'2026-06-17',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.247','2026-05-13 11:17:36.729'),
('cmp3xleuu00l1tzsss7yagejb','cmp3xl2kt00hdtzssvstmwquj',66,'2026-06-18',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.398','2026-05-13 11:17:36.729'),
('cmp3xlezw00l3tzsscedb3iu3','cmp3xl2kt00hdtzssvstmwquj',67,'2026-06-19',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.580','2026-05-13 11:17:36.729'),
('cmp3xlf1r00l5tzssu8lygrii','cmp3xl2kt00hdtzssvstmwquj',68,'2026-06-20',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.647','2026-05-13 11:17:36.729'),
('cmp3xlf3l00l7tzsspduf47iz','cmp3xl2kt00hdtzssvstmwquj',69,'2026-06-21',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.714','2026-05-13 11:17:36.729'),
('cmp3xlf5g00l9tzsskkrsy71j','cmp3xl2kt00hdtzssvstmwquj',70,'2026-06-22',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.780','2026-05-13 11:17:36.729'),
('cmp3xlf9400lbtzssml2wclwd','cmp3xl2kt00hdtzssvstmwquj',71,'2026-06-23',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:13.913','2026-05-13 11:17:36.729'),
('cmp3xlfe900ldtzssdmo95kup','cmp3xl2kt00hdtzssvstmwquj',72,'2026-06-24',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:14.097','2026-05-13 11:17:36.729'),
('cmp3xlfgb00lftzssa354w5pi','cmp3xl2kt00hdtzssvstmwquj',73,'2026-06-25',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:14.172','2026-05-13 11:17:36.729'),
('cmp3xlfj500lhtzssgevx5ijk','cmp3xl2kt00hdtzssvstmwquj',74,'2026-06-26',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:14.273','2026-05-13 11:17:36.729'),
('cmp3xlfl000ljtzss4odreq9d','cmp3xl2kt00hdtzssvstmwquj',75,'2026-06-27',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:14.340','2026-05-13 11:17:36.729'),
('cmp3xlfnq00lltzssnv0gmhw0','cmp3xl2kt00hdtzssvstmwquj',76,'2026-06-28',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:14.438','2026-05-13 11:17:36.729'),
('cmp3xlfu800lntzsstfnkfwln','cmp3xl2kt00hdtzssvstmwquj',77,'2026-06-29',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:14.672','2026-05-13 11:17:36.729'),
('cmp3xlfx100lptzsso83iqm95','cmp3xl2kt00hdtzssvstmwquj',78,'2026-06-30',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:14.774','2026-05-13 11:17:36.729'),
('cmp3xlg8s00lrtzsstyq4wcjb','cmp3xl2kt00hdtzssvstmwquj',79,'2026-07-01',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:15.196','2026-05-13 11:17:36.729'),
('cmp3xlgbv00lttzss5xq8n7a0','cmp3xl2kt00hdtzssvstmwquj',80,'2026-07-02',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:15.307','2026-05-13 11:17:36.729'),
('cmp3xlgjo00lvtzsslbd1fgk2','cmp3xl2kt00hdtzssvstmwquj',81,'2026-07-03',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:15.588','2026-05-13 11:17:36.729'),
('cmp3xlgob00lxtzss4uausktp','cmp3xl2kt00hdtzssvstmwquj',82,'2026-07-04',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:15.756','2026-05-13 11:17:36.729'),
('cmp3xlgq600lztzssn1qrpkmh','cmp3xl2kt00hdtzssvstmwquj',83,'2026-07-05',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:15.822','2026-05-13 11:17:36.729'),
('cmp3xlgvs00m1tzsshz2ru5ta','cmp3xl2kt00hdtzssvstmwquj',84,'2026-07-06',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:16.024','2026-05-13 11:17:36.729'),
('cmp3xlh2800m3tzss9vn23hcw','cmp3xl2kt00hdtzssvstmwquj',85,'2026-07-07',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:16.256','2026-05-13 11:17:36.729'),
('cmp3xlh5100m5tzssn5ljbyez','cmp3xl2kt00hdtzssvstmwquj',86,'2026-07-08',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:16.357','2026-05-13 11:17:36.729'),
('cmp3xlh7s00m7tzssk0fuek3h','cmp3xl2kt00hdtzssvstmwquj',87,'2026-07-09',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:16.456','2026-05-13 11:17:36.729'),
('cmp3xlhe100m9tzssvw3coyk3','cmp3xl2kt00hdtzssvstmwquj',88,'2026-07-10',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:16.681','2026-05-13 11:17:36.729'),
('cmp3xlhi800mbtzssq2sqfz9p','cmp3xl2kt00hdtzssvstmwquj',89,'2026-07-11',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:16.832','2026-05-13 11:17:36.729'),
('cmp3xlhlq00mdtzssb3kmnb9z','cmp3xl2kt00hdtzssvstmwquj',90,'2026-07-12',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:16.958','2026-05-13 11:17:36.729'),
('cmp3xlhqa00mftzss54bb9iu1','cmp3xl2kt00hdtzssvstmwquj',91,'2026-07-13',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:17.123','2026-05-13 11:17:36.729'),
('cmp3xlhs500mhtzssedzopxw0','cmp3xl2kt00hdtzssvstmwquj',92,'2026-07-14',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:17.189','2026-05-13 11:17:36.729'),
('cmp3xlhuz00mjtzssv59dgunb','cmp3xl2kt00hdtzssvstmwquj',93,'2026-07-15',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:17.291','2026-05-13 11:17:36.729'),
('cmp3xlhxp00mltzssqwpehj1r','cmp3xl2kt00hdtzssvstmwquj',94,'2026-07-16',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:17.389','2026-05-13 11:17:36.729'),
('cmp3xli1x00mntzsstmu3l633','cmp3xl2kt00hdtzssvstmwquj',95,'2026-07-17',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:17.541','2026-05-13 11:17:36.729'),
('cmp3xli5400mptzssldgytgzp','cmp3xl2kt00hdtzssvstmwquj',96,'2026-07-18',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:17.656','2026-05-13 11:17:36.729'),
('cmp3xli6z00mrtzss1fful4on','cmp3xl2kt00hdtzssvstmwquj',97,'2026-07-19',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:17.723','2026-05-13 11:17:36.729'),
('cmp3xli9s00mttzss2xm44es8','cmp3xl2kt00hdtzssvstmwquj',98,'2026-07-20',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:17.824','2026-05-13 11:17:36.729'),
('cmp3xlif200mvtzsssk40dyrz','cmp3xl2kt00hdtzssvstmwquj',99,'2026-07-21',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:18.014','2026-05-13 11:17:36.729'),
('cmp3xlii400mxtzsslamxzf5l','cmp3xl2kt00hdtzssvstmwquj',100,'2026-07-22',1100.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:18.125','2026-05-13 11:17:36.729'),
('cmp3xliq600n1tzss4edp48os','cmp3xlilu00mztzssczjvv4xr',1,'2026-04-20',550.00,550.00,NULL,'paid','2026-04-20 10:43:18.257',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:18.414','2026-05-13 11:17:36.935'),
('cmp3xlis100n3tzss80qdq0cb','cmp3xlilu00mztzssczjvv4xr',2,'2026-04-27',550.00,220.00,NULL,'partial','2026-04-27 10:43:18.257',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:18.481','2026-05-13 11:17:36.935'),
('cmp3xliuv00n5tzssrjrvfady','cmp3xlilu00mztzssczjvv4xr',3,'2026-05-04',550.00,550.00,NULL,'paid','2026-05-04 10:43:18.257',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:18.583','2026-05-13 11:17:36.935'),
('cmp3xliz700n7tzss9k416gbo','cmp3xlilu00mztzssczjvv4xr',4,'2026-05-11',550.00,220.00,NULL,'partial','2026-05-11 10:43:18.257',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:18.740','2026-05-13 11:17:36.935'),
('cmp3xlj1200n9tzss676n02j5','cmp3xlilu00mztzssczjvv4xr',5,'2026-05-18',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:18.806','2026-05-13 11:17:36.935'),
('cmp3xlj4k00nbtzss7f3vuepq','cmp3xlilu00mztzssczjvv4xr',6,'2026-05-25',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:18.932','2026-05-13 11:17:36.935'),
('cmp3xljb000ndtzssumnmq4y8','cmp3xlilu00mztzssczjvv4xr',7,'2026-06-01',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:19.164','2026-05-13 11:17:36.935'),
('cmp3xljeq00nftzsstqndzfln','cmp3xlilu00mztzssczjvv4xr',8,'2026-06-08',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:19.298','2026-05-13 11:17:36.935'),
('cmp3xljgk00nhtzss1u34xmd6','cmp3xlilu00mztzssczjvv4xr',9,'2026-06-15',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:19.365','2026-05-13 11:17:36.935'),
('cmp3xljlf00njtzssae2p6xp8','cmp3xlilu00mztzssczjvv4xr',10,'2026-06-22',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:19.540','2026-05-13 11:17:36.935'),
('cmp3xljna00nltzssdje205ii','cmp3xlilu00mztzssczjvv4xr',11,'2026-06-29',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:19.606','2026-05-13 11:17:36.935'),
('cmp3xljri00nntzssfqtilcsv','cmp3xlilu00mztzssczjvv4xr',12,'2026-07-06',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:19.758','2026-05-13 11:17:36.935'),
('cmp3xlju800nptzssui4s7lwe','cmp3xlilu00mztzssczjvv4xr',13,'2026-07-13',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:19.856','2026-05-13 11:17:36.935'),
('cmp3xlk0c00nrtzssbxi78g9g','cmp3xlilu00mztzssczjvv4xr',14,'2026-07-20',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:20.076','2026-05-13 11:17:36.935'),
('cmp3xlk5c00nttzssujqqp0aj','cmp3xlilu00mztzssczjvv4xr',15,'2026-07-27',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:20.256','2026-05-13 11:17:36.935'),
('cmp3xlk7700nvtzssryzz0io1','cmp3xlilu00mztzssczjvv4xr',16,'2026-08-03',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:20.323','2026-05-13 11:17:36.935'),
('cmp3xlka100nxtzsszbk2vsdh','cmp3xlilu00mztzssczjvv4xr',17,'2026-08-10',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:20.425','2026-05-13 11:17:36.935'),
('cmp3xlkcr00nztzsslo4j8kn9','cmp3xlilu00mztzssczjvv4xr',18,'2026-08-17',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:20.523','2026-05-13 11:17:36.935'),
('cmp3xlkft00o1tzsshllr6ztn','cmp3xlilu00mztzssczjvv4xr',19,'2026-08-24',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:20.633','2026-05-13 11:17:36.935'),
('cmp3xlkho00o3tzssu3v0yik4','cmp3xlilu00mztzssczjvv4xr',20,'2026-08-31',550.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:20.700','2026-05-13 11:17:36.935'),
('cmp3xlksk00o7tzss38vlwxjp','cmp3xlkor00o5tzss7v5xxzqy',1,'2026-05-13',1833.00,733.00,NULL,'partial','2026-05-13 10:43:20.954',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.092','2026-05-13 11:17:37.060'),
('cmp3xlkue00o9tzsswgeb6mbe','cmp3xlkor00o5tzss7v5xxzqy',2,'2026-06-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.159','2026-05-13 11:17:37.060'),
('cmp3xlkw900obtzsst3imj7yf','cmp3xlkor00o5tzss7v5xxzqy',3,'2026-07-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.225','2026-05-13 11:17:37.060'),
('cmp3xlkyz00odtzss6ucqv1ts','cmp3xlkor00o5tzss7v5xxzqy',4,'2026-08-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.323','2026-05-13 11:17:37.060'),
('cmp3xll1t00oftzssiek89sz4','cmp3xlkor00o5tzss7v5xxzqy',5,'2026-09-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.425','2026-05-13 11:17:37.060'),
('cmp3xll4j00ohtzss38ycm055','cmp3xlkor00o5tzss7v5xxzqy',6,'2026-10-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.523','2026-05-13 11:17:37.060'),
('cmp3xll8r00ojtzsskaaymhw9','cmp3xlkor00o5tzss7v5xxzqy',7,'2026-11-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.675','2026-05-13 11:17:37.060'),
('cmp3xllby00oltzssaaobzkvd','cmp3xlkor00o5tzss7v5xxzqy',8,'2026-12-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.790','2026-05-13 11:17:37.060'),
('cmp3xlldt00ontzssylljlkk8','cmp3xlkor00o5tzss7v5xxzqy',9,'2027-01-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.857','2026-05-13 11:17:37.060'),
('cmp3xllh700optzsszgi0vfl9','cmp3xlkor00o5tzss7v5xxzqy',10,'2027-02-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:21.979','2026-05-13 11:17:37.060'),
('cmp3xlllw00ortzssycxcunux','cmp3xlkor00o5tzss7v5xxzqy',11,'2027-03-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:22.149','2026-05-13 11:17:37.060'),
('cmp3xlloq00ottzssnom5zptk','cmp3xlkor00o5tzss7v5xxzqy',12,'2027-04-13',1833.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:22.250','2026-05-13 11:17:37.060'),
('cmp3xllw500oxtzssb681s0k6','cmp3xlltb00ovtzss6gpg8c8n',1,'2026-04-14',300.00,132.00,NULL,'partial','2026-04-14 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:22.517','2026-05-13 11:17:37.318'),
('cmp3xllyv00oztzssn0tm71i1','cmp3xlltb00ovtzss6gpg8c8n',2,'2026-04-15',300.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:22.615','2026-05-13 11:17:37.318'),
('cmp3xlm1p00p1tzssq3re3c3x','cmp3xlltb00ovtzss6gpg8c8n',3,'2026-04-16',300.00,330.00,NULL,'paid','2026-04-16 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:22.717','2026-05-13 11:17:37.318'),
('cmp3xlm4f00p3tzssl9oph44d','cmp3xlltb00ovtzss6gpg8c8n',4,'2026-04-17',300.00,330.00,NULL,'paid','2026-04-17 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:22.815','2026-05-13 11:17:37.318'),
('cmp3xlm6a00p5tzssck6lzovf','cmp3xlltb00ovtzss6gpg8c8n',5,'2026-04-18',300.00,330.00,NULL,'paid','2026-04-18 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:22.882','2026-05-13 11:17:37.318'),
('cmp3xlm9200p7tzssmk90io8r','cmp3xlltb00ovtzss6gpg8c8n',6,'2026-04-19',300.00,132.00,NULL,'partial','2026-04-19 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:22.982','2026-05-13 11:17:37.318'),
('cmp3xlmda00p9tzss6jax3g4o','cmp3xlltb00ovtzss6gpg8c8n',7,'2026-04-20',300.00,330.00,NULL,'paid','2026-04-20 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:23.134','2026-05-13 11:17:37.318'),
('cmp3xlmg000pbtzss5fj7iskh','cmp3xlltb00ovtzss6gpg8c8n',8,'2026-04-21',300.00,330.00,NULL,'paid','2026-04-21 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:23.233','2026-05-13 11:17:37.318'),
('cmp3xlmiu00pdtzsstd8j5bot','cmp3xlltb00ovtzss6gpg8c8n',9,'2026-04-22',300.00,330.00,NULL,'paid','2026-04-22 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:23.334','2026-05-13 11:17:37.318'),
('cmp3xlmlt00pftzssmzx819i6','cmp3xlltb00ovtzss6gpg8c8n',10,'2026-04-23',300.00,330.00,NULL,'paid','2026-04-23 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:23.441','2026-05-13 11:17:37.318'),
('cmp3xlmnn00phtzsshpt0dwtt','cmp3xlltb00ovtzss6gpg8c8n',11,'2026-04-24',300.00,330.00,NULL,'paid','2026-04-24 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:23.507','2026-05-13 11:17:37.318'),
('cmp3xlmqh00pjtzssazzmxcjc','cmp3xlltb00ovtzss6gpg8c8n',12,'2026-04-25',300.00,330.00,NULL,'paid','2026-04-25 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:23.609','2026-05-13 11:17:37.318'),
('cmp3xlmw700pltzssuhis73l2','cmp3xlltb00ovtzss6gpg8c8n',13,'2026-04-26',300.00,330.00,NULL,'paid','2026-04-26 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:23.815','2026-05-13 11:17:37.318'),
('cmp3xlmy200pntzssyuvuon9c','cmp3xlltb00ovtzss6gpg8c8n',14,'2026-04-27',300.00,330.00,NULL,'paid','2026-04-27 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:23.882','2026-05-13 11:17:37.318'),
('cmp3xln1i00pptzssln2dt6fd','cmp3xlltb00ovtzss6gpg8c8n',15,'2026-04-28',300.00,330.00,NULL,'paid','2026-04-28 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.006','2026-05-13 11:17:37.318'),
('cmp3xln4u00prtzsszxa52vef','cmp3xlltb00ovtzss6gpg8c8n',16,'2026-04-29',300.00,330.00,NULL,'paid','2026-04-29 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.126','2026-05-13 11:17:37.318'),
('cmp3xln6p00pttzssafqduk8w','cmp3xlltb00ovtzss6gpg8c8n',17,'2026-04-30',300.00,132.00,NULL,'partial','2026-04-30 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.193','2026-05-13 11:17:37.318'),
('cmp3xln8j00pvtzssvadn3k9r','cmp3xlltb00ovtzss6gpg8c8n',18,'2026-05-01',300.00,132.00,NULL,'partial','2026-05-01 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.259','2026-05-13 11:17:37.318'),
('cmp3xlnb900pxtzssqc6h37js','cmp3xlltb00ovtzss6gpg8c8n',19,'2026-05-02',300.00,132.00,NULL,'partial','2026-05-02 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.357','2026-05-13 11:17:37.318'),
('cmp3xlne300pztzssogignfxj','cmp3xlltb00ovtzss6gpg8c8n',20,'2026-05-03',300.00,330.00,NULL,'paid','2026-05-03 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.459','2026-05-13 11:17:37.318'),
('cmp3xlngt00q1tzss1ooo3oau','cmp3xlltb00ovtzss6gpg8c8n',21,'2026-05-04',300.00,132.00,NULL,'partial','2026-05-04 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.557','2026-05-13 11:17:37.318'),
('cmp3xlnio00q3tzss2vppxu1g','cmp3xlltb00ovtzss6gpg8c8n',22,'2026-05-05',300.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.624','2026-05-13 11:17:37.318'),
('cmp3xlnki00q5tzssqzdto3xm','cmp3xlltb00ovtzss6gpg8c8n',23,'2026-05-06',300.00,330.00,NULL,'paid','2026-05-06 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.691','2026-05-13 11:17:37.318'),
('cmp3xlnr000q7tzssy0smvvc6','cmp3xlltb00ovtzss6gpg8c8n',24,'2026-05-07',300.00,330.00,NULL,'paid','2026-05-07 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:24.924','2026-05-13 11:17:37.318'),
('cmp3xlnwk00q9tzssgvrmku2s','cmp3xlltb00ovtzss6gpg8c8n',25,'2026-05-08',300.00,132.00,NULL,'partial','2026-05-08 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:25.124','2026-05-13 11:17:37.318'),
('cmp3xlnyf00qbtzsserqjmya6','cmp3xlltb00ovtzss6gpg8c8n',26,'2026-05-09',300.00,132.00,NULL,'partial','2026-05-09 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:25.191','2026-05-13 11:17:37.318'),
('cmp3xlo1900qdtzss1wk6zcab','cmp3xlltb00ovtzss6gpg8c8n',27,'2026-05-10',300.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:25.293','2026-05-13 11:17:37.318'),
('cmp3xlo3300qftzss22it97jw','cmp3xlltb00ovtzss6gpg8c8n',28,'2026-05-11',300.00,330.00,NULL,'paid','2026-05-11 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:25.360','2026-05-13 11:17:37.318'),
('cmp3xlo5u00qhtzssp8xu98jb','cmp3xlltb00ovtzss6gpg8c8n',29,'2026-05-12',300.00,132.00,NULL,'partial','2026-05-12 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:25.458','2026-05-13 11:17:37.318'),
('cmp3xloa200qjtzssaxsyud5c','cmp3xlltb00ovtzss6gpg8c8n',30,'2026-05-13',300.00,132.00,NULL,'partial','2026-05-13 10:43:22.414',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:25.610','2026-05-13 11:17:37.318'),
('cmp3xloee00qltzss14ahvh40','cmp3xlltb00ovtzss6gpg8c8n',31,'2026-05-14',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:25.766','2026-05-13 11:17:37.318'),
('cmp3xlog800qntzss7xsvqbtv','cmp3xlltb00ovtzss6gpg8c8n',32,'2026-05-15',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:25.833','2026-05-13 11:17:37.318'),
('cmp3xlol600qptzsspyq83ieh','cmp3xlltb00ovtzss6gpg8c8n',33,'2026-05-16',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.010','2026-05-13 11:17:37.318'),
('cmp3xloqw00qrtzssf6prrz0j','cmp3xlltb00ovtzss6gpg8c8n',34,'2026-05-17',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.216','2026-05-13 11:17:37.318'),
('cmp3xlosq00qttzssflnnvw7o','cmp3xlltb00ovtzss6gpg8c8n',35,'2026-05-18',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.283','2026-05-13 11:17:37.318'),
('cmp3xlovk00qvtzssfrci5h88','cmp3xlltb00ovtzss6gpg8c8n',36,'2026-05-19',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.385','2026-05-13 11:17:37.318'),
('cmp3xloys00qxtzssbodyq7mp','cmp3xlltb00ovtzss6gpg8c8n',37,'2026-05-20',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.500','2026-05-13 11:17:37.318'),
('cmp3xlp1l00qztzss2dgstgv7','cmp3xlltb00ovtzss6gpg8c8n',38,'2026-05-21',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.602','2026-05-13 11:17:37.318'),
('cmp3xlp5j00r1tzssza3okb1m','cmp3xlltb00ovtzss6gpg8c8n',39,'2026-05-22',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.744','2026-05-13 11:17:37.318'),
('cmp3xlp8900r3tzssi52cgo5k','cmp3xlltb00ovtzss6gpg8c8n',40,'2026-05-23',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.841','2026-05-13 11:17:37.318'),
('cmp3xlpbi00r5tzssf019jzgi','cmp3xlltb00ovtzss6gpg8c8n',41,'2026-05-24',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:26.958','2026-05-13 11:17:37.318'),
('cmp3xlpfw00r7tzssq4zv9gl8','cmp3xlltb00ovtzss6gpg8c8n',42,'2026-05-25',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.116','2026-05-13 11:17:37.318'),
('cmp3xlpk400r9tzsssgqpcn2a','cmp3xlltb00ovtzss6gpg8c8n',43,'2026-05-26',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.268','2026-05-13 11:17:37.318'),
('cmp3xlpo800rbtzss4cednng3','cmp3xlltb00ovtzss6gpg8c8n',44,'2026-05-27',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.417','2026-05-13 11:17:37.318'),
('cmp3xlppv00rdtzssa7x2kyx3','cmp3xlltb00ovtzss6gpg8c8n',45,'2026-05-28',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.475','2026-05-13 11:17:37.318'),
('cmp3xlpt400rftzss9y2c0u75','cmp3xlltb00ovtzss6gpg8c8n',46,'2026-05-29',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.592','2026-05-13 11:17:37.318'),
('cmp3xlpvp00rhtzsspxmpxahw','cmp3xlltb00ovtzss6gpg8c8n',47,'2026-05-30',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.685','2026-05-13 11:17:37.318'),
('cmp3xlpyn00rjtzssh3mwt1dd','cmp3xlltb00ovtzss6gpg8c8n',48,'2026-05-31',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.792','2026-05-13 11:17:37.318'),
('cmp3xlq0a00rltzsskt4tilmp','cmp3xlltb00ovtzss6gpg8c8n',49,'2026-06-01',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.850','2026-05-13 11:17:37.318'),
('cmp3xlq4900rntzss0xtrjfy8','cmp3xlltb00ovtzss6gpg8c8n',50,'2026-06-02',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:27.994','2026-05-13 11:17:37.318'),
('cmp3xlq9b00rptzssfw9zjlmi','cmp3xlltb00ovtzss6gpg8c8n',51,'2026-06-03',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.175','2026-05-13 11:17:37.318'),
('cmp3xlqb500rrtzsse4cwevzw','cmp3xlltb00ovtzss6gpg8c8n',52,'2026-06-04',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.241','2026-05-13 11:17:37.318'),
('cmp3xlqd000rttzss66qmiprp','cmp3xlltb00ovtzss6gpg8c8n',53,'2026-06-05',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.308','2026-05-13 11:17:37.318'),
('cmp3xlqfm00rvtzss7bt5qe9z','cmp3xlltb00ovtzss6gpg8c8n',54,'2026-06-06',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.402','2026-05-13 11:17:37.318'),
('cmp3xlqjq00rxtzssk9lcqg08','cmp3xlltb00ovtzss6gpg8c8n',55,'2026-06-07',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.550','2026-05-13 11:17:37.318'),
('cmp3xlqlc00rztzss2npeilpr','cmp3xlltb00ovtzss6gpg8c8n',56,'2026-06-08',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.609','2026-05-13 11:17:37.318'),
('cmp3xlqny00s1tzssfoa7f4vz','cmp3xlltb00ovtzss6gpg8c8n',57,'2026-06-09',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.702','2026-05-13 11:17:37.318'),
('cmp3xlqpt00s3tzssgeyym2m3','cmp3xlltb00ovtzss6gpg8c8n',58,'2026-06-10',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.769','2026-05-13 11:17:37.318'),
('cmp3xlqrn00s5tzss4k2l7hvi','cmp3xlltb00ovtzss6gpg8c8n',59,'2026-06-11',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:28.835','2026-05-13 11:17:37.318'),
('cmp3xlqy000s7tzssex292sn4','cmp3xlltb00ovtzss6gpg8c8n',60,'2026-06-12',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.065','2026-05-13 11:17:37.318'),
('cmp3xlr2900s9tzssd8ba7y0t','cmp3xlltb00ovtzss6gpg8c8n',61,'2026-06-13',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.217','2026-05-13 11:17:37.318'),
('cmp3xlr6000sbtzsszzdtq86y','cmp3xlltb00ovtzss6gpg8c8n',62,'2026-06-14',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.352','2026-05-13 11:17:37.318'),
('cmp3xlr7v00sdtzssifqk9htz','cmp3xlltb00ovtzss6gpg8c8n',63,'2026-06-15',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.419','2026-05-13 11:17:37.318'),
('cmp3xlrbz00sftzssczmsviqf','cmp3xlltb00ovtzss6gpg8c8n',64,'2026-06-16',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.567','2026-05-13 11:17:37.318'),
('cmp3xlrdl00shtzsszv16jvzd','cmp3xlltb00ovtzss6gpg8c8n',65,'2026-06-17',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.626','2026-05-13 11:17:37.318'),
('cmp3xlrf800sjtzssdi44wkpf','cmp3xlltb00ovtzss6gpg8c8n',66,'2026-06-18',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.684','2026-05-13 11:17:37.318'),
('cmp3xlrkf00sltzssve563yah','cmp3xlltb00ovtzss6gpg8c8n',67,'2026-06-19',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.872','2026-05-13 11:17:37.318'),
('cmp3xlrnb00sntzssy06a3m0b','cmp3xlltb00ovtzss6gpg8c8n',68,'2026-06-20',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:29.975','2026-05-13 11:17:37.318'),
('cmp3xlrpu00sptzssse7c19il','cmp3xlltb00ovtzss6gpg8c8n',69,'2026-06-21',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:30.067','2026-05-13 11:17:37.318'),
('cmp3xlru900srtzssvkvmh54d','cmp3xlltb00ovtzss6gpg8c8n',70,'2026-06-22',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:30.225','2026-05-13 11:17:37.318'),
('cmp3xlrvv00sttzss90j905dl','cmp3xlltb00ovtzss6gpg8c8n',71,'2026-06-23',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:30.284','2026-05-13 11:17:37.318'),
('cmp3xlrxi00svtzssdt9dl7j3','cmp3xlltb00ovtzss6gpg8c8n',72,'2026-06-24',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:30.342','2026-05-13 11:17:37.318'),
('cmp3xls6b00sxtzssohga2w1y','cmp3xlltb00ovtzss6gpg8c8n',73,'2026-06-25',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:30.659','2026-05-13 11:17:37.318'),
('cmp3xls8w00sztzssh4m69uqp','cmp3xlltb00ovtzss6gpg8c8n',74,'2026-06-26',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:30.753','2026-05-13 11:17:37.318'),
('cmp3xlsex00t1tzssxeroo5en','cmp3xlltb00ovtzss6gpg8c8n',75,'2026-06-27',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:30.969','2026-05-13 11:17:37.318'),
('cmp3xlsgq00t3tzss72h3tr2a','cmp3xlltb00ovtzss6gpg8c8n',76,'2026-06-28',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.034','2026-05-13 11:17:37.318'),
('cmp3xlsl400t5tzss1a8505ab','cmp3xlltb00ovtzss6gpg8c8n',77,'2026-06-29',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.193','2026-05-13 11:17:37.318'),
('cmp3xlson00t7tzssivt7o12h','cmp3xlltb00ovtzss6gpg8c8n',78,'2026-06-30',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.319','2026-05-13 11:17:37.318'),
('cmp3xlsr500t9tzssiyl9qrkk','cmp3xlltb00ovtzss6gpg8c8n',79,'2026-07-01',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.409','2026-05-13 11:17:37.318'),
('cmp3xlstq00tbtzsszredhk3e','cmp3xlltb00ovtzss6gpg8c8n',80,'2026-07-02',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.503','2026-05-13 11:17:37.318'),
('cmp3xlsvl00tdtzsszor6x2hl','cmp3xlltb00ovtzss6gpg8c8n',81,'2026-07-03',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.570','2026-05-13 11:17:37.318'),
('cmp3xlsxg00tftzssu228mdpo','cmp3xlltb00ovtzss6gpg8c8n',82,'2026-07-04',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.636','2026-05-13 11:17:37.318'),
('cmp3xlszx00thtzsshnuu7tnr','cmp3xlltb00ovtzss6gpg8c8n',83,'2026-07-05',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.725','2026-05-13 11:17:37.318'),
('cmp3xlt1k00tjtzsstnzpq1l1','cmp3xlltb00ovtzss6gpg8c8n',84,'2026-07-06',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.784','2026-05-13 11:17:37.318'),
('cmp3xlt6p00tltzssu622bnu1','cmp3xlltb00ovtzss6gpg8c8n',85,'2026-07-07',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:31.970','2026-05-13 11:17:37.318'),
('cmp3xlt9100tntzssdumoxg2g','cmp3xlltb00ovtzss6gpg8c8n',86,'2026-07-08',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.053','2026-05-13 11:17:37.318'),
('cmp3xltc100tptzss0qrn8o0i','cmp3xlltb00ovtzss6gpg8c8n',87,'2026-07-09',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.161','2026-05-13 11:17:37.318'),
('cmp3xltdw00trtzss5gj069up','cmp3xlltb00ovtzss6gpg8c8n',88,'2026-07-10',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.228','2026-05-13 11:17:37.318'),
('cmp3xltfq00tttzss0ms9oorw','cmp3xlltb00ovtzss6gpg8c8n',89,'2026-07-11',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.295','2026-05-13 11:17:37.318'),
('cmp3xlti800tvtzss4nzrlntu','cmp3xlltb00ovtzss6gpg8c8n',90,'2026-07-12',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.384','2026-05-13 11:17:37.318'),
('cmp3xltju00txtzss961ecp7s','cmp3xlltb00ovtzss6gpg8c8n',91,'2026-07-13',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.443','2026-05-13 11:17:37.318'),
('cmp3xltnu00tztzssxit9xj83','cmp3xlltb00ovtzss6gpg8c8n',92,'2026-07-14',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.587','2026-05-13 11:17:37.318'),
('cmp3xltqb00u1tzssvpthp49k','cmp3xlltb00ovtzss6gpg8c8n',93,'2026-07-15',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.676','2026-05-13 11:17:37.318'),
('cmp3xltry00u3tzssezl16r6n','cmp3xlltb00ovtzss6gpg8c8n',94,'2026-07-16',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.734','2026-05-13 11:17:37.318'),
('cmp3xltuk00u5tzssprsvh9k4','cmp3xlltb00ovtzss6gpg8c8n',95,'2026-07-17',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.828','2026-05-13 11:17:37.318'),
('cmp3xlty700u7tzssc2nztyvv','cmp3xlltb00ovtzss6gpg8c8n',96,'2026-07-18',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:32.959','2026-05-13 11:17:37.318'),
('cmp3xlu3z00u9tzssjeiae9y3','cmp3xlltb00ovtzss6gpg8c8n',97,'2026-07-19',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:33.168','2026-05-13 11:17:37.318'),
('cmp3xlu7200ubtzssmuyy0xd8','cmp3xlltb00ovtzss6gpg8c8n',98,'2026-07-20',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:33.278','2026-05-13 11:17:37.318'),
('cmp3xluck00udtzss33adcag2','cmp3xlltb00ovtzss6gpg8c8n',99,'2026-07-21',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:33.476','2026-05-13 11:17:37.318'),
('cmp3xlue600uftzssuaqk7dn9','cmp3xlltb00ovtzss6gpg8c8n',100,'2026-07-22',300.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:33.534','2026-05-13 11:17:37.318'),
('cmp3xluma00ujtzssdfkop6vu','cmp3xluko00uhtzssuiit0wqb',1,'2026-04-20',2750.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:33.826','2026-05-13 11:17:37.529'),
('cmp3xluqo00ultzss08jkvy0v','cmp3xluko00uhtzssuiit0wqb',2,'2026-04-27',2750.00,1100.00,NULL,'partial','2026-04-27 10:43:33.767',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:33.985','2026-05-13 11:17:37.529'),
('cmp3xlutz00untzssw5uqseiz','cmp3xluko00uhtzssuiit0wqb',3,'2026-05-04',2750.00,2750.00,NULL,'paid','2026-05-04 10:43:33.767',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:34.104','2026-05-13 11:17:37.529'),
('cmp3xluzq00uptzss2y4qh3om','cmp3xluko00uhtzssuiit0wqb',4,'2026-05-11',2750.00,2750.00,NULL,'paid','2026-05-11 10:43:33.767',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:34.310','2026-05-13 11:17:37.529'),
('cmp3xlv1m00urtzssz8i5caus','cmp3xluko00uhtzssuiit0wqb',5,'2026-05-18',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:34.378','2026-05-13 11:17:37.529'),
('cmp3xlv5k00uttzss7sv81dtq','cmp3xluko00uhtzssuiit0wqb',6,'2026-05-25',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:34.520','2026-05-13 11:17:37.529'),
('cmp3xlvbr00uvtzsstrglfnwv','cmp3xluko00uhtzssuiit0wqb',7,'2026-06-01',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:34.743','2026-05-13 11:17:37.529'),
('cmp3xlvdd00uxtzsski11tq7o','cmp3xluko00uhtzssuiit0wqb',8,'2026-06-08',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:34.801','2026-05-13 11:17:37.529'),
('cmp3xlvfz00uztzsscp4mr5vt','cmp3xluko00uhtzssuiit0wqb',9,'2026-06-15',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:34.895','2026-05-13 11:17:37.529'),
('cmp3xlvig00v1tzss4r4fthli','cmp3xluko00uhtzssuiit0wqb',10,'2026-06-22',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:34.984','2026-05-13 11:17:37.529'),
('cmp3xlvlr00v3tzsstjkrovcr','cmp3xluko00uhtzssuiit0wqb',11,'2026-06-29',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.104','2026-05-13 11:17:37.529'),
('cmp3xlvos00v5tzss6mw8e7e8','cmp3xluko00uhtzssuiit0wqb',12,'2026-07-06',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.212','2026-05-13 11:17:37.529'),
('cmp3xlvqn00v7tzss16mk24kt','cmp3xluko00uhtzssuiit0wqb',13,'2026-07-13',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.279','2026-05-13 11:17:37.529'),
('cmp3xlvsh00v9tzssd94pl63c','cmp3xluko00uhtzssuiit0wqb',14,'2026-07-20',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.345','2026-05-13 11:17:37.529'),
('cmp3xlvuy00vbtzssvlf3pycx','cmp3xluko00uhtzssuiit0wqb',15,'2026-07-27',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.435','2026-05-13 11:17:37.529'),
('cmp3xlvwl00vdtzssa7pyc20t','cmp3xluko00uhtzssuiit0wqb',16,'2026-08-03',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.493','2026-05-13 11:17:37.529'),
('cmp3xlvy700vftzsswae6097k','cmp3xluko00uhtzssuiit0wqb',17,'2026-08-10',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.551','2026-05-13 11:17:37.529'),
('cmp3xlw2u00vhtzssu3u2yu03','cmp3xluko00uhtzssuiit0wqb',18,'2026-08-17',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.718','2026-05-13 11:17:37.529'),
('cmp3xlw6u00vjtzsspi7rc3uh','cmp3xluko00uhtzssuiit0wqb',19,'2026-08-24',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.862','2026-05-13 11:17:37.529'),
('cmp3xlw8p00vltzsswqfze1kf','cmp3xluko00uhtzssuiit0wqb',20,'2026-08-31',2750.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:35.929','2026-05-13 11:17:37.529'),
('cmp3xlwi400vptzsss78w5w06','cmp3xlwdq00vntzssssb0b13u',1,'2026-05-13',9167.00,3667.00,NULL,'partial','2026-05-13 10:43:36.109',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:36.268','2026-05-13 11:17:37.727'),
('cmp3xlwnz00vrtzsstwt86hu3','cmp3xlwdq00vntzssssb0b13u',2,'2026-06-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:36.479','2026-05-13 11:17:37.727'),
('cmp3xlwsb00vttzss728u6o07','cmp3xlwdq00vntzssssb0b13u',3,'2026-07-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:36.635','2026-05-13 11:17:37.727'),
('cmp3xlwux00vvtzssvw9mq3nc','cmp3xlwdq00vntzssssb0b13u',4,'2026-08-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:36.729','2026-05-13 11:17:37.727'),
('cmp3xlwzt00vxtzssqbwy48bn','cmp3xlwdq00vntzssssb0b13u',5,'2026-09-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:36.905','2026-05-13 11:17:37.727'),
('cmp3xlx1m00vztzss5mc8y1yi','cmp3xlwdq00vntzssssb0b13u',6,'2026-10-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:36.971','2026-05-13 11:17:37.727'),
('cmp3xlx4400w1tzsstwrn6c01','cmp3xlwdq00vntzssssb0b13u',7,'2026-11-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:37.060','2026-05-13 11:17:37.727'),
('cmp3xlxaf00w3tzssa4xxyvyf','cmp3xlwdq00vntzssssb0b13u',8,'2026-12-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:37.288','2026-05-13 11:17:37.727'),
('cmp3xlxd500w5tzssbvbfkshv','cmp3xlwdq00vntzssssb0b13u',9,'2027-01-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:37.385','2026-05-13 11:17:37.727'),
('cmp3xlxfr00w7tzss3ag2hrnc','cmp3xlwdq00vntzssssb0b13u',10,'2027-02-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:37.479','2026-05-13 11:17:37.727'),
('cmp3xlxi800w9tzssk2fqlc3d','cmp3xlwdq00vntzssssb0b13u',11,'2027-03-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:37.568','2026-05-13 11:17:37.727'),
('cmp3xlxjv00wbtzsspm1jmd8i','cmp3xlwdq00vntzssssb0b13u',12,'2027-04-13',9167.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:37.627','2026-05-13 11:17:37.727'),
('cmp3xlxwf00wftzss5kk38ejy','cmp3xlxtt00wdtzss301t93n9',1,'2026-04-14',110.00,44.00,NULL,'partial','2026-04-14 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.080','2026-05-13 11:17:37.929'),
('cmp3xlxzu00whtzssyl5ngmgj','cmp3xlxtt00wdtzss301t93n9',2,'2026-04-15',110.00,110.00,NULL,'paid','2026-04-15 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.202','2026-05-13 11:17:37.929'),
('cmp3xly4800wjtzss849ckfwd','cmp3xlxtt00wdtzss301t93n9',3,'2026-04-16',110.00,110.00,NULL,'paid','2026-04-16 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.361','2026-05-13 11:17:37.929'),
('cmp3xly7900wltzssc643d6se','cmp3xlxtt00wdtzss301t93n9',4,'2026-04-17',110.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.469','2026-05-13 11:17:37.929'),
('cmp3xly8v00wntzss727dbdsz','cmp3xlxtt00wdtzss301t93n9',5,'2026-04-18',110.00,110.00,NULL,'paid','2026-04-18 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.527','2026-05-13 11:17:37.929'),
('cmp3xlyah00wptzsslt4gypwi','cmp3xlxtt00wdtzss301t93n9',6,'2026-04-19',110.00,110.00,NULL,'paid','2026-04-19 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.586','2026-05-13 11:17:37.929'),
('cmp3xlyd300wrtzsskwenxni2','cmp3xlxtt00wdtzss301t93n9',7,'2026-04-20',110.00,44.00,NULL,'partial','2026-04-20 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.679','2026-05-13 11:17:37.929'),
('cmp3xlyft00wttzss1vv7vu93','cmp3xlxtt00wdtzss301t93n9',8,'2026-04-21',110.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.778','2026-05-13 11:17:37.929'),
('cmp3xlyho00wvtzsspxfw5w0d','cmp3xlxtt00wdtzss301t93n9',9,'2026-04-22',110.00,110.00,NULL,'paid','2026-04-22 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.844','2026-05-13 11:17:37.929'),
('cmp3xlyk600wxtzssfatatr17','cmp3xlxtt00wdtzss301t93n9',10,'2026-04-23',110.00,44.00,NULL,'partial','2026-04-23 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:38.935','2026-05-13 11:17:37.929'),
('cmp3xlymr00wztzsshwwmhhle','cmp3xlxtt00wdtzss301t93n9',11,'2026-04-24',110.00,110.00,NULL,'paid','2026-04-24 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.028','2026-05-13 11:17:37.929'),
('cmp3xlyom00x1tzss1gj5rnc7','cmp3xlxtt00wdtzss301t93n9',12,'2026-04-25',110.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.094','2026-05-13 11:17:37.929'),
('cmp3xlysk00x3tzsshgrg0d3s','cmp3xlxtt00wdtzss301t93n9',13,'2026-04-26',110.00,110.00,NULL,'paid','2026-04-26 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.236','2026-05-13 11:17:37.929'),
('cmp3xlyue00x5tzss0i1cjlor','cmp3xlxtt00wdtzss301t93n9',14,'2026-04-27',110.00,110.00,NULL,'paid','2026-04-27 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.303','2026-05-13 11:17:37.929'),
('cmp3xlyw900x7tzss9qbnwtr7','cmp3xlxtt00wdtzss301t93n9',15,'2026-04-28',110.00,110.00,NULL,'paid','2026-04-28 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.369','2026-05-13 11:17:37.929'),
('cmp3xlyyr00x9tzssi04yvx4s','cmp3xlxtt00wdtzss301t93n9',16,'2026-04-29',110.00,110.00,NULL,'paid','2026-04-29 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.460','2026-05-13 11:17:37.929'),
('cmp3xlz0m00xbtzsskzve0l2e','cmp3xlxtt00wdtzss301t93n9',17,'2026-04-30',110.00,110.00,NULL,'paid','2026-04-30 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.526','2026-05-13 11:17:37.929'),
('cmp3xlz3w00xdtzss0phvnpgc','cmp3xlxtt00wdtzss301t93n9',18,'2026-05-01',110.00,110.00,NULL,'paid','2026-05-01 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.644','2026-05-13 11:17:37.929'),
('cmp3xlz5q00xftzssh5cuwlef','cmp3xlxtt00wdtzss301t93n9',19,'2026-05-02',110.00,110.00,NULL,'paid','2026-05-02 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.711','2026-05-13 11:17:37.929'),
('cmp3xlz8900xhtzssxm1ajg0h','cmp3xlxtt00wdtzss301t93n9',20,'2026-05-03',110.00,44.00,NULL,'partial','2026-05-03 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.801','2026-05-13 11:17:37.929'),
('cmp3xlzau00xjtzssjt62kdjk','cmp3xlxtt00wdtzss301t93n9',21,'2026-05-04',110.00,44.00,NULL,'partial','2026-05-04 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.894','2026-05-13 11:17:37.929'),
('cmp3xlzcp00xltzssugr15xi4','cmp3xlxtt00wdtzss301t93n9',22,'2026-05-05',110.00,44.00,NULL,'partial','2026-05-05 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:39.961','2026-05-13 11:17:37.929'),
('cmp3xlzg500xntzss2n0o1938','cmp3xlxtt00wdtzss301t93n9',23,'2026-05-06',110.00,0.00,NULL,'missed',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.086','2026-05-13 11:17:37.929'),
('cmp3xlzl000xptzss4x1ega4t','cmp3xlxtt00wdtzss301t93n9',24,'2026-05-07',110.00,44.00,NULL,'partial','2026-05-07 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.260','2026-05-13 11:17:37.929'),
('cmp3xlzmv00xrtzss6i9kun06','cmp3xlxtt00wdtzss301t93n9',25,'2026-05-08',110.00,44.00,NULL,'partial','2026-05-08 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.327','2026-05-13 11:17:37.929'),
('cmp3xlzop00xttzss0cpudu2o','cmp3xlxtt00wdtzss301t93n9',26,'2026-05-09',110.00,110.00,NULL,'paid','2026-05-09 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.393','2026-05-13 11:17:37.929'),
('cmp3xlzrq00xvtzssf9zw61va','cmp3xlxtt00wdtzss301t93n9',27,'2026-05-10',110.00,110.00,NULL,'paid','2026-05-10 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.503','2026-05-13 11:17:37.929'),
('cmp3xlztl00xxtzss3g40bz8d','cmp3xlxtt00wdtzss301t93n9',28,'2026-05-11',110.00,110.00,NULL,'paid','2026-05-11 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.569','2026-05-13 11:17:37.929'),
('cmp3xlzy700xztzssomgkv84k','cmp3xlxtt00wdtzss301t93n9',29,'2026-05-12',110.00,110.00,NULL,'paid','2026-05-12 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.736','2026-05-13 11:17:37.929'),
('cmp3xm00200y1tzssaljfztgi','cmp3xlxtt00wdtzss301t93n9',30,'2026-05-13',110.00,110.00,NULL,'paid','2026-05-13 10:43:37.984',NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.803','2026-05-13 11:17:37.929'),
('cmp3xm02l00y3tzss8tawfzui','cmp3xlxtt00wdtzss301t93n9',31,'2026-05-14',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.893','2026-05-13 11:17:37.929'),
('cmp3xm05600y5tzss4utbjfqx','cmp3xlxtt00wdtzss301t93n9',32,'2026-05-15',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:40.986','2026-05-13 11:17:37.929'),
('cmp3xm07000y7tzsslpq6ph5m','cmp3xlxtt00wdtzss301t93n9',33,'2026-05-16',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:41.053','2026-05-13 11:17:37.929'),
('cmp3xm0ct00y9tzss71n98pke','cmp3xlxtt00wdtzss301t93n9',34,'2026-05-17',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:41.261','2026-05-13 11:17:37.929'),
('cmp3xm0hn00ybtzsslivc4veb','cmp3xlxtt00wdtzss301t93n9',35,'2026-05-18',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:41.435','2026-05-13 11:17:37.929'),
('cmp3xm0kg00ydtzss36z0bq6b','cmp3xlxtt00wdtzss301t93n9',36,'2026-05-19',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:41.536','2026-05-13 11:17:37.929'),
('cmp3xm0pz00yftzsspkpr4k1l','cmp3xlxtt00wdtzss301t93n9',37,'2026-05-20',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:41.735','2026-05-13 11:17:37.929'),
('cmp3xm0sk00yhtzssngq7wg4k','cmp3xlxtt00wdtzss301t93n9',38,'2026-05-21',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:41.828','2026-05-13 11:17:37.929'),
('cmp3xm0ue00yjtzss7ipmast9','cmp3xlxtt00wdtzss301t93n9',39,'2026-05-22',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:41.895','2026-05-13 11:17:37.929'),
('cmp3xm0wx00yltzsswu4ty4a8','cmp3xlxtt00wdtzss301t93n9',40,'2026-05-23',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:41.985','2026-05-13 11:17:37.929'),
('cmp3xm0zi00yntzssv4kok21h','cmp3xlxtt00wdtzss301t93n9',41,'2026-05-24',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.078','2026-05-13 11:17:37.929'),
('cmp3xm12a00yptzsskqvprh16','cmp3xlxtt00wdtzss301t93n9',42,'2026-05-25',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.178','2026-05-13 11:17:37.929'),
('cmp3xm15h00yrtzssl2ttream','cmp3xlxtt00wdtzss301t93n9',43,'2026-05-26',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.294','2026-05-13 11:17:37.929'),
('cmp3xm18a00yttzssxsi3cdk5','cmp3xlxtt00wdtzss301t93n9',44,'2026-05-27',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.395','2026-05-13 11:17:37.929'),
('cmp3xm1a500yvtzssy6z2wpbz','cmp3xlxtt00wdtzss301t93n9',45,'2026-05-28',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.461','2026-05-13 11:17:37.929'),
('cmp3xm1er00yxtzss5hn5yivo','cmp3xlxtt00wdtzss301t93n9',46,'2026-05-29',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.627','2026-05-13 11:17:37.929'),
('cmp3xm1gm00yztzssv326diay','cmp3xlxtt00wdtzss301t93n9',47,'2026-05-30',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.694','2026-05-13 11:17:37.929'),
('cmp3xm1ig00z1tzssmdpfh60h','cmp3xlxtt00wdtzss301t93n9',48,'2026-05-31',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.761','2026-05-13 11:17:37.929'),
('cmp3xm1l100z3tzssqiidma6r','cmp3xlxtt00wdtzss301t93n9',49,'2026-06-01',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.853','2026-05-13 11:17:37.929'),
('cmp3xm1nk00z5tzss88hr3m0g','cmp3xlxtt00wdtzss301t93n9',50,'2026-06-02',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:42.944','2026-05-13 11:17:37.929'),
('cmp3xm1pe00z7tzsskod81ki2','cmp3xlxtt00wdtzss301t93n9',51,'2026-06-03',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.011','2026-05-13 11:17:37.929'),
('cmp3xm1r900z9tzssuhz4sh4i','cmp3xlxtt00wdtzss301t93n9',52,'2026-06-04',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.077','2026-05-13 11:17:37.929'),
('cmp3xm1uz00zbtzssa1hekluk','cmp3xlxtt00wdtzss301t93n9',53,'2026-06-05',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.211','2026-05-13 11:17:37.929'),
('cmp3xm20300zdtzss86h1ghcz','cmp3xlxtt00wdtzss301t93n9',54,'2026-06-06',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.395','2026-05-13 11:17:37.929'),
('cmp3xm21x00zftzssod4xmh3s','cmp3xlxtt00wdtzss301t93n9',55,'2026-06-07',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.461','2026-05-13 11:17:37.929'),
('cmp3xm27x00zhtzssyry3hxvg','cmp3xlxtt00wdtzss301t93n9',56,'2026-06-08',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.678','2026-05-13 11:17:37.929'),
('cmp3xm29s00zjtzssa1c0gjds','cmp3xlxtt00wdtzss301t93n9',57,'2026-06-09',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.744','2026-05-13 11:17:37.929'),
('cmp3xm2dz00zltzssg8qpq1v6','cmp3xlxtt00wdtzss301t93n9',58,'2026-06-10',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.895','2026-05-13 11:17:37.929'),
('cmp3xm2fu00zntzssm8xx32kr','cmp3xlxtt00wdtzss301t93n9',59,'2026-06-11',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:43.962','2026-05-13 11:17:37.929'),
('cmp3xm2ic00zptzssm8bh5zjh','cmp3xlxtt00wdtzss301t93n9',60,'2026-06-12',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:44.053','2026-05-13 11:17:37.929'),
('cmp3xm2lv00zrtzss534l2f3k','cmp3xlxtt00wdtzss301t93n9',61,'2026-06-13',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:44.179','2026-05-13 11:17:37.929'),
('cmp3xm2rv00zttzss267lscnh','cmp3xlxtt00wdtzss301t93n9',62,'2026-06-14',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:44.395','2026-05-13 11:17:37.929'),
('cmp3xm2tq00zvtzsssxoitxuk','cmp3xlxtt00wdtzss301t93n9',63,'2026-06-15',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:44.462','2026-05-13 11:17:37.929'),
('cmp3xm2y900zxtzssoxjv0cfa','cmp3xlxtt00wdtzss301t93n9',64,'2026-06-16',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:44.625','2026-05-13 11:17:37.929'),
('cmp3xm30n00zztzssc3k0ojwm','cmp3xlxtt00wdtzss301t93n9',65,'2026-06-17',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:44.711','2026-05-13 11:17:37.929'),
('cmp3xm3680101tzssuc9jdjrf','cmp3xlxtt00wdtzss301t93n9',66,'2026-06-18',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:44.912','2026-05-13 11:17:37.929'),
('cmp3xm3dc0103tzssgnmyn5l1','cmp3xlxtt00wdtzss301t93n9',67,'2026-06-19',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:45.168','2026-05-13 11:17:37.929'),
('cmp3xm3kp0105tzssdca300v7','cmp3xlxtt00wdtzss301t93n9',68,'2026-06-20',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:45.434','2026-05-13 11:17:37.929'),
('cmp3xm3nk0107tzss5ha5msw2','cmp3xlxtt00wdtzss301t93n9',69,'2026-06-21',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:45.537','2026-05-13 11:17:37.929'),
('cmp3xm3r90109tzssaa7bh351','cmp3xlxtt00wdtzss301t93n9',70,'2026-06-22',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:45.670','2026-05-13 11:17:37.929'),
('cmp3xm3t4010btzsskpw0zivn','cmp3xlxtt00wdtzss301t93n9',71,'2026-06-23',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:45.736','2026-05-13 11:17:37.929'),
('cmp3xm3wd010dtzssr74szamx','cmp3xlxtt00wdtzss301t93n9',72,'2026-06-24',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:45.853','2026-05-13 11:17:37.929'),
('cmp3xm41x010ftzsspglvi8k7','cmp3xlxtt00wdtzss301t93n9',73,'2026-06-25',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.054','2026-05-13 11:17:37.929'),
('cmp3xm43s010htzssmi1z98lu','cmp3xlxtt00wdtzss301t93n9',74,'2026-06-26',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.121','2026-05-13 11:17:37.929'),
('cmp3xm48m010jtzss5l53d7di','cmp3xlxtt00wdtzss301t93n9',75,'2026-06-27',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.295','2026-05-13 11:17:37.929'),
('cmp3xm4bv010ltzssp4uygnc7','cmp3xlxtt00wdtzss301t93n9',76,'2026-06-28',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.412','2026-05-13 11:17:37.929'),
('cmp3xm4ft010ntzssb2auese1','cmp3xlxtt00wdtzss301t93n9',77,'2026-06-29',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.554','2026-05-13 11:17:37.929'),
('cmp3xm4iu010ptzss66nnukgn','cmp3xlxtt00wdtzss301t93n9',78,'2026-06-30',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.662','2026-05-13 11:17:37.929'),
('cmp3xm4ld010rtzssno4af3f6','cmp3xlxtt00wdtzss301t93n9',79,'2026-07-01',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.753','2026-05-13 11:17:37.929'),
('cmp3xm4ol010ttzss9wjgtqcx','cmp3xlxtt00wdtzss301t93n9',80,'2026-07-02',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.870','2026-05-13 11:17:37.929'),
('cmp3xm4qg010vtzss7j5qkuq3','cmp3xlxtt00wdtzss301t93n9',81,'2026-07-03',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:46.936','2026-05-13 11:17:37.929'),
('cmp3xm4tp010xtzsst8iz7bpo','cmp3xlxtt00wdtzss301t93n9',82,'2026-07-04',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:47.053','2026-05-13 11:17:37.929'),
('cmp3xm4yq010ztzss0sy8o52k','cmp3xlxtt00wdtzss301t93n9',83,'2026-07-05',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:47.235','2026-05-13 11:17:37.929'),
('cmp3xm55a0111tzss46jr85ag','cmp3xlxtt00wdtzss301t93n9',84,'2026-07-06',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:47.471','2026-05-13 11:17:37.929'),
('cmp3xm5900113tzssz74hn886','cmp3xlxtt00wdtzss301t93n9',85,'2026-07-07',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:47.604','2026-05-13 11:17:37.929'),
('cmp3xm5cx0115tzssqaz2feo6','cmp3xlxtt00wdtzss301t93n9',86,'2026-07-08',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:47.745','2026-05-13 11:17:37.929'),
('cmp3xm5g60117tzss2ut9oivv','cmp3xlxtt00wdtzss301t93n9',87,'2026-07-09',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:47.862','2026-05-13 11:17:37.929'),
('cmp3xm5iq0119tzssq40eoxi4','cmp3xlxtt00wdtzss301t93n9',88,'2026-07-10',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:47.954','2026-05-13 11:17:37.929'),
('cmp3xm5kk011btzss4t82y113','cmp3xlxtt00wdtzss301t93n9',89,'2026-07-11',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.021','2026-05-13 11:17:37.929'),
('cmp3xm5q9011dtzssrpj81est','cmp3xlxtt00wdtzss301t93n9',90,'2026-07-12',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.226','2026-05-13 11:17:37.929'),
('cmp3xm5v0011ftzss8s3qrusa','cmp3xlxtt00wdtzss301t93n9',91,'2026-07-13',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.396','2026-05-13 11:17:37.929'),
('cmp3xm5xj011htzsscley9wby','cmp3xlxtt00wdtzss301t93n9',92,'2026-07-14',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.487','2026-05-13 11:17:37.929'),
('cmp3xm60b011jtzsserw0583x','cmp3xlxtt00wdtzss301t93n9',93,'2026-07-15',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.588','2026-05-13 11:17:37.929'),
('cmp3xm626011ltzss83eno68t','cmp3xlxtt00wdtzss301t93n9',94,'2026-07-16',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.654','2026-05-13 11:17:37.929'),
('cmp3xm64p011ntzss71oqjujy','cmp3xlxtt00wdtzss301t93n9',95,'2026-07-17',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.745','2026-05-13 11:17:37.929'),
('cmp3xm694011ptzssq5qq6ydm','cmp3xlxtt00wdtzss301t93n9',96,'2026-07-18',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.904','2026-05-13 11:17:37.929'),
('cmp3xm6az011rtzssl38riahq','cmp3xlxtt00wdtzss301t93n9',97,'2026-07-19',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:48.971','2026-05-13 11:17:37.929'),
('cmp3xm6di011ttzss8rrrxfx0','cmp3xlxtt00wdtzss301t93n9',98,'2026-07-20',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:49.062','2026-05-13 11:17:37.929'),
('cmp3xm6g2011vtzss8kuhwpfi','cmp3xlxtt00wdtzss301t93n9',99,'2026-07-21',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:49.155','2026-05-13 11:17:37.929'),
('cmp3xm6im011xtzss9caozd8a','cmp3xlxtt00wdtzss301t93n9',100,'2026-07-22',110.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-13 10:43:49.246','2026-05-13 11:17:37.929'),
('cmp5jnvfe003e12atct7rlng8','cmp5jnvfd003d12atqahjbbxa',1,'2026-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003f12at71e4smme','cmp5jnvfd003d12atqahjbbxa',2,'2026-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003g12atneyaastc','cmp5jnvfd003d12atqahjbbxa',3,'2026-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003h12ativjdrb2d','cmp5jnvfd003d12atqahjbbxa',4,'2026-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003i12at5rnyw7co','cmp5jnvfd003d12atqahjbbxa',5,'2026-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003j12at65nmqk42','cmp5jnvfd003d12atqahjbbxa',6,'2026-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003k12ata32sgc16','cmp5jnvfd003d12atqahjbbxa',7,'2026-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003l12atxl6r7gzc','cmp5jnvfd003d12atqahjbbxa',8,'2026-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003m12atndb14l67','cmp5jnvfd003d12atqahjbbxa',9,'2027-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003n12at7nn3coox','cmp5jnvfd003d12atqahjbbxa',10,'2027-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003o12atlxf0sr5t','cmp5jnvfd003d12atqahjbbxa',11,'2027-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003p12atq40uzuss','cmp5jnvfd003d12atqahjbbxa',12,'2027-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003q12atzku46168','cmp5jnvfd003d12atqahjbbxa',13,'2027-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003r12at9aj71dz0','cmp5jnvfd003d12atqahjbbxa',14,'2027-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003s12atsejt7p8b','cmp5jnvfd003d12atqahjbbxa',15,'2027-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003t12atq1l6we4y','cmp5jnvfd003d12atqahjbbxa',16,'2027-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003u12atv23bjo3l','cmp5jnvfd003d12atqahjbbxa',17,'2027-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003v12atw1mvvhjb','cmp5jnvfd003d12atqahjbbxa',18,'2027-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003w12atcmxddfc0','cmp5jnvfd003d12atqahjbbxa',19,'2027-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003x12at9fsdx950','cmp5jnvfd003d12atqahjbbxa',20,'2027-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003y12at1u2ojqu2','cmp5jnvfd003d12atqahjbbxa',21,'2028-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe003z12atc2wx10k5','cmp5jnvfd003d12atqahjbbxa',22,'2028-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe004012at4sf6g7zg','cmp5jnvfd003d12atqahjbbxa',23,'2028-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe004112atgb4go951','cmp5jnvfd003d12atqahjbbxa',24,'2028-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe004212ati291skbz','cmp5jnvfd003d12atqahjbbxa',25,'2028-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe004312atudqp2hp8','cmp5jnvfd003d12atqahjbbxa',26,'2028-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe004412atsgc0lbv0','cmp5jnvfd003d12atqahjbbxa',27,'2028-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfe004512at39v2koe0','cmp5jnvfd003d12atqahjbbxa',28,'2028-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004612atywioj0y6','cmp5jnvfd003d12atqahjbbxa',29,'2028-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004712at1yn52xt7','cmp5jnvfd003d12atqahjbbxa',30,'2028-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004812at7p9mu58r','cmp5jnvfd003d12atqahjbbxa',31,'2028-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004912at8li6yo6l','cmp5jnvfd003d12atqahjbbxa',32,'2028-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004a12at4kvvfjy4','cmp5jnvfd003d12atqahjbbxa',33,'2029-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004b12att767j1f9','cmp5jnvfd003d12atqahjbbxa',34,'2029-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004c12at6iw5462x','cmp5jnvfd003d12atqahjbbxa',35,'2029-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004d12at7ef23umf','cmp5jnvfd003d12atqahjbbxa',36,'2029-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004e12atu16uxwg9','cmp5jnvfd003d12atqahjbbxa',37,'2029-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004f12atm0wp75vq','cmp5jnvfd003d12atqahjbbxa',38,'2029-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004g12atfdebmb9x','cmp5jnvfd003d12atqahjbbxa',39,'2029-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004h12atv6zwkpv9','cmp5jnvfd003d12atqahjbbxa',40,'2029-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004i12at1mn9v7ox','cmp5jnvfd003d12atqahjbbxa',41,'2029-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004j12atxua3l2yy','cmp5jnvfd003d12atqahjbbxa',42,'2029-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004k12atrnzepko9','cmp5jnvfd003d12atqahjbbxa',43,'2029-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004l12atgvw831jd','cmp5jnvfd003d12atqahjbbxa',44,'2029-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004m12at99z1t22m','cmp5jnvfd003d12atqahjbbxa',45,'2030-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004n12atw4a660ij','cmp5jnvfd003d12atqahjbbxa',46,'2030-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004o12atz6u3aozv','cmp5jnvfd003d12atqahjbbxa',47,'2030-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004p12atza3w7s0y','cmp5jnvfd003d12atqahjbbxa',48,'2030-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004q12atlv4ybsoq','cmp5jnvfd003d12atqahjbbxa',49,'2030-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004r12at5m3vj4sx','cmp5jnvfd003d12atqahjbbxa',50,'2030-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004s12atgs79e6nc','cmp5jnvfd003d12atqahjbbxa',51,'2030-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004t12atghj9zm6m','cmp5jnvfd003d12atqahjbbxa',52,'2030-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004u12at10kuj0qi','cmp5jnvfd003d12atqahjbbxa',53,'2030-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004v12atsu8l17ui','cmp5jnvfd003d12atqahjbbxa',54,'2030-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004w12atqos40ynn','cmp5jnvfd003d12atqahjbbxa',55,'2030-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004x12atrek7732y','cmp5jnvfd003d12atqahjbbxa',56,'2030-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004y12atbopnlzv4','cmp5jnvfd003d12atqahjbbxa',57,'2031-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff004z12ath761bqfw','cmp5jnvfd003d12atqahjbbxa',58,'2031-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvff005012atdx83l924','cmp5jnvfd003d12atqahjbbxa',59,'2031-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005112at4s7whege','cmp5jnvfd003d12atqahjbbxa',60,'2031-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005212at3k0z37py','cmp5jnvfd003d12atqahjbbxa',61,'2031-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005312atbye931a3','cmp5jnvfd003d12atqahjbbxa',62,'2031-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005412atnm8r14gd','cmp5jnvfd003d12atqahjbbxa',63,'2031-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005512atp5okt9sx','cmp5jnvfd003d12atqahjbbxa',64,'2031-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005612at4flv8x3q','cmp5jnvfd003d12atqahjbbxa',65,'2031-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005712atzbwlpn0f','cmp5jnvfd003d12atqahjbbxa',66,'2031-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005812atchg5lgvw','cmp5jnvfd003d12atqahjbbxa',67,'2031-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005912atzo4b8www','cmp5jnvfd003d12atqahjbbxa',68,'2031-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005a12atg840vf4q','cmp5jnvfd003d12atqahjbbxa',69,'2032-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005b12atnzofcdj6','cmp5jnvfd003d12atqahjbbxa',70,'2032-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005c12at2ztbzdga','cmp5jnvfd003d12atqahjbbxa',71,'2032-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005d12atrwoo7b44','cmp5jnvfd003d12atqahjbbxa',72,'2032-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005e12atx9nx6pp2','cmp5jnvfd003d12atqahjbbxa',73,'2032-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005f12ata717y89f','cmp5jnvfd003d12atqahjbbxa',74,'2032-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005g12at5htovp9q','cmp5jnvfd003d12atqahjbbxa',75,'2032-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005h12atvzl915x2','cmp5jnvfd003d12atqahjbbxa',76,'2032-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005i12ato3wagemr','cmp5jnvfd003d12atqahjbbxa',77,'2032-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005j12at8scscf3f','cmp5jnvfd003d12atqahjbbxa',78,'2032-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005k12at02q51n7b','cmp5jnvfd003d12atqahjbbxa',79,'2032-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005l12at1atdq5wp','cmp5jnvfd003d12atqahjbbxa',80,'2032-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005m12at6u053e9s','cmp5jnvfd003d12atqahjbbxa',81,'2033-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005n12atrrwd5rj5','cmp5jnvfd003d12atqahjbbxa',82,'2033-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005o12atujliyvjf','cmp5jnvfd003d12atqahjbbxa',83,'2033-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005p12atvkkrlyc3','cmp5jnvfd003d12atqahjbbxa',84,'2033-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005q12at29ewrus9','cmp5jnvfd003d12atqahjbbxa',85,'2033-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfg005r12atdhle88ul','cmp5jnvfd003d12atqahjbbxa',86,'2033-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh005s12atxvhrong3','cmp5jnvfd003d12atqahjbbxa',87,'2033-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh005t12atmogb0ha5','cmp5jnvfd003d12atqahjbbxa',88,'2033-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh005u12atd98yw7yk','cmp5jnvfd003d12atqahjbbxa',89,'2033-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh005v12atp03aupux','cmp5jnvfd003d12atqahjbbxa',90,'2033-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh005w12atzkcfu5ei','cmp5jnvfd003d12atqahjbbxa',91,'2033-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh005x12atqnmu7yg3','cmp5jnvfd003d12atqahjbbxa',92,'2033-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh005y12at1q5xftm1','cmp5jnvfd003d12atqahjbbxa',93,'2034-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh005z12atrdc4c8o9','cmp5jnvfd003d12atqahjbbxa',94,'2034-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006012athjpj1u2o','cmp5jnvfd003d12atqahjbbxa',95,'2034-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006112at6dncotfp','cmp5jnvfd003d12atqahjbbxa',96,'2034-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006212ate00dlyk3','cmp5jnvfd003d12atqahjbbxa',97,'2034-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006312atmlb5kwnf','cmp5jnvfd003d12atqahjbbxa',98,'2034-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006412at7m2oxc36','cmp5jnvfd003d12atqahjbbxa',99,'2034-07-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006512ataxrue7p8','cmp5jnvfd003d12atqahjbbxa',100,'2034-08-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006612atcy4jwaxh','cmp5jnvfd003d12atqahjbbxa',101,'2034-09-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006712at6tmllpiy','cmp5jnvfd003d12atqahjbbxa',102,'2034-10-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006812atplk0zyq0','cmp5jnvfd003d12atqahjbbxa',103,'2034-11-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006912at3qsdjyse','cmp5jnvfd003d12atqahjbbxa',104,'2034-12-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006a12atccd4gqqt','cmp5jnvfd003d12atqahjbbxa',105,'2035-01-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006b12atbd296295','cmp5jnvfd003d12atqahjbbxa',106,'2035-02-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006c12at2s08nqup','cmp5jnvfd003d12atqahjbbxa',107,'2035-03-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006d12ath9oc3es7','cmp5jnvfd003d12atqahjbbxa',108,'2035-04-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006e12athq20guof','cmp5jnvfd003d12atqahjbbxa',109,'2035-05-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912'),
('cmp5jnvfh006f12atoms08p9e','cmp5jnvfd003d12atqahjbbxa',110,'2035-06-14',91.00,0.00,NULL,'upcoming',NULL,NULL,NULL,NULL,0,NULL,'2026-05-14 13:48:45.912','2026-05-14 13:48:45.912');
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
('cmp3xjef2000htzssuy6fgcbm','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0001','cmp3xjba30003tzss161x0exy',NULL,'cheque','microlending',NULL,NULL,20000.00,1000.00,19000.00,'weekly',20,'2026-04-13',NULL,1100.00,10.00,NULL,'active',1,20,2420.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:41:39.518','2026-05-13 11:30:44.495','fixed',NULL,NULL,NULL,0.00),
('cmp3xjj4j001ntzss4cpeou4y','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0002','cmp3xjbro0005tzss4ob3gdfi',NULL,'cheque','microlending',NULL,NULL,30000.00,1500.00,28500.00,'monthly',12,'2026-04-13',NULL,2750.00,10.00,NULL,'active',1,12,2750.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:41:45.619','2026-05-13 11:30:44.638','fixed',NULL,NULL,NULL,0.00),
('cmp3xjltb002dtzssr0bkhan6','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0003','cmp3xjc4v0007tzssg1ce06dp',NULL,'cheque','microlending',NULL,NULL,50000.00,2500.00,47500.00,'daily',100,'2026-04-13',NULL,550.00,10.00,NULL,'active',21,100,12210.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:41:49.103','2026-05-13 11:30:44.835','fixed',NULL,NULL,NULL,0.00),
('cmp3xk62e007ztzssprfp5nin','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0004','cmp3xjckm0009tzssi1qdimlk',NULL,'cheque','microlending',NULL,NULL,100000.00,5000.00,95000.00,'weekly',20,'2026-04-13',NULL,5500.00,10.00,NULL,'closed',20,20,110000.00,'2026-05-13 11:21:52.745','cmp1cxf590004m5lsp05yll1b','2026-05-13 10:42:15.351','2026-05-13 11:30:45.128','fixed',NULL,NULL,NULL,0.00),
('cmp3xkafe0095tzssd9krqy6x','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0005','cmp3xjcy2000btzssn6ct346q',NULL,'cheque','microlending',NULL,NULL,10000.00,500.00,9500.00,'monthly',12,'2026-04-13',NULL,917.00,10.00,NULL,'active',1,12,917.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:42:21.002','2026-05-13 11:30:45.568','fixed',NULL,NULL,NULL,0.00),
('cmp3xkd0p009vtzsseb8h2w1z','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0006','cmp3xjded000dtzssblkfcdne',NULL,'cheque','microlending',NULL,NULL,20000.00,1000.00,19000.00,'daily',100,'2026-04-13',NULL,220.00,10.00,NULL,'overdue',1,100,220.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:42:24.362','2026-05-14 13:50:58.763','fixed',NULL,NULL,NULL,0.00),
('cmp3xkvx600fhtzsskpfwt6dk','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0007','cmp3xjdu8000ftzsspt9qgs25',NULL,'cheque','microlending','',NULL,30000.00,1500.00,28500.00,'weekly',20,'2026-04-13','2026-08-31',1500.00,10.00,'','overdue',1,20,1650.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:42:48.858','2026-05-15 11:05:13.865','fixed',NULL,NULL,NULL,0.00),
('cmp3xl01500gntzssy1rv6rs7','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0008','cmp3xjb410001tzssgpdd8cf5',NULL,'cheque','microlending',NULL,NULL,50000.00,2500.00,47500.00,'monthly',12,'2026-04-13',NULL,4583.00,10.00,NULL,'active',1,12,4583.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:42:54.185','2026-05-13 11:30:46.055','fixed',NULL,NULL,NULL,0.00),
('cmp3xl2kt00hdtzssvstmwquj','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0009','cmp3xjba30003tzss161x0exy',NULL,'cheque','microlending',NULL,NULL,100000.00,5000.00,95000.00,'daily',100,'2026-04-13',NULL,1100.00,10.00,NULL,'active',18,100,23760.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:42:57.485','2026-05-13 11:30:46.260','fixed',NULL,NULL,NULL,0.00),
('cmp3xlilu00mztzssczjvv4xr','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0010','cmp3xjbro0005tzss4ob3gdfi',NULL,'cheque','microlending',NULL,NULL,10000.00,500.00,9500.00,'weekly',20,'2026-04-13',NULL,550.00,10.00,NULL,'active',2,20,1540.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:43:18.258','2026-05-13 11:30:46.418','fixed',NULL,NULL,NULL,0.00),
('cmp3xlkor00o5tzss7v5xxzqy','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0011','cmp3xjc4v0007tzssg1ce06dp',NULL,'cheque','microlending',NULL,NULL,20000.00,1000.00,19000.00,'monthly',12,'2026-04-13',NULL,1833.00,10.00,NULL,'active',0,12,733.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:43:20.955','2026-05-13 11:30:46.621','fixed',NULL,NULL,NULL,0.00),
('cmp3xlltb00ovtzss6gpg8c8n','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0012','cmp3xjckm0009tzssi1qdimlk',NULL,'cheque','microlending','',NULL,30000.00,1500.00,28500.00,'daily',100,'2026-04-13','2026-07-22',300.00,50.00,'','active',17,100,6930.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:43:22.415','2026-05-13 11:30:47.535','fixed',NULL,NULL,NULL,0.00),
('cmp3xluko00uhtzssuiit0wqb','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0013','cmp3xjcy2000btzssn6ct346q',NULL,'cheque','microlending',NULL,NULL,50000.00,2500.00,47500.00,'weekly',20,'2026-04-13',NULL,2750.00,10.00,NULL,'active',2,20,6600.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:43:33.768','2026-05-13 11:30:48.242','fixed',NULL,NULL,NULL,0.00),
('cmp3xlwdq00vntzssssb0b13u','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0014','cmp3xjded000dtzssblkfcdne',NULL,'cheque','microlending',NULL,NULL,100000.00,5000.00,95000.00,'monthly',12,'2026-04-13',NULL,9167.00,10.00,NULL,'active',0,12,3667.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:43:36.110','2026-05-13 11:30:48.552','fixed',NULL,NULL,NULL,0.00),
('cmp3xlxtt00wdtzss301t93n9','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0015','cmp3xjdu8000ftzsspt9qgs25',NULL,'cheque','microlending',NULL,NULL,10000.00,500.00,9500.00,'daily',100,'2026-04-13',NULL,110.00,10.00,NULL,'active',18,100,2332.00,NULL,'cmp1cxf590004m5lsp05yll1b','2026-05-13 10:43:37.986','2026-05-13 11:30:48.746','fixed',NULL,NULL,NULL,0.00),
('cmp5jnvfd003d12atqahjbbxa','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','LN0016','cmp3xjb410001tzssgpdd8cf5','cmp5jnvey003b12atz02nordu','cheque','microlending',NULL,NULL,10000.00,0.00,10000.00,'monthly',110,'2026-05-14','2035-07-14',91.00,100.00,'','active',0,110,0.00,NULL,'cmp1cxg2t000am5lsjru6vfbe','2026-05-14 13:48:45.912','2026-05-14 13:48:45.912','fixed',NULL,NULL,NULL,0.00);
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
('cmp6t6neh0008ucixw7ryhm03','cmp6t6nee0006ucix16cnx5xk','cmp3xkwwd00frtzss75x4egly',-3300.00,'2026-05-15 11:03:04.698'),
('cmp6t72nk000hucixzgm8nyjl','cmp6t72nj000fucixsuxr7iwc','cmp3xkw9g00fltzssbsduv0g3',-1650.00,'2026-05-15 11:03:24.465'),
('cmp6t7d0i000qucixob0x7igu','cmp6t7d0h000oucixy89yyrri','cmp3xkwwd00frtzss75x4egly',3300.00,'2026-05-15 11:03:37.891'),
('cmp6t9f1d000zucixsoexj362','cmp6t9f1b000xucixbyujaz4i','cmp3xkwwd00frtzss75x4egly',-3300.00,'2026-05-15 11:05:13.825');
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
('cmp6t6nee0006ucix16cnx5xk','cmp1cxexi0000m5lsfbfigi9x','cmp3xkvx600fhtzsskpfwt6dk',-3300.00,'cash',NULL,'2026-05-15 11:03:04.693','completed','2026-05-15 11:03:04.694','2026-05-15 11:03:04.694'),
('cmp6t72nj000fucixsuxr7iwc','cmp1cxexi0000m5lsfbfigi9x','cmp3xkvx600fhtzsskpfwt6dk',-1650.00,'cash',NULL,'2026-05-15 11:03:24.461','completed','2026-05-15 11:03:24.463','2026-05-15 11:03:24.463'),
('cmp6t7d0h000oucixy89yyrri','cmp1cxexi0000m5lsfbfigi9x','cmp3xkvx600fhtzsskpfwt6dk',3300.00,'cash',NULL,'2026-05-15 11:03:37.887','completed','2026-05-15 11:03:37.889','2026-05-15 11:03:37.889'),
('cmp6t9f1b000xucixbyujaz4i','cmp1cxexi0000m5lsfbfigi9x','cmp3xkvx600fhtzsskpfwt6dk',-3300.00,'cash',NULL,'2026-05-15 11:05:13.821','completed','2026-05-15 11:05:13.823','2026-05-15 11:05:13.823');
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
('cmp4a21vt0001w3sg25gr0r45','cmp3xlxtt00wdtzss301t93n9','cmp3xjdu8000ftzsspt9qgs25',4,40.00,0.00,0.00,'pending',NULL,NULL,'2026-05-13 16:32:05.128','2026-05-13 16:32:05.128',NULL,NULL),
('cmp4a7ad60001128mfy93a0vt','cmp3xjltb002dtzssr0bkhan6','cmp3xjc4v0007tzssg1ce06dp',6,60.00,0.00,0.00,'pending',NULL,NULL,'2026-05-13 16:36:09.400','2026-05-13 16:36:09.400',NULL,NULL),
('cmp4a7adj0003128mpe7o6ahe','cmp3xkd0p009vtzsseb8h2w1z','cmp3xjded000dtzssblkfcdne',29,290.00,0.00,0.00,'pending',NULL,NULL,'2026-05-13 16:36:09.416','2026-05-14 15:40:59.647',NULL,NULL),
('cmp4a7adp0005128mr0tecipj','cmp3xkvx600fhtzsskpfwt6dk','cmp3xjdu8000ftzsspt9qgs25',3,30.00,0.00,0.00,'pending',NULL,NULL,'2026-05-13 16:36:09.421','2026-05-15 11:05:38.846',NULL,NULL),
('cmp4a7adu0007128msoshvb2y','cmp3xl2kt00hdtzssvstmwquj','cmp3xjba30003tzss161x0exy',3,30.00,0.00,0.00,'pending',NULL,NULL,'2026-05-13 16:36:09.426','2026-05-13 16:36:09.426',NULL,NULL),
('cmp4a7ady0009128mcbgz6i4t','cmp3xlltb00ovtzss6gpg8c8n','cmp3xjckm0009tzssi1qdimlk',3,150.00,75.00,0.00,'partial','cmp1cxg2t000am5lsjru6vfbe',NULL,'2026-05-13 16:36:09.430','2026-05-14 15:43:29.596',NULL,NULL),
('cmp4a7ae3000b128m34ap4s7f','cmp3xluko00uhtzssuiit0wqb','cmp3xjcy2000btzssn6ct346q',1,10.00,0.00,10.00,'waived','cmp1cxg2t000am5lsjru6vfbe',NULL,'2026-05-13 16:36:09.435','2026-05-14 15:43:10.161','2026-05-14 15:43:10.160',NULL);
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
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rate_limits`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
/*!40000 ALTER TABLE `rate_limits` DISABLE KEYS */;
INSERT INTO `rate_limits` VALUES
(1,'login:user:admin',1,'2026-05-16 18:00:20.919','2026-05-16 18:15:20.919','2026-05-14 12:54:10.246','2026-05-16 18:00:20.919'),
(2,'login:ip:127.0.0.1',4,'2026-05-14 12:54:10.246','2026-05-14 13:09:10.246','2026-05-14 12:54:10.246','2026-05-14 13:08:29.582'),
(8,'login:user:superadmin',1,'2026-05-16 18:36:17.515','2026-05-16 18:51:17.515','2026-05-14 13:08:29.583','2026-05-16 18:36:17.515'),
(10,'login:ip:::1',1,'2026-05-16 18:36:17.515','2026-05-16 18:51:17.515','2026-05-15 11:00:40.076','2026-05-16 18:36:17.515'),
(11,'login:user:developer',1,'2026-05-16 17:59:07.938','2026-05-16 18:14:07.938','2026-05-16 07:57:58.110','2026-05-16 17:59:07.938');
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
('cmp2m3njx00037i7ws8csnqzg','cmp1cxexi0000m5lsfbfigi9x',NULL,'Erode',NULL,'active','2026-05-12 12:33:42.908','2026-05-12 12:33:42.908','microlending'),
('route-bhavani','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Bhavani','cmp1cxfck0006m5lsp6xj0azh','active','2026-05-11 15:29:10.582','2026-05-11 15:29:10.582','microlending'),
('route-chithode','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Chithode','cmp1cxfck0006m5lsp6xj0azh','active','2026-05-11 15:29:10.575','2026-05-11 15:29:10.575','microlending'),
('route-gobichettipalayam','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Gobichettipalayam','cmp1cxfck0006m5lsp6xj0azh','active','2026-05-11 15:29:10.578','2026-05-11 15:29:10.578','microlending');
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
/*!40000 ALTER TABLE `system_notifications` DISABLE KEYS */;
INSERT INTO `system_notifications` VALUES
('cmp5nqzx5007f12atrlvn42yj','cmp1cxexi0000m5lsfbfigi9x','microlending','success','money_off','Penalty Waived','Penalty of 10 waived for loan LN0013 by admin.','/loans/cmp3xluko00uhtzssuiit0wqb',1,'2026-05-14 15:43:42.916',NULL,'2026-05-14 15:43:10.169');
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
('cmp87ky4x0001z45xon2cjo0w','cmp1cxexi0000m5lsfbfigi9x','basic','active',200,10,'[\"microlending\",\"autofinance\"]','2026-05-15 00:00:00.000','2026-05-31 00:00:00.000',NULL,'2026-05-16 10:33:52.588','2026-05-16 15:21:41.673',NULL);
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
('cmp1cxf590004m5lsp05yll1b','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Admin User','9800000000',NULL,'admin','$2b$12$c87gi9TpG8StkBwcYOLE.e0WEruINYESasJ1hx.3J7xaeRdXwTiEW','admin','microlending','active',NULL,'2026-05-16 18:00:21.782','2026-05-11 15:29:09.357','2026-05-16 18:00:21.786',NULL,NULL),
('cmp1cxfck0006m5lsp6xj0azh','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Karthik Rajan','9876543210',NULL,'karthik','$2b$12$QNwe.NW.Nrb8N6eKfB/suO6AthHMV46tmtxMvRJfjXcGuaitnswMi','agent','microlending','active',NULL,'2026-05-12 07:15:21.062','2026-05-11 15:29:09.620','2026-05-12 07:15:21.065',NULL,NULL),
('cmp1cxfp20008m5lsqle1q8u1','cmp1cxexi0000m5lsfbfigi9x','cmp1cxext0002m5ls50zh8t71','Developer','9000000001',NULL,'developer','$2b$12$jknTMb9UwmKO5Si0Rgqtg.JmARmKdeAka3F10ACeHu7w7JtiH7LPa','developer','microlending','active',NULL,'2026-05-16 17:59:13.060','2026-05-11 15:29:10.070','2026-05-16 17:59:13.064',NULL,NULL),
('cmp1cxg2t000am5lsjru6vfbe','cmp1cxexi0000m5lsfbfigi9x',NULL,'admin2','9000000002',NULL,'admin2','$2b$10$U3x7hi4sprH/hh/VKe3U0uhwnnf/xObJHETqvA4G0WHLr5wna9qtS','admin','microlending','active',NULL,'2026-05-16 18:36:18.122','2026-05-11 15:29:10.565','2026-05-16 18:42:54.777',NULL,NULL);
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

-- Dump completed on 2026-05-17  0:13:53
